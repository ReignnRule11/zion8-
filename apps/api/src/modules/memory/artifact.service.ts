import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ALLOWED_ARTIFACT_TYPES,
  MAX_ARTIFACT_BYTES,
  type MemoryArtifactCreateRequest,
  type MemoryArtifactDownload,
  type MemoryArtifactListQuery,
  type MemoryArtifactLinkRequest,
  type MemoryArtifactPage,
  type MemoryArtifactResponse,
  type MemoryArtifactUpdateRequest,
  type MemoryJobSummary,
  type MemoryReprocessRequest,
  type MemoryReprocessResponse,
  type MemoryStage,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { AppConfigService } from '../../common/config/app-config.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OBJECT_STORAGE, type ObjectStorage } from '../../infrastructure/storage/object-storage.port';
import { OutboxService } from '../../infrastructure/events/outbox.service';
import {
  checksumOf,
  detectContentType,
  memoryStorageKey,
  pageArgs,
  toJobSummary,
  toResponse,
  toSummary,
} from './memory.utils';

const DOWNLOAD_TTL_SECONDS = 300;

/** Kinds whose meaning is carried by audio or video, so they need transcription. */
const MEDIA_KINDS = new Set(['AUDIO', 'VIDEO', 'SERMON', 'WORSHIP_SET']);

const INCLUDES = {
  tags: true,
  versions: true,
  links: true,
} satisfies Prisma.MemoryArtifactInclude;

type ArtifactWithRelations = Prisma.MemoryArtifactGetPayload<{ include: typeof INCLUDES }>;
type ArtifactWithTagsAndVersions = Prisma.MemoryArtifactGetPayload<{
  include: { tags: true; versions: true };
}>;

/**
 * The archive.
 *
 * Ingest is deliberately simple and synchronous where it can be: bytes are
 * validated and written to object storage, then a row is committed together with
 * its outbox event and a metadata job. The worker does the part that can fail or
 * be slow, so a large upload never holds a database transaction open.
 */
