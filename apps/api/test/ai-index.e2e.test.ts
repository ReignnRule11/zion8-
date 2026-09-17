import { VersioningType, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { json, urlencoded } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { AppConfigService } from '../src/common/config/app-config.service';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service';
import { AiIndexRunner } from '../src/modules/ai/ai-index.runner';
import { MemoryJobRunner } from '../src/modules/memory/memory-job.runner';
import { LoggingNotificationService } from '../src/modules/notifications/logging-notification.adapter';

interface Session {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

const runId = Date.now().toString(36);
const password = 'faithful8church';

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const NARRATIVE = [
  'The baptism service will be held on the first Sunday of March at the riverside.',
  'Candidates should arrive by nine in the morning for a short briefing with the pastor.',
  'The choir will lead worship and the youth group will serve refreshments afterwards.',
  'Parking is available in the church car park and overflow parking is behind the hall.',
  'For more details please speak with the church office during the week.',
].join(' ');

let app: INestApplication;
let notifications: LoggingNotificationService;
let memoryRunner: MemoryJobRunner;
let aiRunner: AiIndexRunner;
let prisma: PrismaService;
let session: Session;
let tenantId: string;

function tokenFromEmail(body: string): string {
  const match = /token=([^\s&]+)/u.exec(body);
  if (!match?.[1]) throw new Error(`No token found in notification body: ${body}`);
  return decodeURIComponent(match[1]);
}

async function bootstrapChurch(slug: string, email: string): Promise<Session> {
  const registered = await request(app.getHttpServer())
    .post('/api/v1/auth/register-church')
    .send({
      church: { name: `Index Chapel ${slug}`, slug, timezone: 'Africa/Lagos', locale: 'en' },
      owner: { firstName: 'Index', lastName: 'Builder', email, password },
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
  app.use(json({ limit: '6mb' }));
  app.use(urlencoded({ extended: true, limit: '6mb' }));
  app.setGlobalPrefix(config.globalPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: config.apiVersion });
  await app.init();

  notifications = app.get(LoggingNotificationService);
  memoryRunner = app.get(MemoryJobRunner);
  aiRunner = app.get(AiIndexRunner);
  prisma = app.get(PrismaService);

  notifications.clear();
  session = await bootstrapChurch(`e2e-ai-${runId}`, `ai-${runId}@grace.example`);
  const me = await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .set(auth(session.accessToken))
    .expect(200);
  tenantId = me.body.activeTenant.id as string;
});

afterAll(async () => {
  await app?.close();
});

async function upload(
  fileName: string,
  contentType: string,
  body: Buffer | string,
): Promise<string> {
  const content = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
  const response = await request(app.getHttpServer())
    .post('/api/v1/memory/artifacts')
    .set(auth(session.accessToken))
    .send({
      title: fileName,
      kind: contentType.startsWith('image/') ? 'PHOTO' : 'DOCUMENT',
      datePrecision: 'UNKNOWN',
      links: [{ linkType: 'TENANT', linkId: tenantId }],
      fileName,
      contentType,
      contentBase64: content.toString('base64'),
    })
    .expect(201);
  return response.body.id as string;
}

async function settleMemory(): Promise<void> {
  // Metadata is the only stage that can run with no external capability, and it
  // is what moves an artifact to READY.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const processed = await memoryRunner.runOnce();
    if (processed === 0) break;
  }
}

async function settleIndex(): Promise<number> {
  // Indexing is a reconciliation pass over every pending source in the database,
  // including leftover artifacts from other e2e files. Drain until a pass finds
  // nothing, so later assertions are not racing a leftover batch.
  let total = 0;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const processed = await aiRunner.runOnce(50);
    total += processed;
    if (processed === 0) break;
  }
  return total;
}

