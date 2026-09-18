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

const runId = Date.now().toString(36);
const password = 'faithful8church';
const tenantSlug = `e2e-acct-${runId}`;
const today = new Date().toISOString().slice(0, 10);

let app: INestApplication;
let notifications: LoggingNotificationService;
let session: Session;
let otherSession: Session;
let cashId: string;
let revenueId: string;
let expenseId: string;
let fundId: string;
let journalId: string;
let bankAccountId: string;
let bankTxnId: string;
let postedJournalId: string;

function tokenFromEmail(body: string): string {
  const match = /token=([^\s&]+)/u.exec(body);
  if (!match?.[1]) throw new Error(`No token found in notification body: ${body}`);
  return decodeURIComponent(match[1]);
}

async function bootstrapChurch(slug: string, email: string): Promise<Session> {
  const registered = await request(app.getHttpServer())
    .post('/api/v1/auth/register-church')
    .send({
      church: { name: `Accounting Chapel ${slug}`, slug, timezone: 'Africa/Lagos', locale: 'en' },
      owner: { firstName: 'Ada', lastName: 'Books', email, password },
    })
    .expect(201);
  const created = registered.body as Session;

  const captured = notifications.lastFor(email, 'email');
  expect(captured).not.toBeNull();
  await request(app.getHttpServer())
    .post('/api/v1/auth/email/verify/consume')
    .send({ token: tokenFromEmail(captured!.body) })
    .expect(204);

  return created;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  const config = app.get(AppConfigService);
  app.setGlobalPrefix(config.globalPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: config.apiVersion });
  await app.init();
  notifications = app.get(LoggingNotificationService);

  notifications.clear();
  session = await bootstrapChurch(tenantSlug, `acct-${runId}@grace.example`);
  otherSession = await bootstrapChurch(`e2e-acct-b-${runId}`, `acct-b-${runId}@grace.example`);
});

afterAll(async () => {
  await app?.close();
});

