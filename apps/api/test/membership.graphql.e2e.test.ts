import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/common/config/app-config.service';
import { LoggingNotificationService } from '../src/modules/notifications/logging-notification.adapter';

interface Session {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

interface GraphQLResult<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string; details?: unknown } }>;
}

const runId = Date.now().toString(36);
const password = 'faithful8church';
const church = {
  slug: `e2e-members-${runId}`,
  email: `owner-members-${runId}@grace.example`,
};

let app: INestApplication;
let notifications: LoggingNotificationService;
let session: Session;

function tokenFromEmail(body: string): string {
  const match = /token=([^\s&]+)/u.exec(body);
  if (!match?.[1]) throw new Error(`No token found in notification body: ${body}`);
  return decodeURIComponent(match[1]);
}

async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
  options: { token?: string | null } = {},
): Promise<GraphQLResult<T>> {
  const call = request(app.getHttpServer()).post('/graphql').send({ query, variables });
  const token = options.token === undefined ? session?.accessToken : options.token;
  if (token) call.set('Authorization', `Bearer ${token}`);
  const response = await call.expect(200);
  return response.body as GraphQLResult<T>;
}

async function run<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const result = await gql<T>(query, variables);
  if (result.errors?.length) {
    throw new Error(`GraphQL error: ${JSON.stringify(result.errors)}`);
  }
  if (!result.data) throw new Error('GraphQL response returned no data');
  return result.data;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  const config = app.get(AppConfigService);
  app.setGlobalPrefix(config.globalPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: config.apiVersion });
  await app.init();
  notifications = app.get(LoggingNotificationService);

  notifications.clear();
  const registered = await request(app.getHttpServer())
    .post('/api/v1/auth/register-church')
    .send({
      church: { name: 'Membership Chapel', slug: church.slug, timezone: 'Africa/Lagos', locale: 'en' },
      owner: { firstName: 'Mercy', lastName: 'Owner', email: church.email, password },
    })
    .expect(201);
  session = registered.body as Session;

  const captured = notifications.lastFor(church.email, 'email');
  expect(captured).not.toBeNull();
  await request(app.getHttpServer())
    .post('/api/v1/auth/email/verify/consume')
    .send({ token: tokenFromEmail(captured!.body) })
    .expect(204);
});

afterAll(async () => {
  await app?.close();
});