describe('Zion AI indexing (real Postgres + pgvector)', () => {
  it('projects a text artifact into documents, chunks and embeddings', async () => {
    const artifactId = await upload('baptism-notice.txt', 'text/plain', NARRATIVE);
    await settleMemory();

    const processed = await settleIndex();
    expect(processed).toBeGreaterThan(0);

    const documents = await prisma.withTenant(tenantId, (tx) =>
      tx.aiDocument.findMany({ where: { sourceId: artifactId } }),
    );
    expect(documents).toHaveLength(1);
    const document = documents[0]!;
    expect(document.status).toBe('INDEXED');
    expect(document.sourceType).toBe('MEMORY_ARTIFACT');
    expect(document.chunkCount).toBeGreaterThan(0);
    expect(document.content).toContain('baptism service');
    expect(document.embeddingModelId).not.toBeNull();

    const chunks = await prisma.withTenant(tenantId, (tx) =>
      tx.aiChunk.findMany({ where: { documentId: document.id }, orderBy: { ordinal: 'asc' } }),
    );
    expect(chunks).toHaveLength(document.chunkCount);
    chunks.forEach((chunk, index) => {
      expect(chunk.ordinal).toBe(index);
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.contentHash).toHaveLength(64);
      expect(chunk.tokenCount).toBeGreaterThan(0);
    });

    const [embeddingCount] = await prisma.withTenant(
      tenantId,
      (tx) =>
        tx.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*)::bigint AS count
        FROM "ai_chunk_embeddings" e
        JOIN "ai_chunks" c ON c."id" = e."chunk_id"
        WHERE c."document_id" = ${document.id}::uuid
      `,
    );
    expect(Number(embeddingCount!.count)).toBe(chunks.length);
  });

  it('stores a vector that pgvector can search with cosine distance', async () => {
    const artifactId = await upload(
      'worship-notes.txt',
      'text/plain',
      'The worship team rehearses on Thursday evening in the main hall.',
    );
    await settleMemory();
    await settleIndex();

    const document = await prisma.withTenant(tenantId, (tx) =>
      tx.aiDocument.findFirstOrThrow({ where: { sourceId: artifactId } }),
    );

    const [row] = await prisma.withTenant(
      tenantId,
      (tx) =>
        tx.$queryRaw<Array<{ distance: number; dimensions: number }>>`
        SELECT (e."embedding" <=> e."embedding")::float8 AS distance,
               vector_dims(e."embedding") AS dimensions
        FROM "ai_chunk_embeddings" e
        JOIN "ai_chunks" c ON c."id" = e."chunk_id"
        WHERE c."document_id" = ${document.id}::uuid
        LIMIT 1
      `,
    );
    expect(row).toBeDefined();
    // A vector's cosine distance to itself is zero, which also proves the HNSW
    // index and the `vector_cosine_ops` operator class are usable.
    expect(Number(row!.distance)).toBeCloseTo(0, 5);
    expect(Number(row!.dimensions)).toBe(1536);
  });

  it('makes chunks reachable through full-text search', async () => {
    const [row] = await prisma.withTenant(
      tenantId,
      (tx) =>
        tx.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*)::bigint AS count
        FROM "ai_chunks"
        WHERE "tsv" @@ plainto_tsquery('simple', 'baptism')
      `,
    );
    expect(Number(row!.count)).toBeGreaterThan(0);
  });

  it('settles a source that needs extraction as PARTIAL rather than indexing it empty', async () => {
    const artifactId = await upload('scan.png', 'image/png', Buffer.from(PNG_BASE64, 'base64'));
    await settleMemory();
    await settleIndex();

    const document = await prisma.withTenant(tenantId, (tx) =>
      tx.aiDocument.findFirstOrThrow({ where: { sourceId: artifactId } }),
    );
    expect(document.status).toBe('PARTIAL');
    expect(document.chunkCount).toBe(0);
    expect(document.lastError).toBe('TEXT_EXTRACTION_NOT_CONFIGURED');

    const chunks = await prisma.withTenant(tenantId, (tx) =>
      tx.aiChunk.count({ where: { documentId: document.id } }),
    );
    expect(chunks).toBe(0);
  });

  it('does not index the same unchanged version twice', async () => {
    const artifactId = await upload('bulletin.txt', 'text/plain', 'Sunday bulletin contents.');
    await settleMemory();

    const first = await settleIndex();
    expect(first).toBeGreaterThan(0);
    const second = await aiRunner.runOnce(50);
    expect(second).toBe(0);

    const count = await prisma.withTenant(tenantId, (tx) =>
      tx.aiDocument.count({ where: { sourceId: artifactId } }),
    );
    expect(count).toBe(1);
  });

  it('keeps one church index invisible to another', async () => {
    const other = await bootstrapChurch(`e2e-ai-other-${runId}`, `ai-other-${runId}@grace.example`);
    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(auth(other.accessToken))
      .expect(200);
    const otherTenantId = me.body.activeTenant.id as string;

    const visible = await prisma.withTenant(otherTenantId, (tx) => tx.aiChunk.count());
    expect(visible).toBe(0);

    const own = await prisma.withTenant(tenantId, (tx) => tx.aiChunk.count());
    expect(own).toBeGreaterThan(0);
  });
});
