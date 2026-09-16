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

interface OnboardingStepState {
  step: string;
  status: string;
  required: boolean;
  attemptCount: number;
}

interface OnboardingState {
  status: string;
  currentStep: string;
  percentComplete: number;
  requiredStepsRemaining: string[];
  emailVerified: boolean;
  steps: OnboardingStepState[];
}

const runId = Date.now().toString(36);
const password = 'faithful8church';

const journey = {
  slug: `e2e-onboard-${runId}`,
  email: `owner-${runId}@grace.example`,
  adminEmail: `admin-${runId}@grace.example`,
};

const recovery = {
  slug: `e2e-recover-${runId}`,
  email: `recover-${runId}@grace.example`,
};

let app: INestApplication;
let notifications: LoggingNotificationService;

function api(): request.Test {
  return request(app.getHttpServer());
}

function tokenFromEmail(body: string): string {
  const match = /token=([^\s&]+)/u.exec(body);
  if (!match?.[1]) throw new Error(`No token found in notification body: ${body}`);
  return decodeURIComponent(match[1]);
}

function stepIn(state: OnboardingState, step: string): OnboardingStepState | undefined {
  return state.steps.find((entry) => entry.step === step);
}

async function registerAndVerify(church: { name: string; slug: string; email: string }): Promise<Session> {
  notifications.clear();
  const registered = await api()
    .post('/api/v1/auth/register-church')
    .send({
      church: { name: church.name, slug: church.slug, timezone: 'Africa/Lagos', locale: 'en' },
      owner: { firstName: 'Grace', lastName: 'Owner', email: church.email, password },
    })
    .expect(201);

  const captured = notifications.lastFor(church.email, 'email');
  expect(captured).not.toBeNull();
  const token = tokenFromEmail(captured!.body);

  await api().post('/api/v1/auth/email/verify/consume').send({ token }).expect(204);
  return registered.body as Session;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  const config = app.get(AppConfigService);
  app.setGlobalPrefix(config.globalPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: config.apiVersion });
  await app.init();
  notifications = app.get(LoggingNotificationService);
});

afterAll(async () => {
  await app?.close();
});

