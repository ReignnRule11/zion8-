import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ALLOWED_SERMON_MEDIA_TYPES,
  MAX_SERMON_MEDIA_BYTES,
  type SermonCreateRequest,
  type SermonGenerateKind,
  type SermonGenerateResponse,
  type SermonJobSummary,
  type SermonListQuery,
  type SermonMedia,
  type SermonNote,
  type SermonNoteCreateRequest,
  type SermonNoteListQuery,
  type SermonNotePage,
  type SermonNoteUpdateRequest,
  type SermonPage,
  type SermonPublishRequest,
  type SermonRecommendationPage,
  type SermonReprocessRequest,
  type SermonReprocessResponse,
  type SermonResponse,
  type SermonSearchQuery,
  type SermonSeriesCreateRequest,
  type SermonSeriesListQuery,
  type SermonSeriesPage,
  type SermonSeriesResponse,
  type SermonSeriesUpdateRequest,
  type SermonShare,
  type SermonShareCreateRequest,
  type SermonTranscript,
  type SermonTranscriptUpsertRequest,
  type SermonUpdateRequest,
} from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import { AppConfigService } from '../../common/config/app-config.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { OutboxService } from '../../infrastructure/events/outbox.service';
import { ArtifactService } from '../memory/artifact.service';
import { SermonPipelineService } from './sermon-pipeline.service';
import {
  mediaKindOf,
  pageArgs,
  parseDateOnly,
  rfc822,
  shareToken,
  slugify,
  toJobSummary,
  toNote,
  toSermonResponse,
  toSermonSummary,
  toSeriesResponse,
  toSeriesSummary,
  toShare,
  toTranscript,
  uniqueSlug,
  xmlEscape,
} from './sermon.utils';

const LIST_INCLUDE = {
  tags: true,
  series: { select: { id: true, slug: true, title: true } },
  _count: { select: { scriptures: true, chapters: true } },
} satisfies Prisma.SermonInclude;

const DETAIL_INCLUDE = {
  tags: true,
  series: { select: { id: true, slug: true, title: true } },
  chapters: true,
  scriptures: true,
  insight: true,
  transcripts: { include: { segments: true } },
  jobs: true,
  _count: { select: { scriptures: true, chapters: true } },
} satisfies Prisma.SermonInclude;

const SERIES_INCLUDE = {
  _count: { select: { sermons: true } },
} satisfies Prisma.SermonSeriesInclude;

type SermonDetailRow = Prisma.SermonGetPayload<{ include: typeof DETAIL_INCLUDE }>;

/**
 * The sermon bounded context.
 *
 * Publishing, series, notes and shares live here. Bytes never do: media is an
 * artifact in Memory, linked by `mediaArtifactId`. Derived study fields come
 * from the pipeline so a worker, a generate request and a manual transcript
 * all take the same path.
 */
