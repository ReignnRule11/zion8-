import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/common/config/app-config.service';
import { LoggingNotificationService } from '../src/modules/notifications/logging-notification.adapter';
import { SermonJobRunner } from '../src/modules/sermon/sermon-job.runner';

interface Session {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

const runId = Date.now().toString(36);
const password = 'faithful8church';
const tenantSlug = `e2e-sermon-${runId}`;

const MANUSCRIPT = [
  'We begin in John 3:16 and then turn to 1 Cor 13:4-7.',
  '',
  'Grace is a gift that faith receives and love spends on the neighbour.',
  '',
  'Psalm 23 is the close of this gathering as the church prays together.',
  '',
  'The choir will lead worship and the youth group will serve afterwards.',
].join('\n');

const MANUSCRIPT_BASE64 = Buffer.from(MANUSCRIPT, 'utf8').toString('base64');

const WAV_BYTES = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.alloc(4),
  Buffer.from('WAVE'),
  Buffer.alloc(4),
]);
const WAV_BASE64 = WAV_BYTES.toString('base64');

let app: INestApplication;
let notifications: LoggingNotificationService;
let runner: SermonJobRunner;
let session: Session;
let seriesId: string;
let textSermonId: string;
let textSermonSlug: string;
let audioSermonId: string;
let audioSermonSlug: string;
let shareToken: string;
let shareId: string;
let noteId: string;

function tokenFromEmail(body: string): string {
  const match = /token=([^\s&]+)/u.exec(body);
  if (!match?.[1]) throw new Error(`No token found in notification body: ${body}`);
  return decodeURIComponent(match[1]);
}

async function bootstrapChurch(slug: string, email: string): Promise<Session> {
  const registered = await request(app.getHttpServer())
    .post('/api/v1/auth/register-church')
    .send({
      church: { name: `Sermon Chapel ${slug}`, slug, timezone: 'Africa/Lagos', locale: 'en' },
      owner: { firstName: 'Sermon', lastName: 'Keeper', email, password },
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

async function drainSermonJobs(): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const processed = await runner.runOnce(20);
    if (processed === 0) return;
  }
}

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
  runner = app.get(SermonJobRunner);

  notifications.clear();
  session = await bootstrapChurch(tenantSlug, `sermon-${runId}@grace.example`);
});

afterAll(async () => {
  await app?.close();
});