describe('church onboarding journey (real Postgres + Redis)', () => {
  let session: Session;
  let invitationToken: string;
  let adminSession: Session;
  let importJobId: string;

  beforeAll(async () => {
    session = await registerAndVerify({
      name: 'Onboarding Chapel',
      slug: journey.slug,
      email: journey.email,
    });
  });

  it('materialises the journey with registration, verification, and provisioning complete', async () => {
    const response = await api()
      .get('/api/v1/onboarding')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    const state = response.body as OnboardingState;
    expect(state.emailVerified).toBe(true);
    expect(stepIn(state, 'REGISTRATION')?.status).toBe('COMPLETED');
    expect(stepIn(state, 'EMAIL_VERIFICATION')?.status).toBe('COMPLETED');
    expect(stepIn(state, 'TENANT_PROVISIONING')?.status).toBe('COMPLETED');
    expect(state.currentStep).toBe('WORKSPACE_CREATION');
    expect(state.requiredStepsRemaining).toContain('WORKSPACE_CREATION');
  });

  it('rejects reaching an optional step before the required workspace exists', async () => {
    const response = await api()
      .put('/api/v1/onboarding/branding')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ primaryColor: '#4f46e5' })
      .expect(409);
    expect(response.body.error.code).toBe('ONBOARDING_STEP_OUT_OF_ORDER');
  });

  it('saves the workspace profile and completes the required step', async () => {
    const response = await api()
      .put('/api/v1/onboarding/workspace')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        legalName: 'Onboarding Chapel Trust',
        city: 'Lagos',
        countryCode: 'ng',
        currency: 'ngn',
        weekStart: 'SUNDAY',
        estimatedMembers: 240,
        serviceTimes: [
          { day: 'SUNDAY', startTime: '09:00', endTime: '11:00', name: 'First Service' },
        ],
      })
      .expect(200);

    expect(response.body.city).toBe('Lagos');
    expect(response.body.countryCode).toBe('NG');
    expect(response.body.currency).toBe('NGN');

    const state = await api()
      .get('/api/v1/onboarding')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(stepIn(state.body as OnboardingState, 'WORKSPACE_CREATION')?.status).toBe('COMPLETED');
  });

  it('rejects service times whose end precedes their start', async () => {
    const response = await api()
      .put('/api/v1/onboarding/workspace')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        serviceTimes: [{ day: 'SUNDAY', startTime: '11:00', endTime: '09:00', name: 'Backwards' }],
      })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('invites an administrator and sends a single-use invitation', async () => {
    notifications.clear();
    const response = await api()
      .post('/api/v1/onboarding/invitations')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        invitations: [
          { email: journey.adminEmail, firstName: 'Ada', lastName: 'Admin', role: 'ADMINISTRATOR' },
        ],
      })
      .expect(201);

    expect(response.body.invitations).toHaveLength(1);
    expect(response.body.invitations[0].status).toBe('PENDING');

    const captured = notifications.lastFor(journey.adminEmail, 'email');
    expect(captured).not.toBeNull();
    invitationToken = tokenFromEmail(captured!.body);

    const state = await api()
      .get('/api/v1/onboarding')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(stepIn(state.body as OnboardingState, 'ADMINISTRATOR_INVITATION')?.status).toBe('COMPLETED');
  });

  it('previews the invitation before the invitee has an account', async () => {
    const response = await api()
      .get('/api/v1/onboarding/invitations/preview')
      .query({ token: invitationToken })
      .expect(200);

    expect(response.body.tenantSlug).toBe(journey.slug);
    expect(response.body.role).toBe('ADMINISTRATOR');
    expect(response.body.accountExists).toBe(false);
    expect(response.body.status).toBe('PENDING');
  });

  it('accepts the invitation, provisions the member, and signs them in', async () => {
    const accepted = await api()
      .post('/api/v1/onboarding/invitations/accept')
      .send({
        token: invitationToken,
        firstName: 'Ada',
        lastName: 'Admin',
        password: 'administrator9',
      })
      .expect(200);

    adminSession = accepted.body as Session;
    expect(adminSession.accessToken).toBeTruthy();

    const me = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .expect(200);
    expect(me.body.role).toBe('ADMINISTRATOR');
    expect(me.body.activeTenant.slug).toBe(journey.slug);

    const replay = await api()
      .post('/api/v1/onboarding/invitations/accept')
      .send({ token: invitationToken, password: 'administrator9' })
      .expect(400);
    expect(replay.body.error.code).toBe('CHALLENGE_CONSUMED');
  });

  it('prevents an administrator from inviting someone senior to themselves', async () => {
    const response = await api()
      .post('/api/v1/onboarding/invitations')
      .set('Authorization', `Bearer ${adminSession.accessToken}`)
      .send({ invitations: [{ email: `pastor-${runId}@grace.example`, role: 'SENIOR_PASTOR' }] })
      .expect(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('publishes the plan catalogue and enforces plan seat limits', async () => {
    const catalog = await api()
      .get('/api/v1/onboarding/subscription/catalog')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(catalog.body.plans).toHaveLength(4);

    await api()
      .put('/api/v1/onboarding/subscription')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ plan: 'GROWTH', seats: 5000 })
      .expect(400);

    const selected = await api()
      .put('/api/v1/onboarding/subscription')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ plan: 'GROWTH', billingCycle: 'ANNUAL' })
      .expect(200);
    expect(selected.body.plan).toBe('GROWTH');
    expect(selected.body.billingCycle).toBe('ANNUAL');
    expect(selected.body.priceCents).toBe(99000);
  });

  it('customises the brand theme', async () => {
    const response = await api()
      .put('/api/v1/onboarding/branding')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({
        displayName: 'Onboarding Chapel',
        tagline: 'A home for every heart',
        primaryColor: '#1D4ED8',
      })
      .expect(200);
    expect(response.body.primaryColor).toBe('#1d4ed8');
  });

  it('previews and commits a first member import', async () => {
    const csv = [
      'first_name,last_name,email,role',
      'John,Okafor,john@example.org,MEMBER',
      'Mary,Adeyemi,mary@example.org,VOLUNTEER',
      'Broken,Row,not-an-email,MEMBER',
    ].join('\n');

    const preview = await api()
      .post('/api/v1/onboarding/member-imports/preview')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ fileName: 'members.csv', csv })
      .expect(201);

    expect(preview.body.job.validRows).toBe(2);
    expect(preview.body.job.invalidRows).toBe(1);
    expect(preview.body.preview).toHaveLength(2);
    importJobId = preview.body.job.id;

    const committed = await api()
      .post('/api/v1/onboarding/member-imports/commit')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ jobId: importJobId })
      .expect(200);

    expect(committed.body.status).toBe('COMPLETED');
    expect(committed.body.importedRows).toBe(2);
    expect(committed.body.resumeIndex).toBe(2);
  });

  it('reaches dashboard-ready and completes the journey', async () => {
    const state = await api()
      .get('/api/v1/onboarding')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    const beforeComplete = state.body as OnboardingState;
    expect(stepIn(beforeComplete, 'FIRST_MEMBER_IMPORT')?.status).toBe('COMPLETED');
    expect(beforeComplete.requiredStepsRemaining).toHaveLength(0);
    expect(beforeComplete.percentComplete).toBe(89);

    const completed = await api()
      .post('/api/v1/onboarding/complete')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ acknowledgeOptionalSteps: true })
      .expect(200);

    expect(completed.body.status).toBe('COMPLETED');
    expect(completed.body.percentComplete).toBe(100);

    const summary = await api()
      .get('/api/v1/onboarding/summary')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(summary.body.completed).toBe(true);
  });
});