@Injectable()
export class ArtifactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly config: AppConfigService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async create(
    tenantId: string,
    actorUserId: string,
    input: MemoryArtifactCreateRequest,
  ): Promise<MemoryArtifactResponse> {
    if (!ALLOWED_ARTIFACT_TYPES.includes(input.contentType)) {
      throw new DomainError(
        'MEMORY_ARTIFACT_TYPE_UNSUPPORTED',
        `Files of type ${input.contentType} cannot be stored`,
      );
    }

    const bytes = Buffer.from(input.contentBase64, 'base64');
    if (bytes.byteLength === 0) {
      throw new DomainError('MEMORY_ARTIFACT_TYPE_UNSUPPORTED', 'The uploaded file was empty');
    }
    if (bytes.byteLength > MAX_ARTIFACT_BYTES) {
      throw new DomainError(
        'MEMORY_ARTIFACT_TOO_LARGE',
        `Artifacts must be ${Math.floor(MAX_ARTIFACT_BYTES / 1024)} KiB or smaller`,
      );
    }

    const declaredType = input.contentType;
    const detectedType = detectContentType(bytes);
    const contentType = detectedType ?? declaredType;
    if (!ALLOWED_ARTIFACT_TYPES.includes(contentType)) {
      throw new DomainError(
        'MEMORY_ARTIFACT_TYPE_UNSUPPORTED',
        `Files of type ${contentType} cannot be stored`,
      );
    }

    const sha256 = checksumOf(bytes);
    const storageKey = memoryStorageKey(tenantId, sha256);
    let sizeBytes = bytes.byteLength;
    if (!(await this.storage.exists(storageKey))) {
      const stored = await this.storage.put(storageKey, bytes);
      sizeBytes = stored.sizeBytes;
    }

    const versionId = randomUUID();
    const artifactId = randomUUID();
    const capturedAt = input.capturedAt ? new Date(input.capturedAt) : null;

    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const duplicate = await tx.memoryArtifactVersion.findFirst({
        where: { tenantId, sha256, isCurrent: true },
        select: { artifactId: true },
      });

      const artifact = await tx.memoryArtifact.create({
        data: {
          id: artifactId,
          tenantId,
          kind: input.kind,
          status: 'PROCESSING',
          origin: 'UPLOAD',
          title: input.title,
          description: input.description ?? null,
          capturedAt,
          datePrecision: input.datePrecision,
          currentVersionId: versionId,
          duplicateOfArtifactId: duplicate?.artifactId ?? null,
          createdByUserId: actorUserId,
        },
      });

      await tx.memoryArtifactVersion.create({
        data: {
          id: versionId,
          tenantId,
          artifactId,
          version: 1,
          sha256,
          sizeBytes: BigInt(sizeBytes),
          fileName: input.fileName,
          declaredContentType: declaredType,
          detectedContentType: null,
          storageKey,
          isCurrent: true,
          createdByUserId: actorUserId,
        },
      });

      if (input.tags.length > 0) {
        await tx.memoryArtifactTag.createMany({
          data: [...new Set(input.tags)].map((tag) => ({
            id: randomUUID(),
            tenantId,
            artifactId,
            tag,
          })),
        });
      }

      if (input.links.length > 0) {
        await tx.memoryArtifactLink.createMany({
          data: input.links.map((link) => ({
            id: randomUUID(),
            tenantId,
            artifactId,
            linkType: link.linkType,
            linkId: link.linkId,
            createdByUserId: actorUserId,
          })),
        });
      }

      await tx.memoryProcessingJob.create({
        data: {
          id: randomUUID(),
          tenantId,
          artifactId,
          versionId,
          type: 'METADATA',
          priority: 50,
          dedupeKey: `METADATA:${versionId}`,
        },
      });

      await this.outbox.enqueue(tx, {
        id: randomUUID(),
        tenantId,
        type: 'memory.artifact.created',
        aggregateType: 'memory_artifact',
        aggregateId: artifactId,
        payload: {
          artifactId,
          versionId,
          kind: input.kind,
          contentType,
          sizeBytes,
          sha256,
          tags: input.tags,
          links: input.links,
        },
        headers: { 'x-zion8-event-version': 1 },
        occurredAt: new Date().toISOString(),
      });

      return tx.memoryArtifact.findUniqueOrThrow({
        where: { id: artifact.id },
        include: INCLUDES,
      });
    });

    return toResponse(row);
  }

  async list(tenantId: string, query: MemoryArtifactListQuery): Promise<MemoryArtifactPage> {
    const where: Prisma.MemoryArtifactWhereInput = {
      tenantId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.tag ? { tags: { some: { tag: query.tag } } } : {}),
      ...(query.linkType && query.linkId
        ? { links: { some: { linkType: query.linkType, linkId: query.linkId } } }
        : {}),
      ...(query.from || query.to
        ? {
            capturedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...statusFilter(query),
    };

    const { skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.memoryArtifact.findMany({
          where,
          include: { tags: true, versions: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        tx.memoryArtifact.count({ where }),
      ]),
    );

    return {
      items: (rows as ArtifactWithTagsAndVersions[]).map(toSummary),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async get(tenantId: string, artifactId: string): Promise<MemoryArtifactResponse> {
    return toResponse(await this.findRow(tenantId, artifactId));
  }

  async update(
    tenantId: string,
    artifactId: string,
    input: MemoryArtifactUpdateRequest,
  ): Promise<MemoryArtifactResponse> {
    await this.findRow(tenantId, artifactId);

    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      if (input.tags !== undefined) {
        const tags = [...new Set(input.tags)];
        await tx.memoryArtifactTag.deleteMany({ where: { tenantId, artifactId } });
        if (tags.length > 0) {
          await tx.memoryArtifactTag.createMany({
            data: tags.map((tag) => ({ id: randomUUID(), tenantId, artifactId, tag })),
          });
        }
      }

      await tx.memoryArtifact.update({
        where: { id: artifactId },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.kind !== undefined ? { kind: input.kind } : {}),
          ...(input.datePrecision !== undefined ? { datePrecision: input.datePrecision } : {}),
          ...(input.capturedAt !== undefined
            ? { capturedAt: input.capturedAt ? new Date(input.capturedAt) : null }
            : {}),
        },
      });

      return tx.memoryArtifact.findUniqueOrThrow({
        where: { id: artifactId },
        include: INCLUDES,
      });
    });

    return toResponse(row);
  }

  async archive(
    tenantId: string,
    artifactId: string,
    actorUserId: string,
  ): Promise<MemoryArtifactResponse> {
    const existing = await this.findRow(tenantId, artifactId);

    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      await tx.memoryArtifact.update({
        where: { id: artifactId },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });

      await this.outbox.enqueue(tx, {
        id: randomUUID(),
        tenantId,
        type: 'memory.artifact.archived',
        aggregateType: 'memory_artifact',
        aggregateId: artifactId,
        payload: { artifactId, previousStatus: existing.status, archivedByUserId: actorUserId },
        headers: { 'x-zion8-event-version': 1 },
        occurredAt: new Date().toISOString(),
      });

      return tx.memoryArtifact.findUniqueOrThrow({
        where: { id: artifactId },
        include: INCLUDES,
      });
    });

    return toResponse(row);
  }

  async addLink(
    tenantId: string,
    actorUserId: string,
    artifactId: string,
    link: MemoryArtifactLinkRequest,
  ): Promise<MemoryArtifactResponse> {
    await this.findRow(tenantId, artifactId);

    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.memoryArtifactLink.findFirst({
        where: { tenantId, artifactId, linkType: link.linkType, linkId: link.linkId },
      });
      if (existing) {
        throw new DomainError('MEMORY_LINK_EXISTS', 'That item is already linked to this artifact');
      }

      await tx.memoryArtifactLink.create({
        data: {
          id: randomUUID(),
          tenantId,
          artifactId,
          linkType: link.linkType,
          linkId: link.linkId,
          createdByUserId: actorUserId,
        },
      });

      return tx.memoryArtifact.findUniqueOrThrow({
        where: { id: artifactId },
        include: INCLUDES,
      });
    });

    return toResponse(row);
  }

  async removeLink(
    tenantId: string,
    artifactId: string,
    linkId: string,
  ): Promise<MemoryArtifactResponse> {
    await this.findRow(tenantId, artifactId);

    const row = await this.prisma.withTenant(tenantId, async (tx) => {
      const link = await tx.memoryArtifactLink.findFirst({ where: { tenantId, artifactId, id: linkId } });
      if (!link) {
        throw new DomainError('MEMORY_LINK_NOT_FOUND', 'That link could not be found');
      }
      await tx.memoryArtifactLink.delete({ where: { id: linkId } });
      return tx.memoryArtifact.findUniqueOrThrow({
        where: { id: artifactId },
        include: INCLUDES,
      });
    });

    return toResponse(row);
  }

  /**
   * Ask the engine to run stages that need an external capability. The request is
   * idempotent: an existing pending or running job of the same type is returned
   * unchanged, and a blocked or failed one is requeued.
   */
  async reprocess(
    tenantId: string,
    artifactId: string,
    input: MemoryReprocessRequest,
  ): Promise<MemoryReprocessResponse> {
    const artifact = await this.findRow(tenantId, artifactId);
    if (!artifact.currentVersionId) {
      throw new DomainError('MEMORY_ARTIFACT_VERSION_NOT_FOUND', 'This artifact has no stored version');
    }

    const stages = input.stages ?? defaultStages(artifact.kind);

    const jobs = await this.prisma.withTenant(tenantId, async (tx) => {
      const results = [];
      for (const stage of stages) {
        const dedupeKey = `${stage}:${artifact.currentVersionId}`;
        const existing = await tx.memoryProcessingJob.findFirst({
          where: { tenantId, dedupeKey },
        });

        if (existing) {
          if (existing.status === 'BLOCKED' || existing.status === 'FAILED') {
            results.push(
              await tx.memoryProcessingJob.update({
                where: { id: existing.id },
                data: {
                  status: 'PENDING',
                  attempts: 0,
                  availableAt: new Date(),
                  blockedReason: null,
                  lastError: null,
                  startedAt: null,
                  completedAt: null,
                },
              }),
            );
          } else {
            results.push(existing);
          }
          continue;
        }

        results.push(
          await tx.memoryProcessingJob.create({
            data: {
              id: randomUUID(),
              tenantId,
              artifactId,
              versionId: artifact.currentVersionId,
              type: stage,
              dedupeKey,
            },
          }),
        );
      }
      return results;
    });

    return { artifactId, jobs: jobs.map(toJobSummary) };
  }

  async listJobs(tenantId: string, artifactId: string): Promise<MemoryJobSummary[]> {
    await this.findRow(tenantId, artifactId);
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.memoryProcessingJob.findMany({
        where: { tenantId, artifactId },
        orderBy: { createdAt: 'asc' },
      }),
    );
    return rows.map(toJobSummary);
  }

  async download(
    tenantId: string,
    artifactId: string,
    versionId?: string,
  ): Promise<MemoryArtifactDownload> {
    const artifact = await this.findRow(tenantId, artifactId);
    const version = pickVersion(artifact, versionId);
    return {
      artifactId,
      versionId: version.id,
      url: `${this.config.appBaseUrl}/api/v1/memory/artifacts/${artifactId}/content${
        versionId ? `?versionId=${versionId}` : ''
      }`,
      expiresInSeconds: DOWNLOAD_TTL_SECONDS,
    };
  }

  async content(
    tenantId: string,
    artifactId: string,
    versionId?: string,
  ): Promise<{ bytes: Buffer; contentType: string; fileName: string }> {
    const artifact = await this.findRow(tenantId, artifactId);
    const version = pickVersion(artifact, versionId);
    const bytes = await this.storage.get(version.storageKey);
    return {
      bytes,
      contentType: version.detectedContentType ?? version.declaredContentType,
      fileName: version.fileName,
    };
  }

  /** Exposed so the worker can resolve the tenant of a claimed job. */
  async loadVersionContext(
    tenantId: string,
    artifactId: string,
    versionId: string | null,
  ): Promise<{ artifactId: string; versionId: string; storageKey: string }> {
    const artifact = await this.findRow(tenantId, artifactId);
    const version = pickVersion(artifact, versionId ?? undefined);
    return { artifactId, versionId: version.id, storageKey: version.storageKey };
  }

  /** Used by the worker to persist what metadata sniffing learned. */
  async applyDetectedType(
    tenantId: string,
    versionId: string,
    detectedContentType: string,
  ): Promise<void> {
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.memoryArtifactVersion.update({
        where: { id: versionId },
        data: { detectedContentType },
      }),
    );
  }

  async markStatus(
    tenantId: string,
    artifactId: string,
    status: MemoryArtifactResponse['status'],
  ): Promise<void> {
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.memoryArtifact.update({ where: { id: artifactId }, data: { status } }),
    );
  }

  private async findRow(tenantId: string, artifactId: string): Promise<ArtifactWithRelations> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.memoryArtifact.findFirst({ where: { id: artifactId, tenantId }, include: INCLUDES }),
    );
    if (!row) throw new DomainError('MEMORY_ARTIFACT_NOT_FOUND', 'That memory could not be found');
    return row;
  }
}