describe('sermon REST surface (real Postgres + Redis)', () => {
  it('rejects unauthenticated calls with the shared error code', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/sermons').expect(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('creates a series that sermons can belong to', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/sermons/series')
      .set(auth(session.accessToken))
      .send({
        title: 'The Good Shepherd',
        slug: 'good-shepherd',
        visibility: 'PUBLIC',
        startsOn: '2026-01-04',
      })
      .expect(201);

    expect(created.body.slug).toBe('good-shepherd');
    expect(created.body.sermonCount).toBe(0);
    seriesId = created.body.id as string;

    const listed = await request(app.getHttpServer())
      .get('/api/v1/sermons/series')
      .set(auth(session.accessToken))
      .expect(200);
    expect(listed.body.items.some((item: { id: string }) => item.id === seriesId)).toBe(true);
  });

  it('rejects a metadata-only draft as not publishable', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/sermons')
      .set(auth(session.accessToken))
      .send({
        title: 'Untitled outline',
        visibility: 'MEMBERS',
        language: 'en',
      })
      .expect(201);
    expect(created.body.status).toBe('DRAFT');
    expect(created.body.mediaKind).toBe('NONE');

    const publish = await request(app.getHttpServer())
      .post(`/api/v1/sermons/${created.body.id}/publish`)
      .set(auth(session.accessToken))
      .send({})
      .expect(409);
    expect(publish.body.error.code).toBe('SERMON_NOT_PUBLISHABLE');
  });

  it('rejects unsupported media before attaching anything', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/sermons')
      .set(auth(session.accessToken))
      .send({
        title: 'Photograph',
        fileName: 'photo.png',
        contentType: 'image/png',
        contentBase64:
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      })
      .expect(415);
    expect(response.body.error.code).toBe('SERMON_MEDIA_TYPE_UNSUPPORTED');
  });

  it('ingests a text manuscript, transcribes it, and derives the study surface', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/sermons')
      .set(auth(session.accessToken))
      .send({
        title: 'Grace Received',
        seriesId,
        speakerName: 'Pastor Ada',
        preachedAt: '2026-01-11T09:00:00.000Z',
        visibility: 'MEMBERS',
        language: 'en',
        tags: ['grace'],
        fileName: 'manuscript.txt',
        contentType: 'text/plain',
        contentBase64: MANUSCRIPT_BASE64,
      })
      .expect(201);

    expect(created.body.status).toBe('PROCESSING');
    expect(created.body.mediaKind).toBe('TEXT');
    expect(created.body.mediaArtifactId).toBeTruthy();
    expect(created.body.series.id).toBe(seriesId);
    textSermonId = created.body.id as string;
    textSermonSlug = created.body.slug as string;

    await drainSermonJobs();

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/sermons/${textSermonId}`)
      .set(auth(session.accessToken))
      .expect(200);

    expect(detail.body.status).toBe('READY');
    expect(detail.body.transcript?.text).toContain('John 3:16');
    expect(detail.body.transcript?.source).toBe('DETERMINISTIC');
    expect(detail.body.scriptures.map((item: { reference: string }) => item.reference)).toEqual(
      expect.arrayContaining(['John 3:16', '1 Corinthians 13:4-7', 'Psalm 23']),
    );
    expect(detail.body.insight.summary).toBeTruthy();
    expect(detail.body.chapters.length).toBeGreaterThan(0);
    expect(detail.body.tags).toEqual(expect.arrayContaining(['grace']));
    expect(detail.body.jobs.every((job: { status: string }) => job.status === 'SUCCEEDED')).toBe(
      true,
    );
  });

  it('searches the derived transcript and regenerates a summary', async () => {
    const found = await request(app.getHttpServer())
      .get('/api/v1/sermons/search')
      .query({ q: 'John 3:16' })
      .set(auth(session.accessToken))
      .expect(200);
    expect(found.body.items.some((item: { id: string }) => item.id === textSermonId)).toBe(true);

    const generated = await request(app.getHttpServer())
      .post(`/api/v1/sermons/${textSermonId}/generate`)
      .set(auth(session.accessToken))
      .send({ kind: 'SUMMARY' })
      .expect(200);
    expect(generated.body.kind).toBe('SUMMARY');
    expect(generated.body.insight.summary).toBeTruthy();
  });

  it('stores private notes against a sermon', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/sermons/${textSermonId}/notes`)
      .set(auth(session.accessToken))
      .send({ body: 'Return to John 3:16 in small group.', timestampMs: 12000 })
      .expect(201);
    expect(created.body.body).toContain('John 3:16');
    noteId = created.body.id as string;

    const listed = await request(app.getHttpServer())
      .get(`/api/v1/sermons/${textSermonId}/notes`)
      .set(auth(session.accessToken))
      .expect(200);
    expect(listed.body.items.some((item: { id: string }) => item.id === noteId)).toBe(true);

    await request(app.getHttpServer())
      .patch(`/api/v1/sermons/${textSermonId}/notes/${noteId}`)
      .set(auth(session.accessToken))
      .send({ body: 'Ask the youth group what grace costs.' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/sermons/${textSermonId}/notes/${noteId}`)
      .set(auth(session.accessToken))
      .expect(204);
  });

  it('issues a share token that works before publish and is gone after revoke', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/sermons/${textSermonId}/shares`)
      .set(auth(session.accessToken))
      .send({ expiresInDays: 7 })
      .expect(201);

    expect(created.body.token).toBeTruthy();
    expect(created.body.url).toContain(`/listen/s/${created.body.token}`);
    shareToken = created.body.token as string;
    shareId = created.body.id as string;

    const shared = await request(app.getHttpServer())
      .get(`/api/v1/public/sermons/shares/${shareToken}`)
      .expect(200);
    expect(shared.body.id).toBe(textSermonId);
    expect(shared.body.status).toBe('READY');

    const media = await request(app.getHttpServer())
      .get(`/api/v1/public/sermons/shares/${shareToken}/media`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);
    expect(Buffer.isBuffer(media.body)).toBe(true);
    expect(media.body.toString('utf8')).toContain('John 3:16');

    await request(app.getHttpServer())
      .delete(`/api/v1/sermons/${textSermonId}/shares/${shareId}`)
      .set(auth(session.accessToken))
      .expect(200);

    const revoked = await request(app.getHttpServer())
      .get(`/api/v1/public/sermons/shares/${shareToken}`)
      .expect(410);
    expect(revoked.body.error.code).toBe('SERMON_SHARE_REVOKED');
  });

  it('keeps drafts off the public permalink until they are published', async () => {
    const hidden = await request(app.getHttpServer())
      .get(`/api/v1/public/sermons/${tenantSlug}/${textSermonSlug}`)
      .expect(404);
    expect(hidden.body.error.code).toBe('SERMON_NOT_FOUND');

    const published = await request(app.getHttpServer())
      .post(`/api/v1/sermons/${textSermonId}/publish`)
      .set(auth(session.accessToken))
      .send({ visibility: 'PUBLIC' })
      .expect(200);
    expect(published.body.status).toBe('PUBLISHED');
    expect(published.body.visibility).toBe('PUBLIC');

    const permalink = await request(app.getHttpServer())
      .get(`/api/v1/public/sermons/${tenantSlug}/${textSermonSlug}`)
      .expect(200);
    expect(permalink.body.id).toBe(textSermonId);
    expect(permalink.body.transcript.text).toContain('John 3:16');
  });

  it('does not advertise a text-only sermon on the podcast feed', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/public/sermons/${tenantSlug}/podcast.xml`)
      .expect(404);
    expect(response.body.error.code).toBe('SERMON_PODCAST_UNAVAILABLE');
  });

  it('publishes audio to the podcast feed with a streamable enclosure', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/sermons')
      .set(auth(session.accessToken))
      .send({
        title: 'Sunday recording',
        speakerName: 'Pastor Ada',
        preachedAt: '2026-01-18T09:00:00.000Z',
        visibility: 'PUBLIC',
        language: 'en',
        fileName: 'clip.wav',
        contentType: 'audio/wav',
        contentBase64: WAV_BASE64,
        transcriptText: MANUSCRIPT,
      })
      .expect(201);

    expect(created.body.mediaKind).toBe('AUDIO');
    audioSermonId = created.body.id as string;
    audioSermonSlug = created.body.slug as string;

    await drainSermonJobs();

    const ready = await request(app.getHttpServer())
      .get(`/api/v1/sermons/${audioSermonId}`)
      .set(auth(session.accessToken))
      .expect(200);
    expect(ready.body.status).toBe('READY');

    await request(app.getHttpServer())
      .post(`/api/v1/sermons/${audioSermonId}/publish`)
      .set(auth(session.accessToken))
      .send({ visibility: 'PUBLIC' })
      .expect(200);

    const feed = await request(app.getHttpServer())
      .get(`/api/v1/public/sermons/${tenantSlug}/podcast.xml`)
      .expect(200);
    expect(feed.headers['content-type']).toMatch(/application\/rss\+xml/);
    expect(feed.text).toContain('<title>Sunday recording</title>');
    expect(feed.text).toContain(`/api/v1/public/sermons/${tenantSlug}/${audioSermonSlug}/media`);

    const media = await request(app.getHttpServer())
      .get(`/api/v1/public/sermons/${tenantSlug}/${audioSermonSlug}/media`)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);
    expect(Buffer.isBuffer(media.body)).toBe(true);
    expect(media.body.equals(WAV_BYTES)).toBe(true);
    expect(media.headers['content-type']).toMatch(/audio\/(wav|x-wav)/);
  });

  it('isolates sermons across tenants through row-level security', async () => {
    const other = await bootstrapChurch(`e2e-sermon-o-${runId}`, `sermon-o-${runId}@grace.example`);

    const hidden = await request(app.getHttpServer())
      .get(`/api/v1/sermons/${textSermonId}`)
      .set(auth(other.accessToken))
      .expect(404);
    expect(hidden.body.error.code).toBe('SERMON_NOT_FOUND');

    const theirList = await request(app.getHttpServer())
      .get('/api/v1/sermons?limit=100')
      .set(auth(other.accessToken))
      .expect(200);
    expect(theirList.body.items.some((item: { id: string }) => item.id === textSermonId)).toBe(
      false,
    );
  });

  it('archives a sermon and hides it from the default listing', async () => {
    const archived = await request(app.getHttpServer())
      .delete(`/api/v1/sermons/${textSermonId}`)
      .set(auth(session.accessToken))
      .expect(200);
    expect(archived.body.status).toBe('ARCHIVED');

    const defaultList = await request(app.getHttpServer())
      .get('/api/v1/sermons?limit=100')
      .set(auth(session.accessToken))
      .expect(200);
    expect(defaultList.body.items.some((item: { id: string }) => item.id === textSermonId)).toBe(
      false,
    );

    const withArchived = await request(app.getHttpServer())
      .get('/api/v1/sermons?includeArchived=true&limit=100')
      .set(auth(session.accessToken))
      .expect(200);
    expect(
      withArchived.body.items.some((item: { id: string }) => item.id === textSermonId),
    ).toBe(true);

    const gone = await request(app.getHttpServer())
      .get(`/api/v1/public/sermons/${tenantSlug}/${textSermonSlug}`)
      .expect(404);
    expect(gone.body.error.code).toBe('SERMON_NOT_FOUND');
  });
});