describe('membership GraphQL surface (real Postgres + Redis)', () => {
  let memberId: string;
  let familyId: string;
  let visitorId: string;
  let sessionId: string;
  let departmentId: string;
  let roleId: string;

  it('rejects unauthenticated calls with the shared error code', async () => {
    const result = await gql<unknown>('query { members { total } }', undefined, { token: null });
    expect(result.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
  });

  it('creates a member and returns it through the contract shape', async () => {
    const data = await run<{ createMember: { id: string; firstName: string; lastName: string; status: string } }>(
      `mutation ($input: MemberInput!) {
        createMember(input: $input) { id firstName lastName status }
      }`,
      {
        input: {
          firstName: 'Grace',
          lastName: 'Abiodun',
          email: `grace-${runId}@example.org`,
          phone: '+2348011112222',
          dateOfBirth: '1988-03-04',
          countryCode: 'ng',
          tags: ['choir'],
        },
      },
    );
    expect(data.createMember.firstName).toBe('Grace');
    expect(data.createMember.status).toBe('ACTIVE');
    memberId = data.createMember.id;
  });

  it('surfaces contract validation failures through the GraphQL error envelope', async () => {
    const result = await gql<unknown>(
      `mutation ($input: MemberInput!) { createMember(input: $input) { id } }`,
      { input: { firstName: 'Broken', lastName: 'Row', email: 'not-an-email' } },
    );
    expect(result.errors?.[0]?.extensions?.code).toBe('VALIDATION_FAILED');
    expect(result.errors?.[0]?.extensions?.details).toBeTruthy();
  });

  it('lists members with pagination supplied by the shared query contract', async () => {
    const data = await run<{ members: { total: number; limit: number; offset: number; items: Array<{ id: string; fullName: string }> } }>(
      `query ($filter: MemberListInput) {
        members(filter: $filter) { total limit offset items { id fullName } }
      }`,
      { filter: { search: 'Abiodun', limit: 10 } },
    );
    expect(data.members.total).toBeGreaterThanOrEqual(1);
    expect(data.members.limit).toBe(10);
    expect(data.members.items.some((item) => item.id === memberId)).toBe(true);
  });

  it('updates a member', async () => {
    const data = await run<{ updateMember: { id: string; notes: string | null } }>(
      `mutation ($id: ID!, $input: MemberUpdateInput!) {
        updateMember(id: $id, input: $input) { id notes }
      }`,
      { id: memberId, input: { notes: 'Leads the choir' } },
    );
    expect(data.updateMember.notes).toBe('Leads the choir');
  });

  it('returns a not-found error code for a missing member', async () => {
    const result = await gql<unknown>('query ($id: ID!) { member(id: $id) { id } }', {
      id: '00000000-0000-4000-8000-000000000000',
    });
    expect(result.errors?.[0]?.extensions?.code).toBe('MEMBER_NOT_FOUND');
  });

  it('composes the member profile in a single query', async () => {
    const data = await run<{ memberProfile: { member: { id: string }; attendance: { memberId: string } } }>(
      `query ($id: ID!) {
        memberProfile(id: $id) {
          member { id firstName }
          attendance { memberId sessionsAttended sessionsRecorded attendanceRate currentStreak }
        }
      }`,
      { id: memberId },
    );
    expect(data.memberProfile.member.id).toBe(memberId);
    expect(data.memberProfile.attendance.memberId).toBe(memberId);
  });

  it('manages a family and its members', async () => {
    const created = await run<{ createFamily: { id: string; members: unknown[] } }>(
      `mutation ($input: FamilyInput!) {
        createFamily(input: $input) { id name status members { memberId } }
      }`,
      { input: { name: 'Abiodun Household', city: 'Lagos', countryCode: 'ng' } },
    );
    familyId = created.createFamily.id;
    expect(created.createFamily.members).toHaveLength(0);

    const withMember = await run<{ addFamilyMember: { members: Array<{ memberId: string; memberName: string }> } }>(
      `mutation ($familyId: ID!, $input: FamilyMemberAddInput!) {
        addFamilyMember(familyId: $familyId, input: $input) { id members { memberId memberName role } }
      }`,
      { familyId, input: { memberId, role: 'HEAD' } },
    );
    expect(withMember.addFamilyMember.members[0]?.memberId).toBe(memberId);

    const listed = await run<{ families: { items: Array<{ id: string; memberCount: number }> } }>(
      `query { families { items { id name memberCount } total } }`,
    );
    expect(listed.families.items.find((entry) => entry.id === familyId)?.memberCount).toBe(1);
  });

  it('records a relationship and walks the relationship graph', async () => {
    const second = await run<{ createMember: { id: string } }>(
      `mutation ($input: MemberInput!) { createMember(input: $input) { id } }`,
      { input: { firstName: 'Daniel', lastName: 'Abiodun' } },
    );

    await run(
      `mutation ($input: RelationshipInput!) {
        createRelationship(input: $input) { id fromMemberId toMemberId type inverseType }
      }`,
      { input: { fromMemberId: memberId, toMemberId: second.createMember.id, type: 'PARENT' } },
    );

    const graph = await run<{ relationshipGraph: { rootId: string; nodes: Array<{ id: string }>; edges: Array<{ type: string }> } }>(
      `query ($input: RelationshipGraphInput!) {
        relationshipGraph(input: $input) {
          rootId depth truncated nodes { id type label depth root } edges { id type source target label }
        }
      }`,
      { input: { memberId, depth: 2, includeDepartments: false, includeVolunteerRoles: false } },
    );
    expect(graph.relationshipGraph.rootId).toBe(memberId);
    expect(graph.relationshipGraph.nodes.some((node) => node.id === second.createMember.id)).toBe(true);
    expect(graph.relationshipGraph.edges.some((edge) => edge.type === 'RELATIONSHIP')).toBe(true);
  });

  it('captures a visitor, a visit, and the conversion to a member', async () => {
    const created = await run<{ createVisitor: { id: string; status: string; visits: unknown[] } }>(
      `mutation ($input: VisitorInput!) {
        createVisitor(input: $input) { id firstName lastName status source visits { id } }
      }`,
      { input: { firstName: 'Peace', lastName: 'Guest', source: 'WALK_IN', firstVisitAt: '2026-01-04T09:00:00.000Z' } },
    );
    visitorId = created.createVisitor.id;
    expect(created.createVisitor.status).toBe('NEW');

    const visit = await run<{ addVisitorVisit: { id: string; attended: boolean } }>(
      `mutation ($visitorId: ID!, $input: VisitorVisitInput!) {
        addVisitorVisit(visitorId: $visitorId, input: $input) { id occurredAt attended serviceName }
      }`,
      { visitorId, input: { occurredAt: '2026-01-11T09:00:00.000Z', serviceName: 'Second Service' } },
    );
    expect(visit.addVisitorVisit.attended).toBe(true);

    const converted = await run<{ convertVisitor: { id: string; status: string; convertedMemberId: string | null } }>(
      `mutation ($visitorId: ID!, $input: VisitorConvertInput) {
        convertVisitor(visitorId: $visitorId, input: $input) { id status convertedMemberId }
      }`,
      { visitorId, input: { member: { city: 'Abuja' } } },
    );
    expect(converted.convertVisitor.convertedMemberId).toBeTruthy();
    expect(converted.convertVisitor.status).toBe('CONVERTED');
  });

  it('runs an attendance session end to end', async () => {
    const created = await run<{ createAttendanceSession: { id: string; status: string } }>(
      `mutation ($input: AttendanceSessionInput!) {
        createAttendanceSession(input: $input) { id title status attendedCount absentCount }
      }`,
      { input: { title: 'Sunday First Service', kind: 'SERVICE', occurredAt: '2026-01-18T09:00:00.000Z', expectedCount: 120 } },
    );
    sessionId = created.createAttendanceSession.id;
    expect(created.createAttendanceSession.status).toBe('OPEN');

    const marked = await run<{ markAttendance: { status: string; attendeeName: string } }>(
      `mutation ($sessionId: ID!, $input: AttendanceMarkInput!) {
        markAttendance(sessionId: $sessionId, input: $input) { id attendeeName status }
      }`,
      { sessionId, input: { memberId, status: 'PRESENT' } },
    );
    expect(marked.markAttendance.status).toBe('PRESENT');

    const bulk = await run<{ bulkMarkAttendance: Array<{ status: string }> }>(
      `mutation ($sessionId: ID!, $input: AttendanceBulkMarkInput!) {
        bulkMarkAttendance(sessionId: $sessionId, input: $input) { id status }
      }`,
      {
        sessionId,
        input: {
          records: [
            { memberId, status: 'PRESENT' },
            { visitorId, status: 'LATE' },
          ],
        },
      },
    );
    expect(bulk.bulkMarkAttendance).toHaveLength(2);

    const stats = await run<{ memberAttendanceStats: { memberId: string; sessionsAttended: number } }>(
      `query ($memberId: ID!) { memberAttendanceStats(memberId: $memberId) { memberId sessionsAttended sessionsRecorded attendanceRate currentStreak } }`,
      { memberId },
    );
    expect(stats.memberAttendanceStats.sessionsAttended).toBeGreaterThanOrEqual(1);

    const closed = await run<{ closeAttendanceSession: { status: string; attendedCount: number } }>(
      `mutation ($id: ID!) { closeAttendanceSession(id: $id) { id status attendedCount } }`,
      { id: sessionId },
    );
    expect(closed.closeAttendanceSession.status).toBe('CLOSED');
  });

  it('manages departments and volunteer roles', async () => {
    const department = await run<{ createDepartment: { id: string; kind: string } }>(
      `mutation ($input: DepartmentInput!) {
        createDepartment(input: $input) { id name kind isActive members { memberId } }
      }`,
      { input: { name: 'Worship Ministry', kind: 'MINISTRY', meetingDay: 'THURSDAY', meetingTime: '18:00' } },
    );
    departmentId = department.createDepartment.id;

    const member = await run<{ addDepartmentMember: { memberId: string; role: string } }>(
      `mutation ($departmentId: ID!, $input: DepartmentMemberAddInput!) {
        addDepartmentMember(departmentId: $departmentId, input: $input) { id memberId memberName role status }
      }`,
      { departmentId, input: { memberId, role: 'LEADER' } },
    );
    expect(member.addDepartmentMember.role).toBe('LEADER');

    const role = await run<{ createVolunteerRole: { id: string; openSlots: number; requiredCount: number } }>(
      `mutation ($input: VolunteerRoleInput!) {
        createVolunteerRole(input: $input) { id name commitment requiredCount openSlots requiresBackgroundCheck assignments { id } }
      }`,
      { input: { name: 'Sound Desk Operator', departmentId, requiredCount: 3, commitment: 'WEEKLY' } },
    );
    expect(role.createVolunteerRole.openSlots).toBe(3);
    roleId = role.createVolunteerRole.id;

    const assignment = await run<{ assignVolunteer: { memberId: string; status: string } }>(
      `mutation ($roleId: ID!, $input: VolunteerAssignmentInput!) {
        assignVolunteer(roleId: $roleId, input: $input) { id memberId memberName status }
      }`,
      { roleId, input: { memberId } },
    );
    expect(assignment.assignVolunteer.status).toBe('ACTIVE');

    const roles = await run<{ volunteerRoles: { items: Array<{ id: string; activeCount: number; openSlots: number }> } }>(
      `query { volunteerRoles { items { id name activeCount openSlots } total } }`,
    );
    const listed = roles.volunteerRoles.items.find((entry) => entry.id === roleId);
    expect(listed?.activeCount).toBe(1);
    expect(listed?.openSlots).toBe(2);
  });

  it('appends a timeline note and generates the AI summary projection', async () => {
    await run(
      `mutation ($memberId: ID!, $input: TimelineNoteInput!) {
        addMemberTimelineNote(memberId: $memberId, input: $input) { id type title }
      }`,
      { memberId, input: { title: 'Met after service', summary: 'Interested in joining the choir' } },
    );

    const timeline = await run<{ memberTimeline: { total: number; items: Array<{ type: string }> } }>(
      `query ($memberId: ID!) { memberTimeline(memberId: $memberId) { total items { id type title } } }`,
      { memberId },
    );
    expect(timeline.memberTimeline.items.some((entry) => entry.type === 'NOTE')).toBe(true);

    const before = await run<{ memberSummary: unknown }>(
      `query ($memberId: ID!) { memberSummary(memberId: $memberId) { memberId status } }`,
      { memberId },
    );
    expect(before.memberSummary).toBeNull();

    const generated = await run<{ generateMemberSummary: { memberId: string; status: string; provider: string; content: string | null } }>(
      `mutation ($memberId: ID!) {
        generateMemberSummary(memberId: $memberId) {
          memberId status provider content highlights facts { familyCount departmentCount sessionsAttended tags }
        }
      }`,
      { memberId },
    );
    expect(generated.generateMemberSummary.status).toBe('FRESH');
    expect(generated.generateMemberSummary.provider).toBe('DETERMINISTIC');
    expect(generated.generateMemberSummary.content).toBeTruthy();
  });

  it('archives a member instead of deleting the record', async () => {
    const archived = await run<{ archiveMember: { id: string; status: string; archivedAt: string | null } }>(
      `mutation ($id: ID!) { archiveMember(id: $id) { id status archivedAt } }`,
      { id: memberId },
    );
    expect(archived.archiveMember.status).toBe('ARCHIVED');
    expect(archived.archiveMember.archivedAt).toBeTruthy();
  });
});

describe('membership REST surface (real Postgres + Redis)', () => {
  it('serves the same records through the versioned REST endpoints', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/membership/members')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ firstName: 'Ruth', lastName: 'Okafor', email: `ruth-${runId}@example.org` })
      .expect(201);
    const id = created.body.id as string;
    expect(created.body.tenantId).toBeTruthy();

    const listed = await request(app.getHttpServer())
      .get('/api/v1/membership/members')
      .query({ search: 'Okafor', limit: 5 })
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(listed.body.items.some((item: { id: string }) => item.id === id)).toBe(true);

    const fetched = await request(app.getHttpServer())
      .get(`/api/v1/membership/members/${id}`)
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(fetched.body.firstName).toBe('Ruth');

    const missing = await request(app.getHttpServer())
      .get('/api/v1/membership/members/00000000-0000-4000-8000-000000000000')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(404);
    expect(missing.body.error.code).toBe('MEMBER_NOT_FOUND');
  });
});