describe('onboarding recovery paths (real Postgres + Redis)', () => {
  let session: Session;

  beforeAll(async () => {
    session = await registerAndVerify({
      name: 'Recovery Chapel',
      slug: recovery.slug,
      email: recovery.email,
    });
    await api()
      .put('/api/v1/onboarding/workspace')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ city: 'Abuja', countryCode: 'NG' })
      .expect(200);
  });

  it('skips an optional step and keeps it skipped through reconciliation', async () => {
    const skipped = await api()
      .post('/api/v1/onboarding/steps/BRAND_CUSTOMIZATION/skip')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(stepIn(skipped.body as OnboardingState, 'BRAND_CUSTOMIZATION')?.status).toBe('SKIPPED');

    const refetched = await api()
      .get('/api/v1/onboarding')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(stepIn(refetched.body as OnboardingState, 'BRAND_CUSTOMIZATION')?.status).toBe('SKIPPED');
  });

  it('refuses to skip a required step', async () => {
    const response = await api()
      .post('/api/v1/onboarding/steps/WORKSPACE_CREATION/skip')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(409);
    expect(response.body.error.code).toBe('ONBOARDING_STEP_OUT_OF_ORDER');
  });

  it('retries a step and records the attempt', async () => {
    const retried = await api()
      .post('/api/v1/onboarding/steps/ADMINISTRATOR_INVITATION/retry')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    const step = stepIn(retried.body as OnboardingState, 'ADMINISTRATOR_INVITATION');
    expect(step?.attemptCount).toBeGreaterThanOrEqual(1);
  });

  it('reports invalid rows without blocking the valid ones', async () => {
    const csv = [
      'first_name,last_name,email',
      'Valid,Person,valid@example.org',
      'Duplicate,Person,valid@example.org',
      ',,missing@example.org',
    ].join('\n');

    const preview = await api()
      .post('/api/v1/onboarding/member-imports/preview')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ csv })
      .expect(201);

    expect(preview.body.job.validRows).toBe(1);
    expect(preview.body.job.invalidRows).toBe(2);
    const codes = preview.body.job.issues.map((issue: { code: string }) => issue.code);
    expect(codes).toContain('DUPLICATE_IN_FILE');
    expect(codes).toContain('MISSING_FIELD');
  });
});