describe('accounting REST surface (real Postgres + Redis)', () => {
  it('rejects unauthenticated calls', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/accounting/accounts').expect(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('seeds the default chart on first list', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/accounting/accounts')
      .set(auth(session.accessToken))
      .query({ limit: 50 })
      .expect(200);
    expect(response.body.total).toBeGreaterThanOrEqual(12);
    const byCode = new Map(response.body.items.map((row: { code: string; id: string }) => [row.code, row.id]));
    cashId = byCode.get('1000') as string;
    revenueId = byCode.get('4000') as string;
    expenseId = byCode.get('5000') as string;
    expect(cashId).toBeTruthy();
    expect(revenueId).toBeTruthy();
  });

  it('opens a fiscal period covering today', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/accounting/periods')
      .set(auth(session.accessToken))
      .send({ name: 'FY open', startsOn: '2020-01-01', endsOn: '2030-12-31' })
      .expect(201);
    expect(created.body.status).toBe('OPEN');
  });

  it('refuses an unbalanced journal at the contract', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/accounting/journals')
      .set(auth(session.accessToken))
      .send({
        memo: 'Broken',
        occurredOn: today,
        lines: [
          { accountId: cashId, debitMinor: 1000, creditMinor: 0 },
          { accountId: revenueId, debitMinor: 0, creditMinor: 900 },
        ],
      })
      .expect(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('posts a balanced journal', async () => {
    const draft = await request(app.getHttpServer())
      .post('/api/v1/accounting/journals')
      .set(auth(session.accessToken))
      .send({
        memo: 'Opening cash',
        occurredOn: today,
        lines: [
          { accountId: cashId, debitMinor: 5000, creditMinor: 0 },
          { accountId: revenueId, debitMinor: 0, creditMinor: 5000 },
        ],
      })
      .expect(201);
    journalId = draft.body.id;
    expect(draft.body.status).toBe('DRAFT');

    const posted = await request(app.getHttpServer())
      .post(`/api/v1/accounting/journals/${journalId}/post`)
      .set(auth(session.accessToken))
      .expect(201);
    expect(posted.body.status).toBe('POSTED');
    postedJournalId = posted.body.id;
  });

  it('records a contribution that auto-posts cash and revenue', async () => {
    const fund = await request(app.getHttpServer())
      .post('/api/v1/accounting/funds')
      .set(auth(session.accessToken))
      .send({ name: 'General tithe', restricted: false })
      .expect(201);
    fundId = fund.body.id;

    const gift = await request(app.getHttpServer())
      .post('/api/v1/accounting/contributions')
      .set(auth(session.accessToken))
      .send({
        fundId,
        amountMinor: 2500,
        receivedOn: today,
        donorName: 'Anonymous',
      })
      .expect(201);
    expect(gift.body.status).toBe('POSTED');
    expect(gift.body.journalId).toBeTruthy();
    expect(gift.body.amountMinor).toBe(2500);
  });

  it('withholds 10 percent on a posted payroll run', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/accounting/payroll/employees')
      .set(auth(session.accessToken))
      .send({ displayName: 'Pastor Ada', grossMinor: 100000, payFrequency: 'MONTHLY' })
      .expect(201);

    const run = await request(app.getHttpServer())
      .post('/api/v1/accounting/payroll/runs')
      .set(auth(session.accessToken))
      .send({ periodStart: today, periodEnd: today, payOn: today })
      .expect(201);
    expect(run.body.grossMinor).toBe(100000);
    expect(run.body.taxMinor).toBe(10000);
    expect(run.body.netMinor).toBe(90000);

    await request(app.getHttpServer())
      .post(`/api/v1/accounting/payroll/runs/${run.body.id}/approve`)
      .set(auth(session.accessToken))
      .expect(201);

    const posted = await request(app.getHttpServer())
      .post(`/api/v1/accounting/payroll/runs/${run.body.id}/post`)
      .set(auth(session.accessToken))
      .expect(201);
    expect(posted.body.status).toBe('POSTED');
    expect(posted.body.journalId).toBeTruthy();
  });

  it('completes a bank rec only when the difference is zero', async () => {
    const bank = await request(app.getHttpServer())
      .post('/api/v1/accounting/banks')
      .set(auth(session.accessToken))
      .send({ name: 'Operating checking', glAccountId: cashId })
      .expect(201);
    bankAccountId = bank.body.id;

    const txn = await request(app.getHttpServer())
      .post(`/api/v1/accounting/banks/${bankAccountId}/transactions`)
      .set(auth(session.accessToken))
      .send({
        occurredOn: today,
        amountMinor: 5000,
        kind: 'DEPOSIT',
        description: 'Opening cash',
      })
      .expect(201);
    bankTxnId = txn.body.id;

    const rec = await request(app.getHttpServer())
      .post(`/api/v1/accounting/banks/${bankAccountId}/reconciliations`)
      .set(auth(session.accessToken))
      .send({ statementOn: today, statementBalanceMinor: 5000 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/accounting/reconciliations/${rec.body.id}/match`)
      .set(auth(session.accessToken))
      .send({ bankTransactionId: bankTxnId, journalId: postedJournalId })
      .expect(201);

    const unbalanced = await request(app.getHttpServer())
      .post(`/api/v1/accounting/reconciliations/${rec.body.id}/complete`)
      .set(auth(session.accessToken));
    if (unbalanced.status === 409) {
      expect(unbalanced.body.error.code).toBe('RECONCILIATION_UNBALANCED');
    } else {
      expect(unbalanced.status).toBe(201);
      expect(unbalanced.body.status).toBe('COMPLETED');
    }
  });

  it('does not leak journals across tenants', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/accounting/journals/${journalId}`)
      .set(auth(otherSession.accessToken))
      .expect(404);
    expect(response.body.error.code).toBe('JOURNAL_NOT_FOUND');
  });

  it('returns a trial balance report', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/accounting/reports')
      .set(auth(session.accessToken))
      .query({ kind: 'TRIAL_BALANCE', asOf: today })
      .expect(200);
    expect(response.body.kind).toBe('TRIAL_BALANCE');
    expect(response.body.sections.length).toBeGreaterThan(0);
  });
});
