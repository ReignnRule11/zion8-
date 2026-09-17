import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import {
  MAX_GRAPH_NODES,
  inverseRelationship,
  type GraphEdge,
  type GraphNode,
  type RelationshipGraph,
  type RelationshipGraphQuery,
  type RelationshipListQuery,
  type RelationshipPage,
  type RelationshipRequest,
  type RelationshipResponse,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MemberService } from './member.service';
import { TimelineService } from './timeline.service';
import { fullName, pageArgs, toIso } from './membership.utils';

const RELATION_INCLUDE = {
  fromMember: { select: { firstName: true, middleName: true, lastName: true } },
  toMember: { select: { firstName: true, middleName: true, lastName: true } },
} satisfies Prisma.MemberRelationshipInclude;

type RelationshipWithNames = Prisma.MemberRelationshipGetPayload<{
  include: typeof RELATION_INCLUDE;
}>;

@Injectable()
export class RelationshipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MemberService,
    private readonly timeline: TimelineService,
  ) {}

  async create(
    tenantId: string,
    actorUserId: string,
    input: RelationshipRequest,
  ): Promise<RelationshipResponse> {
    if (input.fromMemberId === input.toMemberId) {
      throw new DomainError(
        'RELATIONSHIP_SELF_REFERENCE',
        'A member cannot be related to themselves',
      );
    }
    await this.members.assertExists(tenantId, input.fromMemberId);
    await this.members.assertExists(tenantId, input.toMemberId);

    // A symmetric relationship stored as `A -B-> A` is the same fact as
    // `B -B-> A`, so check the reverse direction too and keep one row.
    const existing = await this.prisma.withTenant(tenantId, (tx) =>
      tx.memberRelationship.findFirst({
        where: {
          tenantId,
          OR: [
            {
              fromMemberId: input.fromMemberId,
              toMemberId: input.toMemberId,
              type: input.type,
            },
            {
              fromMemberId: input.toMemberId,
              toMemberId: input.fromMemberId,
              type: inverseRelationship(input.type),
            },
          ],
        },
        select: { id: true },
      }),
    );
    if (existing) {
      throw new DomainError('RELATIONSHIP_EXISTS', 'Those members already have this relationship');
    }

    try {
      const row = await this.prisma.withTenant(tenantId, async (tx) => {
        const created = await tx.memberRelationship.create({
          data: {
            tenantId,
            fromMemberId: input.fromMemberId,
            toMemberId: input.toMemberId,
            type: input.type,
            notes: input.notes ?? null,
            createdByUserId: actorUserId,
          },
          include: RELATION_INCLUDE,
        });

        await this.timeline.record(tx, {
          tenantId,
          memberId: input.fromMemberId,
          type: 'RELATIONSHIP',
          title: `Relationship recorded: ${labelOf(input.type)}`,
          summary: `${fullName(created.toMember)} is recorded as ${labelOf(input.type).toLowerCase()}`,
          sourceResourceType: 'member_relationship',
          sourceResourceId: created.id,
          dedupeKey: `relationship:${created.id}`,
          createdByUserId: actorUserId,
        });

        return created;
      });

      return toResponse(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainError(
          'RELATIONSHIP_EXISTS',
          'Those members already have this relationship',
        );
      }
      throw error;
    }
  }

  async list(tenantId: string, query: RelationshipListQuery): Promise<RelationshipPage> {
    const where: Prisma.MemberRelationshipWhereInput = {
      tenantId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.memberId
        ? { OR: [{ fromMemberId: query.memberId }, { toMemberId: query.memberId }] }
        : {}),
    };

    const { skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.memberRelationship.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
          include: RELATION_INCLUDE,
        }),
        tx.memberRelationship.count({ where }),
      ]),
    );

    return {
      items: rows.map(toResponse),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async remove(tenantId: string, relationshipId: string): Promise<void> {
    const deleted = await this.prisma.withTenant(tenantId, (tx) =>
      tx.memberRelationship.deleteMany({ where: { id: relationshipId, tenantId } }),
    );
    if (deleted.count === 0) {
      throw new DomainError('RELATIONSHIP_NOT_FOUND', 'That relationship could not be found');
    }
  }

  /**
   * Breadth-first walk out from one member. Members are the only nodes that are
   * traversed: families, departments, and volunteer roles attach as leaves, so
   * the graph stays bounded and its depth means something a person can read.
   */
  async graph(tenantId: string, query: RelationshipGraphQuery): Promise<RelationshipGraph> {
    const root = await this.members.findRow(tenantId, query.memberId);

    const memberDepths = new Map<string, number>([[root.id, 0]]);
    let frontier = [root.id];
    let truncated = false;

    for (let depth = 1; depth <= query.depth && frontier.length > 0; depth += 1) {
      const discovered = await this.neighbors(tenantId, frontier, query);
      const next: string[] = [];
      for (const id of discovered) {
        if (memberDepths.has(id)) continue;
        if (memberDepths.size >= MAX_GRAPH_NODES) {
          truncated = true;
          break;
        }
        memberDepths.set(id, depth);
        next.push(id);
      }
      frontier = next;
      if (truncated) break;
    }

    const memberIds = [...memberDepths.keys()];
    const memberRows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.member.findMany({
        where: { tenantId, id: { in: memberIds } },
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          preferredName: true,
          status: true,
          photoUrl: true,
        },
      }),
    );

    const nodes: GraphNode[] = memberRows.map((row) => ({
      id: row.id,
      type: 'MEMBER',
      label: fullName(row),
      depth: memberDepths.get(row.id) ?? 0,
      root: row.id === root.id,
      memberStatus: row.status,
      photoUrl: row.photoUrl,
    }));
    const edges: GraphEdge[] = [];

    await this.appendRelationshipEdges(tenantId, memberIds, query, edges);
    if (query.includeFamilies) {
      await this.appendFamilyEdges(tenantId, memberIds, nodes, edges);
    }
    if (query.includeDepartments) {
      await this.appendDepartmentEdges(tenantId, memberIds, nodes, edges);
    }
    if (query.includeVolunteerRoles) {
      await this.appendVolunteerEdges(tenantId, memberIds, nodes, edges);
    }

    return {
      rootId: root.id,
      depth: query.depth,
      truncated,
      nodes,
      edges,
    };
  }

  private async neighbors(
    tenantId: string,
    frontier: string[],
    query: RelationshipGraphQuery,
  ): Promise<string[]> {
    const relationships = await this.prisma.withTenant(tenantId, (tx) =>
      tx.memberRelationship.findMany({
        where: {
          tenantId,
          ...(query.types && query.types.length > 0 ? { type: { in: query.types } } : {}),
          OR: [{ fromMemberId: { in: frontier } }, { toMemberId: { in: frontier } }],
        },
        select: { fromMemberId: true, toMemberId: true },
      }),
    );

    const found = new Set<string>();
    for (const edge of relationships) {
      found.add(edge.fromMemberId);
      found.add(edge.toMemberId);
    }

    if (query.includeFamilies) {
      const rows = await this.prisma.withTenant(tenantId, (tx) =>
        tx.familyMember.findMany({
          where: { tenantId, memberId: { in: frontier } },
          select: { familyId: true },
        }),
      );
      const familyIds = rows.map((row) => row.familyId);
      if (familyIds.length > 0) {
        const siblings = await this.prisma.withTenant(tenantId, (tx) =>
          tx.familyMember.findMany({
            where: { tenantId, familyId: { in: familyIds } },
            select: { memberId: true },
          }),
        );
        for (const sibling of siblings) found.add(sibling.memberId);
      }
    }

    if (query.includeDepartments) {
      const rows = await this.prisma.withTenant(tenantId, (tx) =>
        tx.departmentMember.findMany({
          where: { tenantId, memberId: { in: frontier } },
          select: { departmentId: true },
        }),
      );
      const departmentIds = rows.map((row) => row.departmentId);
      if (departmentIds.length > 0) {
        const peers = await this.prisma.withTenant(tenantId, (tx) =>
          tx.departmentMember.findMany({
            where: { tenantId, departmentId: { in: departmentIds } },
            select: { memberId: true },
          }),
        );
        for (const peer of peers) found.add(peer.memberId);
      }
    }

    if (query.includeVolunteerRoles) {
      const rows = await this.prisma.withTenant(tenantId, (tx) =>
        tx.volunteerAssignment.findMany({
          where: { tenantId, memberId: { in: frontier } },
          select: { roleId: true },
        }),
      );
      const roleIds = rows.map((row) => row.roleId);
      if (roleIds.length > 0) {
        const peers = await this.prisma.withTenant(tenantId, (tx) =>
          tx.volunteerAssignment.findMany({
            where: { tenantId, roleId: { in: roleIds } },
            select: { memberId: true },
          }),
        );
        for (const peer of peers) found.add(peer.memberId);
      }
    }

    for (const id of frontier) found.delete(id);
    return [...found];
  }

  private async appendRelationshipEdges(
    tenantId: string,
    memberIds: string[],
    query: RelationshipGraphQuery,
    edges: GraphEdge[],
  ): Promise<void> {
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.memberRelationship.findMany({
        where: {
          tenantId,
          ...(query.types && query.types.length > 0 ? { type: { in: query.types } } : {}),
          fromMemberId: { in: memberIds },
          toMemberId: { in: memberIds },
        },
      }),
    );

    for (const row of rows) {
      const forward = labelOf(row.type);
      const backward = labelOf(inverseRelationship(row.type));
      edges.push({
        id: `relationship:${row.id}`,
        type: 'RELATIONSHIP',
        source: row.fromMemberId,
        target: row.toMemberId,
        label: forward,
      });
      // The inverse is derived, not stored, but the graph shows it so a reader
      // can walk the edge in either direction.
      edges.push({
        id: `relationship:${row.id}:inverse`,
        type: 'RELATIONSHIP',
        source: row.toMemberId,
        target: row.fromMemberId,
        label: backward,
      });
    }
  }

  private async appendFamilyEdges(
    tenantId: string,
    memberIds: string[],
    nodes: GraphNode[],
    edges: GraphEdge[],
  ): Promise<void> {
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.familyMember.findMany({
        where: { tenantId, memberId: { in: memberIds } },
        include: { family: { select: { id: true, name: true } } },
      }),
    );
    for (const row of rows) {
      nodes.push({
        id: row.family.id,
        type: 'FAMILY',
        label: row.family.name,
        depth: 0,
        root: false,
        memberStatus: null,
        photoUrl: null,
      });
      edges.push({
        id: `family:${row.id}`,
        type: 'FAMILY',
        source: row.memberId,
        target: row.family.id,
        label: labelOf(row.role),
      });
    }
  }

  private async appendDepartmentEdges(
    tenantId: string,
    memberIds: string[],
    nodes: GraphNode[],
    edges: GraphEdge[],
  ): Promise<void> {
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.departmentMember.findMany({
        where: { tenantId, memberId: { in: memberIds } },
        include: { department: { select: { id: true, name: true } } },
      }),
    );
    for (const row of rows) {
      nodes.push({
        id: row.department.id,
        type: 'DEPARTMENT',
        label: row.department.name,
        depth: 0,
        root: false,
        memberStatus: null,
        photoUrl: null,
      });
      edges.push({
        id: `department:${row.id}`,
        type: 'DEPARTMENT',
        source: row.memberId,
        target: row.department.id,
        label: labelOf(row.role),
      });
    }
  }

  private async appendVolunteerEdges(
    tenantId: string,
    memberIds: string[],
    nodes: GraphNode[],
    edges: GraphEdge[],
  ): Promise<void> {
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.volunteerAssignment.findMany({
        where: { tenantId, memberId: { in: memberIds } },
        include: { role: { select: { id: true, name: true } } },
      }),
    );
    for (const row of rows) {
      nodes.push({
        id: row.role.id,
        type: 'VOLUNTEER_ROLE',
        label: row.role.name,
        depth: 0,
        root: false,
        memberStatus: null,
        photoUrl: null,
      });
      edges.push({
        id: `volunteer:${row.id}`,
        type: 'VOLUNTEER',
        source: row.memberId,
        target: row.role.id,
        label: labelOf(row.status),
      });
    }
  }
}

function labelOf(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toResponse(row: RelationshipWithNames): RelationshipResponse {
  return {
    id: row.id,
    tenantId: row.tenantId,
    fromMemberId: row.fromMemberId,
    fromMemberName: fullName(row.fromMember),
    toMemberId: row.toMemberId,
    toMemberName: fullName(row.toMember),
    type: row.type,
    inverseType: inverseRelationship(row.type),
    notes: row.notes,
    createdAt: toIso(row.createdAt) as string,
  };
}