function pickVersion(
  artifact: ArtifactWithRelations,
  versionId?: string,
): ArtifactWithRelations['versions'][number] {
  if (versionId) {
    const version = artifact.versions.find((candidate) => candidate.id === versionId);
    if (!version) {
      throw new DomainError(
        'MEMORY_ARTIFACT_VERSION_NOT_FOUND',
        'That version of the memory could not be found',
      );
    }
    return version;
  }
  const current = artifact.versions.find((candidate) => candidate.isCurrent);
  if (!current) {
    throw new DomainError('MEMORY_ARTIFACT_UNAVAILABLE', 'This memory has no stored file');
  }
  return current;
}

function statusFilter(query: MemoryArtifactListQuery): Prisma.MemoryArtifactWhereInput {
  if (query.status) {
    return { status: query.status };
  }
  if (query.includeArchived) {
    return {};
  }
  return { status: { not: 'ARCHIVED' } };
}

/**
 * Which stages an artifact needs beyond metadata. Photographs and documents need
 * recognition; recordings need transcription. The worker turns each into a
 * BLOCKED job when the capability is not configured rather than pretending the
 * work happened.
 */
function defaultStages(kind: MemoryArtifactResponse['kind']): MemoryStage[] {
  return MEDIA_KINDS.has(kind) ? ['TRANSCRIBE'] : ['EXTRACT'];
}
