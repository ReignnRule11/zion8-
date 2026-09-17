import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../infrastructure/storage/object-storage.port';
import { EMBEDDING_PROVIDER, type EmbeddingProvider } from './ports/embedding.provider';
import { chunkText, decodeText, isTextReadable } from './ai.utils';

const SOURCE_TYPE = 'MEMORY_ARTIFACT' as const;

/** Why a source is indexed partially rather than fully. Surfaced to an operator. */
export const AiIndexBlockedReason = {
  EXTRACTION_NOT_CONFIGURED: 'TEXT_EXTRACTION_NOT_CONFIGURED',
  NO_TEXT_CONTENT: 'NO_TEXT_CONTENT',
} as const;

interface PendingSourceRow {
  version_id: string;
  artifact_id: string;
  tenant_id: string;
  sha256: string;
  storage_key: string;
  detected_content_type: string | null;
  declared_content_type: string;
  file_name: string;
  title: string;
  kind: string;
  captured_at: Date | null;
}

export interface PendingSermonRow {
  document_id: string;
  tenant_id: string;
  content: string | null;
  title: string;
}

export interface IndexingOutcome {
  documentId: string;
  status: 'INDEXED' | 'PARTIAL';
  chunkCount: number;
  reason?: string;
}

/**
 * Builds and refreshes the search index over the archive.
 *
 * Indexing is reconciliation, not event handling. The worker asks a single
 * question — "which current artifact versions have no up-to-date index entry?" —
 * and acts on the answer. That makes it idempotent and self-healing: a missed
 * notification, a crash mid-index or a restored backup all converge on the same
 * state on the next pass, with no event log to replay and no duplicate work,
 * because the document's content hash is part of the match.
 *
 * Content is addressed by the hash of the source bytes. Re-uploading identical
 * content produces the same hash and is skipped; changing a version produces a
 * new row and the old one stops matching.
 */