@Injectable()
export class SermonService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly artifacts: ArtifactService,
    private readonly pipeline: SermonPipelineService,
    private readonly config: AppConfigService,
  ) {}

  async createSeries(
    tenantId: string,
    input: SermonSeriesCreateRequest,
  ): Promise<SermonSeriesResponse> {
    const slug = await this.allocateSeriesSlug(tenantId, input.slug ?? slugify(input.title));
    try {
      const row = await this.prisma.withTenant(tenantId, (tx) =>
        tx.sermonSeries.create({
          data: {
            tenantId,
            slug,
            title: input.title,
            subtitle: input.subtitle ?? null,
            description: input.description ?? null,
            visibility: input.visibility,
            startsOn: parseDateOnly(input.startsOn),
            endsOn: parseDateOnly(input.endsOn),
          },
          include: SERIES_INCLUDE,
        }),
      );
      return toSeriesResponse(row);
    } catch (error) {
      throw translateSermonError(error);
    }
  }

  async listSeries(tenantId: string, query: SermonSeriesListQuery): Promise<SermonSeriesPage> {
    const where: Prisma.SermonSeriesWhereInput = {
      tenantId,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { subtitle: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.includeArchived ? {} : { archivedAt: null }),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.sermonSeries.findMany({
          where,
          include: SERIES_INCLUDE,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        tx.sermonSeries.count({ where }),
      ]),
    );
    return {
      items: rows.map(toSeriesSummary),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async getSeries(tenantId: string, seriesId: string): Promise<SermonSeriesResponse> {
    return toSeriesResponse(await this.requireSeries(tenantId, seriesId));
  }

  async updateSeries(
    tenantId: string,
    seriesId: string,
    input: SermonSeriesUpdateRequest,
  ): Promise<SermonSeriesResponse> {
    await this.requireSeries(tenantId, seriesId);
    if (input.slug) {
      await this.assertSeriesSlugFree(tenantId, input.slug, seriesId);
    }
    try {
      const row = await this.prisma.withTenant(tenantId, (tx) =>
        tx.sermonSeries.update({
          where: { id: seriesId },
          data: {
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.slug !== undefined ? { slug: input.slug } : {}),
            ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
            ...(input.startsOn !== undefined ? { startsOn: parseDateOnly(input.startsOn) } : {}),
            ...(input.endsOn !== undefined ? { endsOn: parseDateOnly(input.endsOn) } : {}),
          },
          include: SERIES_INCLUDE,
        }),
      );
      return toSeriesResponse(row);
    } catch (error) {
      throw translateSermonError(error);
    }
  }

  async archiveSeries(tenantId: string, seriesId: string): Promise<SermonSeriesResponse> {
    await this.requireSeries(tenantId, seriesId);
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermonSeries.update({
        where: { id: seriesId },
        data: { archivedAt: new Date() },
        include: SERIES_INCLUDE,
      }),
    );
    return toSeriesResponse(row);
  }

  async create(
    tenantId: string,
    actorUserId: string,
    input: SermonCreateRequest,
  ): Promise<SermonResponse> {
    if (input.seriesId) await this.requireSeries(tenantId, input.seriesId);
    const slug = await this.allocateSermonSlug(tenantId, input.slug ?? slugify(input.title));

    let mediaArtifactId: string | null = null;
    let mediaKind: SermonMedia['kind'] = 'NONE';

    if (input.artifactId) {
      const artifact = await this.artifacts.get(tenantId, input.artifactId);
      const contentType = artifact.currentVersion?.detectedContentType
        ?? artifact.currentVersion?.declaredContentType
        ?? null;
      if (contentType && !ALLOWED_SERMON_MEDIA_TYPES.includes(contentType)) {
        throw new DomainError(
          'SERMON_MEDIA_TYPE_UNSUPPORTED',
          `Files of type ${contentType} cannot be attached to a sermon`,
        );
      }
      mediaArtifactId = artifact.id;
      mediaKind = mediaKindOf(contentType);
    } else if (input.fileName && input.contentType && input.contentBase64) {
      if (!ALLOWED_SERMON_MEDIA_TYPES.includes(input.contentType)) {
        throw new DomainError(
          'SERMON_MEDIA_TYPE_UNSUPPORTED',
          `Files of type ${input.contentType} cannot be attached to a sermon`,
        );
      }
      const decoded = Buffer.from(input.contentBase64, 'base64');
      if (decoded.byteLength === 0 || decoded.byteLength > MAX_SERMON_MEDIA_BYTES) {
        throw new DomainError(
          'SERMON_MEDIA_TYPE_UNSUPPORTED',
          'The uploaded sermon media was empty or too large',
        );
      }
      const artifact = await this.artifacts.create(tenantId, actorUserId, {
        title: input.title,
        kind: 'SERMON',
        description: input.description,
        capturedAt: input.preachedAt,
        datePrecision: input.preachedAt ? 'DAY' : 'UNKNOWN',
        tags: input.tags,
        links: [],
        fileName: input.fileName,
        contentType: input.contentType,
        contentBase64: input.contentBase64,
      });
      mediaArtifactId = artifact.id;
      mediaKind = mediaKindOf(
        artifact.currentVersion?.detectedContentType ?? artifact.currentVersion?.declaredContentType,
      );
    }

    const hasTranscript = Boolean(input.transcriptText);
    const initialStatus = hasTranscript || mediaKind !== 'NONE' ? 'PROCESSING' : 'DRAFT';

    try {
      const sermonId = randomUUID();
      await this.prisma.withTenant(tenantId, async (tx) => {
        await tx.sermon.create({
          data: {
            id: sermonId,
            tenantId,
            seriesId: input.seriesId ?? null,
            slug,
            title: input.title,
            subtitle: input.subtitle ?? null,
            description: input.description ?? null,
            speakerName: input.speakerName ?? null,
            speakerMemberId: input.speakerMemberId ?? null,
            preachedAt: input.preachedAt ? new Date(input.preachedAt) : null,
            location: input.location ?? null,
            language: input.language,
            status: initialStatus,
            visibility: input.visibility,
            mediaKind,
            mediaArtifactId,
            transcriptStatus: hasTranscript ? 'READY' : mediaKind === 'NONE' ? 'NONE' : 'PENDING',
            summaryStatus: hasTranscript ? 'PENDING' : 'NONE',
            createdByUserId: actorUserId,
          },
        });

        if (input.tags.length > 0) {
          await tx.sermonTag.createMany({
            data: [...new Set(input.tags)].map((tag) => ({
              id: randomUUID(),
              tenantId,
              sermonId,
              tag,
            })),
          });
        }

        if (mediaArtifactId) {
          const existingLink = await tx.memoryArtifactLink.findFirst({
            where: { tenantId, artifactId: mediaArtifactId, linkType: 'SERMON', linkId: sermonId },
          });
          if (!existingLink) {
            await tx.memoryArtifactLink.create({
              data: {
                id: randomUUID(),
                tenantId,
                artifactId: mediaArtifactId,
                linkType: 'SERMON',
                linkId: sermonId,
                createdByUserId: actorUserId,
              },
            });
          }
        }

        await this.outbox.enqueue(tx, {
          id: randomUUID(),
          tenantId,
          type: 'sermon.created',
          aggregateType: 'sermon',
          aggregateId: sermonId,
          payload: {
            sermonId,
            slug,
            mediaArtifactId,
            mediaKind,
            hasTranscript,
          },
          headers: { 'x-zion8-event-version': 1 },
          occurredAt: new Date().toISOString(),
        });

        return tx.sermon.findUniqueOrThrow({
          where: { id: sermonId },
          include: DETAIL_INCLUDE,
        });
      });

      if (input.transcriptText) {
        await this.pipeline.writeTranscript(tenantId, sermonId, {
          language: input.language,
          text: input.transcriptText,
          source: 'MANUAL',
        });
      }

      const stages = this.pipeline.defaultStages(hasTranscript, mediaKind);
      if (stages.length > 0) {
        await this.pipeline.enqueue(tenantId, sermonId, stages);
      }

      return this.toDetail(tenantId, await this.requireSermon(tenantId, sermonId));
    } catch (error) {
      throw translateSermonError(error);
    }
  }

  async list(tenantId: string, query: SermonListQuery): Promise<SermonPage> {
    const where = this.listWhere(tenantId, query);
    const { skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.sermon.findMany({
          where,
          include: LIST_INCLUDE,
          orderBy: [{ preachedAt: 'desc' }, { createdAt: 'desc' }],
          skip,
          take,
        }),
        tx.sermon.count({ where }),
      ]),
    );
    return {
      items: rows.map(toSermonSummary),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async search(tenantId: string, query: SermonSearchQuery): Promise<SermonPage> {
    const where: Prisma.SermonWhereInput = {
      tenantId,
      archivedAt: null,
      OR: [
        { title: { contains: query.q, mode: 'insensitive' } },
        { subtitle: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        { speakerName: { contains: query.q, mode: 'insensitive' } },
        { transcripts: { some: { isCurrent: true, text: { contains: query.q, mode: 'insensitive' } } } },
        { tags: { some: { tag: { contains: query.q, mode: 'insensitive' } } } },
        { scriptures: { some: { reference: { contains: query.q, mode: 'insensitive' } } } },
      ],
      ...(query.seriesId ? { seriesId: query.seriesId } : {}),
      ...(query.speaker
        ? { speakerName: { contains: query.speaker, mode: 'insensitive' } }
        : {}),
      ...(query.tag ? { tags: { some: { tag: query.tag } } } : {}),
    };
    const { skip, take } = pageArgs(query);
    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.sermon.findMany({
          where,
          include: LIST_INCLUDE,
          orderBy: [{ preachedAt: 'desc' }, { createdAt: 'desc' }],
          skip,
          take,
        }),
        tx.sermon.count({ where }),
      ]),
    );
    return {
      items: rows.map(toSermonSummary),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async get(tenantId: string, sermonId: string): Promise<SermonResponse> {
    return this.toDetail(tenantId, await this.requireSermon(tenantId, sermonId));
  }

  async update(
    tenantId: string,
    sermonId: string,
    input: SermonUpdateRequest,
  ): Promise<SermonResponse> {
    const existing = await this.requireSermon(tenantId, sermonId);
    this.assertMutable(existing);
    if (input.seriesId) await this.requireSeries(tenantId, input.seriesId);
    if (input.slug && input.slug !== existing.slug) {
      await this.assertSermonSlugFree(tenantId, input.slug, sermonId);
    }

    try {
      await this.prisma.withTenant(tenantId, async (tx) => {
        if (input.tags !== undefined) {
          const tags = [...new Set(input.tags)];
          await tx.sermonTag.deleteMany({ where: { tenantId, sermonId } });
          if (tags.length > 0) {
            await tx.sermonTag.createMany({
              data: tags.map((tag) => ({ id: randomUUID(), tenantId, sermonId, tag })),
            });
          }
        }
        await tx.sermon.update({
          where: { id: sermonId },
          data: {
            ...(input.title !== undefined ? { title: input.title } : {}),
            ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.slug !== undefined ? { slug: input.slug } : {}),
            ...(input.seriesId !== undefined ? { seriesId: input.seriesId } : {}),
            ...(input.speakerName !== undefined ? { speakerName: input.speakerName } : {}),
            ...(input.speakerMemberId !== undefined
              ? { speakerMemberId: input.speakerMemberId }
              : {}),
            ...(input.preachedAt !== undefined
              ? { preachedAt: input.preachedAt ? new Date(input.preachedAt) : null }
              : {}),
            ...(input.location !== undefined ? { location: input.location } : {}),
            ...(input.language !== undefined ? { language: input.language } : {}),
            ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
          },
        });
      });
      return this.toDetail(tenantId, await this.requireSermon(tenantId, sermonId));
    } catch (error) {
      throw translateSermonError(error);
    }
  }

  async publish(
    tenantId: string,
    sermonId: string,
    input: SermonPublishRequest,
  ): Promise<SermonResponse> {
    const existing = await this.requireSermon(tenantId, sermonId);
    if (existing.status === 'ARCHIVED') {
      throw new DomainError('SERMON_ALREADY_ARCHIVED', 'An archived sermon cannot be published');
    }
    if (existing.status === 'PUBLISHED') {
      throw new DomainError('SERMON_ALREADY_PUBLISHED', 'This sermon is already published');
    }
    if (existing.status === 'DRAFT' && existing.mediaKind === 'NONE' && !existing.transcripts.some((row) => row.isCurrent)) {
      throw new DomainError(
        'SERMON_NOT_PUBLISHABLE',
        'Publish a sermon after attaching media or a transcript',
      );
    }
    if (existing.status === 'PROCESSING') {
      throw new DomainError(
        'SERMON_NOT_PUBLISHABLE',
        'Wait for processing to finish before publishing',
      );
    }

    await this.prisma.withTenant(tenantId, async (tx) => {
      await tx.sermon.update({
        where: { id: sermonId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          ...(input.visibility ? { visibility: input.visibility } : {}),
        },
      });
      await this.outbox.enqueue(tx, {
        id: randomUUID(),
        tenantId,
        type: 'sermon.published',
        aggregateType: 'sermon',
        aggregateId: sermonId,
        payload: { sermonId, visibility: input.visibility ?? existing.visibility },
        headers: { 'x-zion8-event-version': 1 },
        occurredAt: new Date().toISOString(),
      });
    });
    return this.toDetail(tenantId, await this.requireSermon(tenantId, sermonId));
  }

  async archive(tenantId: string, actorUserId: string, sermonId: string): Promise<SermonResponse> {
    const existing = await this.requireSermon(tenantId, sermonId);
    if (existing.status === 'ARCHIVED') {
      throw new DomainError('SERMON_ALREADY_ARCHIVED', 'This sermon is already archived');
    }
    await this.prisma.withTenant(tenantId, async (tx) => {
      await tx.sermon.update({
        where: { id: sermonId },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });
      await this.outbox.enqueue(tx, {
        id: randomUUID(),
        tenantId,
        type: 'sermon.archived',
        aggregateType: 'sermon',
        aggregateId: sermonId,
        payload: { sermonId, archivedByUserId: actorUserId },
        headers: { 'x-zion8-event-version': 1 },
        occurredAt: new Date().toISOString(),
      });
    });
    return this.toDetail(tenantId, await this.requireSermon(tenantId, sermonId));
  }

  async reprocess(
    tenantId: string,
    sermonId: string,
    input: SermonReprocessRequest,
  ): Promise<SermonReprocessResponse> {
    const existing = await this.requireSermon(tenantId, sermonId);
    this.assertMutable(existing);
    const hasTranscript = existing.transcripts.some((row) => row.isCurrent && row.text.trim().length > 0);
    const stages = input.stages ?? this.pipeline.defaultStages(hasTranscript, existing.mediaKind);
    if (stages.length === 0) {
      throw new DomainError(
        'SERMON_PIPELINE_BLOCKED',
        'There is nothing to process until media or a transcript is attached',
      );
    }
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermon.update({
        where: { id: sermonId },
        data: { status: existing.status === 'PUBLISHED' ? existing.status : 'PROCESSING' },
      }),
    );
    await this.pipeline.enqueue(tenantId, sermonId, stages);
    const jobs = await this.listJobs(tenantId, sermonId);
    return { sermonId, jobs };
  }

  async generate(
    tenantId: string,
    sermonId: string,
    kind: SermonGenerateKind,
  ): Promise<SermonGenerateResponse> {
    const existing = await this.requireSermon(tenantId, sermonId);
    this.assertMutable(existing);
    const outcome = await this.pipeline.generate(tenantId, sermonId, kind);
    if (outcome.status === 'BLOCKED') {
      throw new DomainError(
        'SERMON_PIPELINE_BLOCKED',
        outcome.reason === 'TRANSCRIPT_REQUIRED'
          ? 'A transcript is required before this can be generated'
          : `Pipeline blocked: ${outcome.reason}`,
      );
    }
    const row = await this.requireSermon(tenantId, sermonId);
    const detail = await this.toDetail(tenantId, row);
    return {
      sermonId,
      kind,
      insight: detail.insight,
      chapters: detail.chapters,
      tags: detail.tags,
    };
  }

  async upsertTranscript(
    tenantId: string,
    sermonId: string,
    input: SermonTranscriptUpsertRequest,
  ): Promise<SermonTranscript> {
    const existing = await this.requireSermon(tenantId, sermonId);
    this.assertMutable(existing);
    await this.pipeline.writeTranscript(tenantId, sermonId, {
      language: input.language,
      text: input.text,
      source: 'MANUAL',
    });
    await this.pipeline.enqueue(
      tenantId,
      sermonId,
      this.pipeline.defaultStages(true, existing.mediaKind),
    );
    const row = await this.requireSermon(tenantId, sermonId);
    const current = row.transcripts.find((transcript) => transcript.isCurrent);
    if (!current) {
      throw new DomainError('SERMON_NOT_FOUND', 'The transcript could not be saved');
    }
    return toTranscript(current);
  }

  async listJobs(tenantId: string, sermonId: string): Promise<SermonJobSummary[]> {
    await this.requireSermon(tenantId, sermonId);
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermonProcessingJob.findMany({
        where: { tenantId, sermonId },
        orderBy: { createdAt: 'asc' },
      }),
    );
    return rows.map(toJobSummary);
  }

  async recommendations(tenantId: string, sermonId: string): Promise<SermonRecommendationPage> {
    const existing = await this.requireSermon(tenantId, sermonId);
    const tags = existing.tags.map((row) => row.tag);
    const scriptures = existing.scriptures.map((row) => row.book);
    const where: Prisma.SermonWhereInput = {
      tenantId,
      id: { not: sermonId },
      archivedAt: null,
      status: { in: ['READY', 'PUBLISHED'] },
      OR: [
        ...(existing.seriesId ? [{ seriesId: existing.seriesId }] : []),
        ...(existing.speakerName
          ? [{ speakerName: { equals: existing.speakerName, mode: 'insensitive' as const } }]
          : []),
        ...(tags.length > 0 ? [{ tags: { some: { tag: { in: tags } } } }] : []),
        ...(scriptures.length > 0
          ? [{ scriptures: { some: { book: { in: scriptures } } } }]
          : []),
      ],
    };
    if (!where.OR || where.OR.length === 0) {
      return { sermonId, items: [] };
    }
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermon.findMany({
        where,
        include: LIST_INCLUDE,
        orderBy: [{ preachedAt: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      }),
    );
    return { sermonId, items: rows.map(toSermonSummary) };
  }

  async listNotes(
    tenantId: string,
    userId: string,
    sermonId: string,
    query: SermonNoteListQuery,
  ): Promise<SermonNotePage> {
    await this.requireSermon(tenantId, sermonId);
    const { skip, take } = pageArgs(query);
    const where = { tenantId, sermonId, userId };
    const [rows, total] = await this.prisma.withTenant(tenantId, (tx) =>
      Promise.all([
        tx.sermonNote.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        tx.sermonNote.count({ where }),
      ]),
    );
    return {
      items: rows.map(toNote),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createNote(
    tenantId: string,
    userId: string,
    sermonId: string,
    input: SermonNoteCreateRequest,
  ): Promise<SermonNote> {
    await this.requireSermon(tenantId, sermonId);
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermonNote.create({
        data: {
          tenantId,
          sermonId,
          userId,
          body: input.body,
          timestampMs: input.timestampMs ?? null,
        },
      }),
    );
    return toNote(row);
  }

  async updateNote(
    tenantId: string,
    userId: string,
    sermonId: string,
    noteId: string,
    input: SermonNoteUpdateRequest,
  ): Promise<SermonNote> {
    const note = await this.requireNote(tenantId, userId, sermonId, noteId);
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermonNote.update({
        where: { id: note.id },
        data: {
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.timestampMs !== undefined ? { timestampMs: input.timestampMs } : {}),
        },
      }),
    );
    return toNote(row);
  }

  async deleteNote(
    tenantId: string,
    userId: string,
    sermonId: string,
    noteId: string,
  ): Promise<void> {
    const note = await this.requireNote(tenantId, userId, sermonId, noteId);
    await this.prisma.withTenant(tenantId, (tx) => tx.sermonNote.delete({ where: { id: note.id } }));
  }

  async createShare(
    tenantId: string,
    actorUserId: string,
    sermonId: string,
    input: SermonShareCreateRequest,
  ): Promise<SermonShare> {
    const sermon = await this.requireSermon(tenantId, sermonId);
    if (sermon.status === 'ARCHIVED') {
      throw new DomainError('SERMON_ALREADY_ARCHIVED', 'An archived sermon cannot be shared');
    }
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 86_400_000)
      : null;
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermonShare.create({
        data: {
          tenantId,
          sermonId,
          token: shareToken(),
          expiresAt,
          createdByUserId: actorUserId,
        },
      }),
    );
    return toShare(row, this.shareUrl(row.token));
  }

  async listShares(tenantId: string, sermonId: string): Promise<SermonShare[]> {
    await this.requireSermon(tenantId, sermonId);
    const rows = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermonShare.findMany({
        where: { tenantId, sermonId },
        orderBy: { createdAt: 'desc' },
      }),
    );
    return rows.map((row) => toShare(row, this.shareUrl(row.token)));
  }

  async revokeShare(tenantId: string, sermonId: string, shareId: string): Promise<SermonShare> {
    await this.requireSermon(tenantId, sermonId);
    const existing = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermonShare.findFirst({ where: { id: shareId, tenantId, sermonId } }),
    );
    if (!existing) {
      throw new DomainError('SERMON_SHARE_NOT_FOUND', 'That share link could not be found');
    }
    if (existing.revokedAt) {
      throw new DomainError('SERMON_SHARE_REVOKED', 'That share link has already been revoked');
    }
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermonShare.update({
        where: { id: shareId },
        data: { revokedAt: new Date() },
      }),
    );
    return toShare(row, this.shareUrl(row.token));
  }

  async resolveShare(token: string): Promise<SermonResponse> {
    const share = await this.prisma.withoutScope((tx) =>
      tx.sermonShare.findUnique({ where: { token } }),
    );
    if (!share) {
      throw new DomainError('SERMON_SHARE_NOT_FOUND', 'That share link could not be found');
    }
    if (share.revokedAt) {
      throw new DomainError('SERMON_SHARE_REVOKED', 'That share link has been revoked');
    }
    if (share.expiresAt && share.expiresAt.getTime() < Date.now()) {
      throw new DomainError('SERMON_SHARE_EXPIRED', 'That share link has expired');
    }
    const row = await this.prisma.withTenant(share.tenantId, (tx) =>
      tx.sermon.findFirst({
        where: { id: share.sermonId, tenantId: share.tenantId },
        include: DETAIL_INCLUDE,
      }),
    );
    if (!row || row.status === 'ARCHIVED') {
      throw new DomainError('SERMON_NOT_FOUND', 'That sermon could not be found');
    }
    return this.toDetail(share.tenantId, row);
  }

  async publicMedia(
    tenantSlug: string,
    sermonSlug: string,
  ): Promise<{ bytes: Buffer; contentType: string; fileName: string }> {
    const sermon = await this.publicBySlug(tenantSlug, sermonSlug);
    return this.requireMediaBytes(sermon.tenantId, sermon.mediaArtifactId);
  }

  async shareMedia(token: string): Promise<{ bytes: Buffer; contentType: string; fileName: string }> {
    const sermon = await this.resolveShare(token);
    return this.requireMediaBytes(sermon.tenantId, sermon.mediaArtifactId);
  }

  async publicBySlug(tenantSlug: string, sermonSlug: string): Promise<SermonResponse> {
    const tenant = await this.prisma.withoutScope((tx) =>
      tx.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true, status: true } }),
    );
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new DomainError('SERMON_NOT_FOUND', 'That sermon could not be found');
    }
    const row = await this.prisma.withTenant(tenant.id, (tx) =>
      tx.sermon.findFirst({
        where: {
          tenantId: tenant.id,
          slug: sermonSlug,
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          archivedAt: null,
        },
        include: DETAIL_INCLUDE,
      }),
    );
    if (!row) {
      throw new DomainError('SERMON_NOT_FOUND', 'That sermon could not be found');
    }
    return this.toDetail(tenant.id, row);
  }

  async podcastRss(tenantSlug: string): Promise<string> {
    const tenant = await this.prisma.withoutScope((tx) =>
      tx.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true, slug: true, name: true, status: true },
      }),
    );
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new DomainError('SERMON_PODCAST_UNAVAILABLE', 'No public sermon feed is available');
    }
    const sermons = await this.prisma.withTenant(tenant.id, (tx) =>
      tx.sermon.findMany({
        where: {
          tenantId: tenant.id,
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
          archivedAt: null,
          mediaKind: { in: ['AUDIO', 'VIDEO'] },
        },
        include: DETAIL_INCLUDE,
        orderBy: [{ preachedAt: 'desc' }, { createdAt: 'desc' }],
        take: 50,
      }),
    );
    if (sermons.length === 0) {
      throw new DomainError('SERMON_PODCAST_UNAVAILABLE', 'No public sermon feed is available');
    }

    const channelLink = `${this.config.appBaseUrl}/listen/${tenant.slug}`;
    const items = await Promise.all(
      sermons.map(async (sermon) => {
        const media = await this.mediaOf(tenant.id, sermon);
        const enclosureUrl = `${this.config.appBaseUrl}/api/v${this.config.apiVersion}/public/sermons/${tenant.slug}/${sermon.slug}/media`;
        const enclosure = sermon.mediaArtifactId
          ? `<enclosure url="${xmlEscape(enclosureUrl)}" type="${xmlEscape(media.contentType ?? 'audio/mpeg')}" length="${media.sizeBytes ?? 0}" />`
          : '';
        const pubDate = rfc822(sermon.publishedAt ?? sermon.preachedAt ?? sermon.createdAt);
        const description = xmlEscape(sermon.description ?? sermon.insight?.summary ?? sermon.title);
        return [
          '<item>',
          `<title>${xmlEscape(sermon.title)}</title>`,
          `<guid isPermaLink="false">${sermon.id}</guid>`,
          `<link>${xmlEscape(`${channelLink}/${sermon.slug}`)}</link>`,
          `<pubDate>${pubDate}</pubDate>`,
          `<description>${description}</description>`,
          sermon.speakerName ? `<itunes:author>${xmlEscape(sermon.speakerName)}</itunes:author>` : '',
          enclosure,
          '</item>',
        ]
          .filter((line) => line.length > 0)
          .join('');
      }),
    );

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">',
      '<channel>',
      `<title>${xmlEscape(tenant.name)} sermons</title>`,
      `<link>${xmlEscape(channelLink)}</link>`,
      `<description>Public sermons from ${xmlEscape(tenant.name)}</description>`,
      `<language>en</language>`,
      ...items,
      '</channel>',
      '</rss>',
    ].join('');
  }

  async markReadyIfSettled(tenantId: string, sermonId: string): Promise<void> {
    await this.prisma.withTenant(tenantId, async (tx) => {
      const sermon = await tx.sermon.findFirst({
        where: { id: sermonId, tenantId },
        select: { status: true },
      });
      if (!sermon || sermon.status !== 'PROCESSING') return;
      const open = await tx.sermonProcessingJob.count({
        where: {
          tenantId,
          sermonId,
          status: { in: ['PENDING', 'RUNNING'] },
        },
      });
      if (open > 0) return;
      await tx.sermon.update({
        where: { id: sermonId },
        data: { status: 'READY' },
      });
    });
  }

  private listWhere(tenantId: string, query: SermonListQuery): Prisma.SermonWhereInput {
    return {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.visibility ? { visibility: query.visibility } : {}),
      ...(query.seriesId ? { seriesId: query.seriesId } : {}),
      ...(query.speaker
        ? { speakerName: { contains: query.speaker, mode: 'insensitive' } }
        : {}),
      ...(query.tag ? { tags: { some: { tag: query.tag } } } : {}),
      ...(query.from || query.to
        ? {
            preachedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { subtitle: { contains: query.search, mode: 'insensitive' as const } },
              { speakerName: { contains: query.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(query.includeArchived || query.status === 'ARCHIVED' ? {} : { archivedAt: null }),
    };
  }

  private async requireSeries(tenantId: string, seriesId: string) {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermonSeries.findFirst({
        where: { id: seriesId, tenantId },
        include: SERIES_INCLUDE,
      }),
    );
    if (!row) {
      throw new DomainError('SERMON_SERIES_NOT_FOUND', 'That series could not be found');
    }
    return row;
  }

  private async requireSermon(tenantId: string, sermonId: string): Promise<SermonDetailRow> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermon.findFirst({
        where: { id: sermonId, tenantId },
        include: DETAIL_INCLUDE,
      }),
    );
    if (!row) {
      throw new DomainError('SERMON_NOT_FOUND', 'That sermon could not be found');
    }
    return row;
  }

  private async requireNote(
    tenantId: string,
    userId: string,
    sermonId: string,
    noteId: string,
  ) {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermonNote.findFirst({ where: { id: noteId, tenantId, sermonId, userId } }),
    );
    if (!row) {
      throw new DomainError('SERMON_NOTE_NOT_FOUND', 'That note could not be found');
    }
    return row;
  }

  private assertMutable(row: SermonDetailRow): void {
    if (row.status === 'ARCHIVED') {
      throw new DomainError('SERMON_ALREADY_ARCHIVED', 'An archived sermon cannot be changed');
    }
  }

  private async allocateSermonSlug(tenantId: string, requested: string): Promise<string> {
    const taken = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermon.findMany({
        where: { tenantId, slug: { startsWith: requested.slice(0, 32) } },
        select: { slug: true },
      }),
    );
    return uniqueSlug(requested, new Set(taken.map((row) => row.slug)));
  }

  private async allocateSeriesSlug(tenantId: string, requested: string): Promise<string> {
    const taken = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermonSeries.findMany({
        where: { tenantId, slug: { startsWith: requested.slice(0, 32) } },
        select: { slug: true },
      }),
    );
    return uniqueSlug(requested, new Set(taken.map((row) => row.slug)));
  }

  private async assertSermonSlugFree(
    tenantId: string,
    slug: string,
    exceptId: string,
  ): Promise<void> {
    const existing = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermon.findFirst({ where: { tenantId, slug, id: { not: exceptId } }, select: { id: true } }),
    );
    if (existing) {
      throw new DomainError('SERMON_SLUG_TAKEN', 'That sermon address is already in use');
    }
  }

  private async assertSeriesSlugFree(
    tenantId: string,
    slug: string,
    exceptId: string,
  ): Promise<void> {
    const existing = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermonSeries.findFirst({
        where: { tenantId, slug, id: { not: exceptId } },
        select: { id: true },
      }),
    );
    if (existing) {
      throw new DomainError('SERMON_SERIES_SLUG_TAKEN', 'That series address is already in use');
    }
  }

  private async requireMediaBytes(
    tenantId: string,
    mediaArtifactId: string | null,
  ): Promise<{ bytes: Buffer; contentType: string; fileName: string }> {
    if (!mediaArtifactId) {
      throw new DomainError('SERMON_MEDIA_REQUIRED', 'This sermon has no attached media');
    }
    return this.artifacts.content(tenantId, mediaArtifactId);
  }

  private async toDetail(tenantId: string, row: SermonDetailRow): Promise<SermonResponse> {
    return toSermonResponse(row, await this.mediaOf(tenantId, row));
  }

  private async mediaOf(
    tenantId: string,
    row: { mediaKind: SermonMedia['kind']; mediaArtifactId: string | null; durationMs: number | null },
  ): Promise<SermonMedia> {
    if (!row.mediaArtifactId) {
      return {
        kind: row.mediaKind,
        artifactId: null,
        contentType: null,
        fileName: null,
        sizeBytes: null,
        durationMs: row.durationMs,
        url: null,
      };
    }
    try {
      const artifact = await this.artifacts.get(tenantId, row.mediaArtifactId);
      const version = artifact.currentVersion;
      const download = await this.artifacts.download(tenantId, row.mediaArtifactId);
      return {
        kind: row.mediaKind,
        artifactId: row.mediaArtifactId,
        contentType: version?.detectedContentType ?? version?.declaredContentType ?? null,
        fileName: version?.fileName ?? null,
        sizeBytes: version?.sizeBytes ?? null,
        durationMs: row.durationMs,
        url: download.url,
      };
    } catch {
      return {
        kind: row.mediaKind,
        artifactId: row.mediaArtifactId,
        contentType: null,
        fileName: null,
        sizeBytes: null,
        durationMs: row.durationMs,
        url: null,
      };
    }
  }

  private shareUrl(token: string): string {
    return `${this.config.appBaseUrl}/listen/s/${token}`;
  }
}

function translateSermonError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = Array.isArray(error.meta?.target) ? (error.meta?.target as string[]) : [];
    if (target.some((column) => column.includes('slug'))) {
      if (target.some((column) => column.includes('series'))) {
        return new DomainError('SERMON_SERIES_SLUG_TAKEN', 'That series address is already in use');
      }
      return new DomainError('SERMON_SLUG_TAKEN', 'That sermon address is already in use');
    }
    return new DomainError('RESOURCE_CONFLICT', 'That sermon record conflicts with an existing one');
  }
  return error;
}
