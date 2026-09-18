import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MAX_ARTIFACT_BYTES } from '@zion8/contracts';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/common/config/app-config.service';
import { LoggingNotificationService } from '../src/modules/notifications/logging-notification.adapter';
import { MemoryJobRunner } from '../src/modules/memory/memory-job.runner';

interface Session {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

const runId = Date.now().toString(36);
const password = 'faithful8church';

/** A real 1x1 PNG, so the magic-byte detection has something honest to read. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PNG_BYTES = Buffer.from(PNG_BASE64, 'base64');

let app: INestApplication;
let notifications: LoggingNotificationService;
let runner: MemoryJobRunner;
let session: Session;
let tenantId: string;
let artifactId: string;

function tokenFromEmail(body: string): string {
  const match = /token=([^\s&]+)/u.exec(body);
  if (!match?.[1]) throw new Error(`No token found in notification body: ${body}`);
  return decodeURIComponent(match[1]);
}

async function bootstrapChurch(slug: string, email: string): Promise<Session> {
  const registered = await request(app.getHttpServer())
    .post('/api/v1/auth/register-church')
    .send({
      church: { name: `Memory Chapel ${slug}`, slug, timezone: 'Africa/Lagos', locale: 'en' },
      owner: { firstName: 'Memory', lastName: 'Keeper', email, password },
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

const binaryParser = (res: any, callback: (error: Error | null, body: Buffer) => void): void => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  const config = app.get(AppConfigService);
  app.use(json({ limit: '6mb' }));
  app.use(urlencoded({ extended: true, limit: '6mb' }));
  app.setGlobalPrefix(config.globalPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: config.apiVersion });
  await app.init();

  notifications = app.get(LoggingNotificationService);
  runner = app.get(MemoryJobRunner);

  notifications.clear();
  session = await bootstrapChurch(`e2e-memory-${runId}`, `memory-${runId}@grace.example`);

  const me = await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .set(auth(session.accessToken))
    .expect(200);
  tenantId = me.body.activeTenant.id as string;
});

afterAll(async () => {
  await app?.close();
});

describe('memory REST surface (real Postgres + Redis)', () => {
  it('rejects unauthenticated calls with the shared error code', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/memory/artifacts').expect(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('ingests an artifact, stores a content-addressed version, and queues metadata', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/memory/artifacts')
      .set(auth(session.accessToken))
      .send({
        title: 'Church dedication 1998',
        kind: 'PHOTO',
        capturedAt: '1998-06-14T09:00:00.000Z',
        datePrecision: 'DAY',
        tags: ['dedication', 'archive'],
        links: [{ linkType: 'TENANT', linkId: tenantId }],
        fileName: 'dedication.png',
        contentType: 'image/png',
        contentBase64: PNG_BASE64,
      })
      .expect(201);

    const artifact = response.body;
    expect(artifact.status).toBe('PROCESSING');
    expect(artifact.kind).toBe('PHOTO');
    expect(artifact.origin).toBe('UPLOAD');
    expect(artifact.currentVersion.sizeBytes).toBe(PNG_BYTES.byteLength);
    expect(artifact.currentVersion.sha256).toHaveLength(64);
    expect(artifact.currentVersion.detectedContentType).toBeNull();
    expect(artifact.tags).toEqual(['dedication', 'archive']);
    expect(artifact.links).toHaveLength(1);
    artifactId = artifact.id;
  });

  it('runs the metadata job and marks the artifact ready with a detected type', async () => {
    const processed = await runner.runOnce();
    expect(processed).toBeGreaterThanOrEqual(1);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/memory/artifacts/${artifactId}`)
      .set(auth(session.accessToken))
      .expect(200);
    expect(response.body.status).toBe('READY');
    expect(response.body.currentVersion.detectedContentType).toBe('image/png');
  });

  it('recognises a re-upload of identical bytes as a duplicate', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/memory/artifacts')
      .set(auth(session.accessToken))
      .send({
        title: 'Church dedication 1998 (copy)',
        kind: 'PHOTO',
        fileName: 'dedication-copy.png',
        contentType: 'image/png',
        contentBase64: PNG_BASE64,
      })
      .expect(201);

    expect(response.body.duplicateOfArtifactId).toBe(artifactId);
  });

  it('filters the archive by kind, tag and free text', async () => {
    const byKind = await request(app.getHttpServer())
      .get('/api/v1/memory/artifacts?kind=PHOTO&limit=10')
      .set(auth(session.accessToken))
      .expect(200);
    expect(byKind.body.total).toBeGreaterThanOrEqual(2);

    const byTag = await request(app.getHttpServer())
      .get('/api/v1/memory/artifacts?tag=dedication')
      .set(auth(session.accessToken))
      .expect(200);
    expect(byTag.body.items.some((item: { id: string }) => item.id === artifactId)).toBe(true);

    const bySearch = await request(app.getHttpServer())
      .get('/api/v1/memory/artifacts?search=dedication')
      .set(auth(session.accessToken))
      .expect(200);
    expect(bySearch.body.items.some((item: { id: string }) => item.id === artifactId)).toBe(true);
  });

  it('curates metadata and links without touching the stored bytes', async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/memory/artifacts/${artifactId}`)
      .set(auth(session.accessToken))
      .send({ title: 'Dedication service, June 1998', tags: ['dedication'] })
      .expect(200);
    expect(updated.body.title).toBe('Dedication service, June 1998');
    expect(updated.body.tags).toEqual(['dedication']);

    const linked = await request(app.getHttpServer())
      .post(`/api/v1/memory/artifacts/${artifactId}/links`)
      .set(auth(session.accessToken))
      .send({ linkType: 'DEPARTMENT', linkId: '11111111-1111-4111-8111-111111111111' })
      .expect(201);
    expect(linked.body.links).toHaveLength(2);

    const added = linked.body.links.find(
      (link: { linkType: string }) => link.linkType === 'DEPARTMENT',
    );

    const removed = await request(app.getHttpServer())
      .delete(`/api/v1/memory/artifacts/${artifactId}/links/${added.id}`)
      .set(auth(session.accessToken))
      .expect(200);
    expect(removed.body.links).toHaveLength(1);

    const duplicateLink = await request(app.getHttpServer())
      .post(`/api/v1/memory/artifacts/${artifactId}/links`)
      .set(auth(session.accessToken))
      .send({ linkType: 'TENANT', linkId: tenantId })
      .expect(409);
    expect(duplicateLink.body.error.code).toBe('MEMORY_LINK_EXISTS');
  });

  it('serves a download handle and the original bytes', async () => {
    const handle = await request(app.getHttpServer())
      .get(`/api/v1/memory/artifacts/${artifactId}/download`)
      .set(auth(session.accessToken))
      .expect(200);
    expect(handle.body.url).toContain(`/memory/artifacts/${artifactId}/content`);

    const content = await request(app.getHttpServer())
      .get(`/api/v1/memory/artifacts/${artifactId}/content`)
      .set(auth(session.accessToken))
      .buffer(true)
      .parse(binaryParser)
      .expect(200);
    expect(Buffer.compare(content.body, PNG_BYTES)).toBe(0);
    expect(content.headers['content-type']).toContain('image/png');
  });

  it('blocks an extraction stage that has no configured provider', async () => {
    const queued = await request(app.getHttpServer())
      .post(`/api/v1/memory/artifacts/${artifactId}/reprocess`)
      .set(auth(session.accessToken))
      .send({ stages: ['EXTRACT'] })
      .expect(200);
    expect(queued.body.jobs[0].type).toBe('EXTRACT');
    expect(queued.body.jobs[0].status).toBe('PENDING');

    await runner.runOnce();

    const jobs = await request(app.getHttpServer())
      .get(`/api/v1/memory/artifacts/${artifactId}/jobs`)
      .set(auth(session.accessToken))
      .expect(200);
    const extractJob = (jobs.body as Array<{ type: string; status: string; blockedReason: string | null }>).find(
      (job) => job.type === 'EXTRACT',
    );
    expect(extractJob?.status).toBe('BLOCKED');
    expect(extractJob?.blockedReason).toBe('OCR_NOT_CONFIGURED');

    const artifact = await request(app.getHttpServer())
      .get(`/api/v1/memory/artifacts/${artifactId}`)
      .set(auth(session.accessToken))
      .expect(200);
    expect(artifact.body.status).toBe('PARTIAL');
  });

  it('rejects an empty or unsupported upload before storing anything', async () => {
    const empty = await request(app.getHttpServer())
      .post('/api/v1/memory/artifacts')
      .set(auth(session.accessToken))
      .send({
        title: 'Nothing',
        fileName: 'nothing.png',
        contentType: 'image/png',
        contentBase64: '',
      })
      .expect(400);
    expect(empty.body.error.code).toBe('VALIDATION_FAILED');

    const unsupported = await request(app.getHttpServer())
      .post('/api/v1/memory/artifacts')
      .set(auth(session.accessToken))
      .send({
        title: 'Executable',
        fileName: 'payload.exe',
        contentType: 'application/x-msdownload',
        contentBase64: PNG_BASE64,
      })
      .expect(415);
    expect(unsupported.body.error.code).toBe('MEMORY_ARTIFACT_TYPE_UNSUPPORTED');
  });

  it('enforces the artifact size limit', async () => {
    const oversized = Buffer.alloc(MAX_ARTIFACT_BYTES + 1, 0x41).toString('base64');
    const response = await request(app.getHttpServer())
      .post('/api/v1/memory/artifacts')
      .set(auth(session.accessToken))
      .send({
        title: 'Too large',
        fileName: 'large.pdf',
        contentType: 'application/pdf',
        contentBase64: oversized,
      })
      .expect(413);
    expect(response.body.error.code).toBe('MEMORY_ARTIFACT_TOO_LARGE');
  });

  it('archives an artifact and hides it from the default listing', async () => {
    const archived = await request(app.getHttpServer())
      .delete(`/api/v1/memory/artifacts/${artifactId}`)
      .set(auth(session.accessToken))
      .expect(200);
    expect(archived.body.status).toBe('ARCHIVED');

    const defaultList = await request(app.getHttpServer())
      .get('/api/v1/memory/artifacts?limit=100')
      .set(auth(session.accessToken))
      .expect(200);
    expect(defaultList.body.items.some((item: { id: string }) => item.id === artifactId)).toBe(false);

    const withArchived = await request(app.getHttpServer())
      .get('/api/v1/memory/artifacts?includeArchived=true&limit=100')
      .set(auth(session.accessToken))
      .expect(200);
    expect(withArchived.body.items.some((item: { id: string }) => item.id === artifactId)).toBe(true);
  });

  it('isolates memory across tenants through row-level security', async () => {
    const other = await bootstrapChurch(`e2e-memory-other-${runId}`, `memory-other-${runId}@grace.example`);

    const hidden = await request(app.getHttpServer())
      .get(`/api/v1/memory/artifacts/${artifactId}`)
      .set(auth(other.accessToken))
      .expect(404);
    expect(hidden.body.error.code).toBe('MEMORY_ARTIFACT_NOT_FOUND');

    const theirList = await request(app.getHttpServer())
      .get('/api/v1/memory/artifacts?limit=100')
      .set(auth(other.accessToken))
      .expect(200);
    expect(theirList.body.items.some((item: { id: string }) => item.id === artifactId)).toBe(false);
  });
});