@Injectable()
export class AiIndexService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddings: EmbeddingProvider,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Current, unarchived artifact versions with no settled index entry.
   *
   * Only INDEXED and PARTIAL are treated as settled. A FAILED or STALE document
   * is returned again, so a transient provider outage heals without an operator
   * action.
   */
  async findPending(limit: number): Promise<PendingSourceRow[]> {
    return this.prisma.withoutScope(
      (tx) =>
        tx.$queryRaw<PendingSourceRow[]>`
        SELECT v."id"                   AS version_id,
               v."artifact_id"          AS artifact_id,
               v."tenant_id"            AS tenant_id,
               v."sha256"               AS sha256,
               v."storage_key"          AS storage_key,
               v."detected_content_type" AS detected_content_type,
               v."declared_content_type" AS declared_content_type,
               v."file_name"            AS file_name,
               a."title"                AS title,
               a."kind"::text           AS kind,
               a."captured_at"          AS captured_at
        FROM "memory_artifact_versions" v
        JOIN "memory_artifacts" a ON a."id" = v."artifact_id"
        LEFT JOIN "ai_documents" d
          ON d."source_type" = ${SOURCE_TYPE}::"AiSourceType"
         AND d."source_id" = v."artifact_id"
         AND d."version_key" = v."id"::text
         AND d."content_hash" = v."sha256"
         AND d."status" IN ('INDEXED', 'PARTIAL')
        WHERE v."is_current" = true
          AND a."status" IN ('READY', 'PARTIAL')
          AND a."archived_at" IS NULL
          AND d."id" IS NULL
        ORDER BY v."created_at" ASC
        LIMIT ${limit}
      `,
    );
  }

  /**
   * Sermon transcripts queued by the sermon INDEX stage.
   *
   * The sermon pipeline writes the transcript onto `ai_documents` as PENDING.
   * This pass chunks and embeds that text so sermon search reuses the same
   * corpus as the rest of Zion AI.
   */
  async findPendingSermons(limit: number): Promise<PendingSermonRow[]> {
    return this.prisma.withoutScope(
      (tx) =>
        tx.$queryRaw<PendingSermonRow[]>`
        SELECT d."id"          AS document_id,
               d."tenant_id"   AS tenant_id,
               d."content"     AS content,
               d."title"       AS title
        FROM "ai_documents" d
        WHERE d."source_type" = 'SERMON'::"AiSourceType"
          AND d."status" IN ('PENDING', 'FAILED', 'STALE', 'PROCESSING')
          AND d."content" IS NOT NULL
          AND length(d."content") > 0
        ORDER BY d."updated_at" ASC
        LIMIT ${limit}
      `,
    );
  }

  async indexSermon(source: PendingSermonRow): Promise<IndexingOutcome> {
    const text = source.content?.trim() ?? '';
    if (text.length === 0) {
      await this.markPartial(source.tenant_id, source.document_id, AiIndexBlockedReason.NO_TEXT_CONTENT);
      return { documentId: source.document_id, status: 'PARTIAL', chunkCount: 0, reason: AiIndexBlockedReason.NO_TEXT_CONTENT };
    }
    const chunks = chunkText(text);
    try {
      const modelId = await this.ensureEmbeddingModel(source.tenant_id);
      const chunkIds = await this.replaceChunks(source.tenant_id, source.document_id, chunks);
      const vectors = await this.embedChunks(chunks.map((chunk) => chunk.content));
      await this.storeEmbeddings(source.tenant_id, modelId, chunkIds, vectors);
      await this.markIndexed(source.tenant_id, source.document_id, modelId, chunks);
      return { documentId: source.document_id, status: 'INDEXED', chunkCount: chunks.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.markFailed(source.tenant_id, source.document_id, message);
      throw error;
    }
  }

  /** Index one source. Idempotent: re-running replaces the projection in place. */
  async indexSource(source: PendingSourceRow): Promise<IndexingOutcome> {
    const tenantId = source.tenant_id;
    const readable = isTextReadable(
      source.detected_content_type ?? source.declared_content_type,
      source.file_name,
    );

    const bytes = await this.storage.get(source.storage_key);
    const text = readable ? decodeText(bytes) : '';
    const chunks = text.length > 0 ? chunkText(text) : [];

    const documentId = await this.upsertDocument(source, chunks.length > 0 ? text : null);

    if (chunks.length === 0) {
      // Nothing to index. Record why, so an operator can see that this source is
      // waiting on extraction rather than wondering why search cannot find it.
      const reason = readable
        ? AiIndexBlockedReason.NO_TEXT_CONTENT
        : AiIndexBlockedReason.EXTRACTION_NOT_CONFIGURED;
      await this.markPartial(tenantId, documentId, reason);
      this.logger.warn(
        `Index document ${documentId} settled as PARTIAL: ${reason}`,
        'AiIndexService',
      );
      return { documentId, status: 'PARTIAL', chunkCount: 0, reason };
    }

    try {
      const modelId = await this.ensureEmbeddingModel(tenantId);
      const chunkIds = await this.replaceChunks(tenantId, documentId, chunks);
      const vectors = await this.embedChunks(chunks.map((chunk) => chunk.content));
      await this.storeEmbeddings(tenantId, modelId, chunkIds, vectors);
      await this.markIndexed(tenantId, documentId, modelId, chunks);
      return { documentId, status: 'INDEXED', chunkCount: chunks.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.markFailed(tenantId, documentId, message);
      throw error;
    }
  }

  private async upsertDocument(source: PendingSourceRow, content: string | null): Promise<string> {
    const data = {
      title: source.title.slice(0, 300),
      kind: source.kind,
      content,
      contentHash: source.sha256,
      occurredAt: source.captured_at,
      charCount: content?.length ?? 0,
      sourceVersionId: source.version_id,
      status: 'PROCESSING' as const,
      lastError: null,
    };

    const row = await this.prisma.withTenant(source.tenant_id, (tx) =>
      tx.aiDocument.upsert({
        where: {
          tenantId_sourceType_sourceId_versionKey: {
            tenantId: source.tenant_id,
            sourceType: SOURCE_TYPE,
            sourceId: source.artifact_id,
            versionKey: source.version_id,
          },
        },
        create: {
          tenantId: source.tenant_id,
          sourceType: SOURCE_TYPE,
          sourceId: source.artifact_id,
          versionKey: source.version_id,
          ...data,
        },
        update: data,
        select: { id: true },
      }),
    );
    return row.id;
  }

  private async ensureEmbeddingModel(tenantId: string): Promise<string> {
    const provider = this.embeddings.provider;
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.aiEmbeddingModel.upsert({
        where: {
          tenantId_provider_model_revision: {
            tenantId,
            provider,
            model: this.embeddings.model,
            revision: '',
          },
        },
        create: {
          tenantId,
          provider,
          model: this.embeddings.model,
          revision: '',
          dimensions: this.embeddings.dimensions,
          isDefault: true,
        },
        update: { isActive: true, dimensions: this.embeddings.dimensions },
        select: { id: true },
      }),
    );
    return row.id;
  }

  private async replaceChunks(
    tenantId: string,
    documentId: string,
    chunks: ReturnType<typeof chunkText>,
  ): Promise<string[]> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      // Replacing rather than diffing: a chunk has no meaning independent of the
      // document text it came from, so a new text means new chunks.
      await tx.aiChunk.deleteMany({ where: { documentId } });
      await tx.aiChunk.createMany({
        data: chunks.map((chunk) => ({
          tenantId,
          documentId,
          ordinal: chunk.ordinal,
          content: chunk.content,
          contentHash: chunk.contentHash,
          tokenCount: chunk.tokenCount,
          charStart: chunk.charStart,
          charEnd: chunk.charEnd,
        })),
      });
      const rows = await tx.aiChunk.findMany({
        where: { documentId },
        orderBy: { ordinal: 'asc' },
        select: { id: true },
      });
      return rows.map((row) => row.id);
    });
  }

  private async embedChunks(inputs: string[]): Promise<number[][]> {
    const result = await this.embeddings.embed({ inputs, purpose: 'document' });
    if (result.vectors.length !== inputs.length) {
      throw new Error('Embedding provider returned the wrong number of vectors');
    }
    return result.vectors;
  }

  private async storeEmbeddings(
    tenantId: string,
    modelId: string,
    chunkIds: string[],
    vectors: number[][],
  ): Promise<void> {
    const values = Prisma.join(
      chunkIds.map(
        (chunkId, index) =>
          Prisma.sql`(${chunkId}::uuid, ${toVectorLiteral(vectors[index]!)}::vector)`,
      ),
    );

    await this.prisma.withTenant(
      tenantId,
      (tx) =>
        tx.$executeRaw`
        INSERT INTO "ai_chunk_embeddings" ("id", "tenant_id", "chunk_id", "model_id", "embedding")
        SELECT gen_random_uuid(), ${tenantId}::uuid, v."chunk_id", ${modelId}::uuid, v."embedding"
        FROM (VALUES ${values}) AS v("chunk_id", "embedding")
      `,
    );
  }

  private async markPartial(tenantId: string, documentId: string, reason: string): Promise<void> {
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.aiDocument.update({
        where: { id: documentId },
        data: { status: 'PARTIAL', chunkCount: 0, tokenCount: 0, lastError: reason },
      }),
    );
  }

  private async markIndexed(
    tenantId: string,
    documentId: string,
    modelId: string,
    chunks: ReturnType<typeof chunkText>,
  ): Promise<void> {
    const tokenCount = chunks.reduce((total, chunk) => total + chunk.tokenCount, 0);
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.aiDocument.update({
        where: { id: documentId },
        data: {
          status: 'INDEXED',
          chunkCount: chunks.length,
          tokenCount,
          embeddingModelId: modelId,
          indexedAt: new Date(),
          lastError: null,
        },
      }),
    );
  }

  private async markFailed(tenantId: string, documentId: string, message: string): Promise<void> {
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.aiDocument.update({
        where: { id: documentId },
        data: { status: 'FAILED', lastError: message.slice(0, 4000) },
      }),
    );
  }
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(',')}]`;
}
