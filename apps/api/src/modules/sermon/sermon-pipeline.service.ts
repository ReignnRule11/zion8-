import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { SermonGenerateKind, SermonStage } from '@zion8/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../infrastructure/storage/object-storage.port';
import { decodeText, isTextReadable } from '../ai/ai.utils';
import { CHAT_PROVIDER, type ChatProvider } from '../ai/ports/chat.provider';
import {
  chapterize,
  contentHashOf,
  detectScriptures,
  detectSpeaker,
  extractInsight,
  suggestTags,
} from './sermon.utils';

const PIPELINE_AFTER_TRANSCRIPT: SermonStage[] = [
  'SCRIPTURE',
  'SPEAKER',
  'SUMMARIZE',
  'CHAPTERIZE',
  'TAG',
  'INDEX',
];

/**
 * Turns a sermon transcript into the study surface.
 *
 * Every derived field is produced here so the worker, a generate request and a
 * manual transcript upload all take the same path. The chat port is used when
 * the workspace has configured one; otherwise the extractive helpers run locally
 * and the result is still attributable to the transcript.
 */
@Injectable()
export class SermonPipelineService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CHAT_PROVIDER) private readonly chat: ChatProvider,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  defaultStages(hasTranscript: boolean, mediaKind: 'AUDIO' | 'VIDEO' | 'TEXT' | 'NONE'): SermonStage[] {
    if (hasTranscript) return [...PIPELINE_AFTER_TRANSCRIPT];
    if (mediaKind === 'TEXT' || mediaKind === 'AUDIO' || mediaKind === 'VIDEO') {
      return ['TRANSCRIBE', ...PIPELINE_AFTER_TRANSCRIPT];
    }
    return [];
  }

  async enqueue(
    tenantId: string,
    sermonId: string,
    stages: readonly SermonStage[],
  ): Promise<void> {
    await this.prisma.withTenant(tenantId, async (tx) => {
      for (const [index, stage] of stages.entries()) {
        const dedupeKey = `${stage}:${sermonId}`;
        const existing = await tx.sermonProcessingJob.findUnique({ where: { dedupeKey } });
        if (existing) {
          if (existing.status === 'BLOCKED' || existing.status === 'FAILED' || existing.status === 'SUCCEEDED') {
            await tx.sermonProcessingJob.update({
              where: { id: existing.id },
              data: {
                status: 'PENDING',
                attempts: 0,
                availableAt: new Date(),
                blockedReason: null,
                lastError: null,
                startedAt: null,
                completedAt: null,
                priority: 50 + index,
              },
            });
          }
          continue;
        }
        await tx.sermonProcessingJob.create({
          data: {
            id: randomUUID(),
            tenantId,
            sermonId,
            type: stage,
            priority: 50 + index,
            dedupeKey,
          },
        });
      }
    });
  }

  async loadTranscriptText(tenantId: string, sermonId: string): Promise<string | null> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermonTranscript.findFirst({
        where: { tenantId, sermonId, isCurrent: true },
        select: { text: true },
      }),
    );
    return row?.text ?? null;
  }

  async readTextArtifact(storageKey: string, contentType: string, fileName: string): Promise<string | null> {
    if (!isTextReadable(contentType, fileName)) return null;
    const bytes = await this.storage.get(storageKey);
    const text = decodeText(bytes).trim();
    return text.length > 0 ? text : null;
  }

  async writeTranscript(
    tenantId: string,
    sermonId: string,
    input: {
      language: string;
      text: string;
      source: 'DETERMINISTIC' | 'STT' | 'MANUAL';
      status?: 'READY' | 'PARTIAL';
    },
  ): Promise<void> {
    const text = input.text.trim();
    const segments = text
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    await this.prisma.withTenant(tenantId, async (tx) => {
      const latest = await tx.sermonTranscript.findFirst({
        where: { tenantId, sermonId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const version = (latest?.version ?? 0) + 1;
      await tx.sermonTranscript.updateMany({
        where: { tenantId, sermonId, isCurrent: true },
        data: { isCurrent: false },
      });
      const transcript = await tx.sermonTranscript.create({
        data: {
          tenantId,
          sermonId,
          version,
          language: input.language,
          status: input.status ?? 'READY',
          source: input.source,
          text,
          isCurrent: true,
        },
      });
      if (segments.length > 0) {
        await tx.sermonTranscriptSegment.createMany({
          data: segments.map((segment, ordinal) => ({
            tenantId,
            transcriptId: transcript.id,
            ordinal,
            text: segment,
          })),
        });
      }
      await tx.sermon.update({
        where: { id: sermonId },
        data: { transcriptStatus: input.status ?? 'READY' },
      });
    });
  }

  async runStage(tenantId: string, sermonId: string, stage: SermonStage): Promise<StageOutcome> {
    switch (stage) {
      case 'TRANSCRIBE':
        return this.runTranscribe(tenantId, sermonId);
      case 'SCRIPTURE':
        return this.runScripture(tenantId, sermonId);
      case 'SPEAKER':
        return this.runSpeaker(tenantId, sermonId);
      case 'SUMMARIZE':
        return this.runSummarize(tenantId, sermonId);
      case 'CHAPTERIZE':
        return this.runChapterize(tenantId, sermonId);
      case 'TAG':
        return this.runTag(tenantId, sermonId);
      case 'INDEX':
        return this.runIndex(tenantId, sermonId);
      default:
        return { status: 'BLOCKED', reason: 'STAGE_NOT_AVAILABLE_YET' };
    }
  }

  async generate(tenantId: string, sermonId: string, kind: SermonGenerateKind): Promise<StageOutcome> {
    const mapping: Record<SermonGenerateKind, SermonStage> = {
      SUMMARY: 'SUMMARIZE',
      CHAPTERS: 'CHAPTERIZE',
      TAGS: 'TAG',
      SOCIAL: 'SUMMARIZE',
    };
    return this.runStage(tenantId, sermonId, mapping[kind]);
  }

  private async requireText(tenantId: string, sermonId: string): Promise<string | null> {
    return this.loadTranscriptText(tenantId, sermonId);
  }

  private async runTranscribe(tenantId: string, sermonId: string): Promise<StageOutcome> {
    const existing = await this.loadTranscriptText(tenantId, sermonId);
    if (existing && existing.trim().length > 0) {
      return { status: 'SUCCEEDED', result: { skipped: true, reason: 'TRANSCRIPT_PRESENT' } };
    }

    const sermon = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermon.findFirst({
        where: { id: sermonId, tenantId },
        select: { mediaKind: true, mediaArtifactId: true, language: true },
      }),
    );
    if (!sermon) return { status: 'BLOCKED', reason: 'SERMON_NOT_FOUND' };

    if (sermon.mediaKind === 'TEXT' && sermon.mediaArtifactId) {
      const version = await this.prisma.withTenant(tenantId, (tx) =>
        tx.memoryArtifactVersion.findFirst({
          where: { tenantId, artifactId: sermon.mediaArtifactId!, isCurrent: true },
        }),
      );
      if (!version) return { status: 'BLOCKED', reason: 'MEDIA_VERSION_NOT_FOUND' };
      const text = await this.readTextArtifact(
        version.storageKey,
        version.detectedContentType ?? version.declaredContentType,
        version.fileName,
      );
      if (text) {
        await this.writeTranscript(tenantId, sermonId, {
          language: sermon.language,
          text,
          source: 'DETERMINISTIC',
        });
        return { status: 'SUCCEEDED', result: { source: 'TEXT_ARTIFACT', chars: text.length } };
      }
      await this.prisma.withTenant(tenantId, (tx) =>
        tx.sermon.update({
          where: { id: sermonId },
          data: { transcriptStatus: 'BLOCKED' },
        }),
      );
      return { status: 'BLOCKED', reason: 'TEXT_EXTRACTION_NOT_CONFIGURED' };
    }

    if (sermon.mediaKind === 'AUDIO' || sermon.mediaKind === 'VIDEO') {
      await this.prisma.withTenant(tenantId, (tx) =>
        tx.sermon.update({
          where: { id: sermonId },
          data: { transcriptStatus: 'BLOCKED' },
        }),
      );
      return { status: 'BLOCKED', reason: 'TRANSCRIPTION_NOT_CONFIGURED' };
    }

    await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermon.update({
        where: { id: sermonId },
        data: { transcriptStatus: 'NONE' },
      }),
    );
    return { status: 'SUCCEEDED', result: { skipped: true, reason: 'NO_MEDIA' } };
  }

  private async runScripture(tenantId: string, sermonId: string): Promise<StageOutcome> {
    const text = await this.requireText(tenantId, sermonId);
    if (!text) return { status: 'BLOCKED', reason: 'TRANSCRIPT_REQUIRED' };
    const found = detectScriptures(text);
    await this.prisma.withTenant(tenantId, async (tx) => {
      await tx.sermonScripture.deleteMany({ where: { tenantId, sermonId } });
      if (found.length > 0) {
        await tx.sermonScripture.createMany({
          data: found.map((item) => ({
            tenantId,
            sermonId,
            book: item.book,
            chapter: item.chapter,
            verseStart: item.verseStart,
            verseEnd: item.verseEnd,
            reference: item.reference,
          })),
        });
      }
    });
    return { status: 'SUCCEEDED', result: { count: found.length } };
  }

  private async runSpeaker(tenantId: string, sermonId: string): Promise<StageOutcome> {
    const sermon = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermon.findFirst({
        where: { id: sermonId, tenantId },
        select: { speakerName: true },
      }),
    );
    const text = await this.requireText(tenantId, sermonId);
    if (!text) return { status: 'BLOCKED', reason: 'TRANSCRIPT_REQUIRED' };
    const speaker = detectSpeaker(text, sermon?.speakerName ?? null);
    if (speaker && !sermon?.speakerName) {
      await this.prisma.withTenant(tenantId, (tx) =>
        tx.sermon.update({ where: { id: sermonId }, data: { speakerName: speaker } }),
      );
    }
    return { status: 'SUCCEEDED', result: { speakerName: speaker } };
  }

  private async runSummarize(tenantId: string, sermonId: string): Promise<StageOutcome> {
    const sermon = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermon.findFirst({
        where: { id: sermonId, tenantId },
        select: { title: true },
      }),
    );
    const text = await this.requireText(tenantId, sermonId);
    if (!text) return { status: 'BLOCKED', reason: 'TRANSCRIPT_REQUIRED' };

    const local = extractInsight(text, sermon?.title ?? 'Sermon');
    const drafted = await this.chat.complete({
      system:
        'Summarise the sermon using only the provided transcript. Each claim must cite passage-1. Do not invent content.',
      question: `Summarise "${sermon?.title ?? 'this sermon'}" in a few sentences and list key points.`,
      passages: [{ citationId: 'passage-1', content: text.slice(0, 12_000) }],
      history: [],
      temperature: 0,
      maxTokens: 400,
    });

    const summary = drafted.abstained ? local.summary : drafted.content.slice(0, 2000);
    const keyPoints = drafted.abstained
      ? local.keyPoints
      : drafted.claims.map((claim) => claim.text).slice(0, 8);
    const socialCaption = local.socialCaption;
    const provider = drafted.provider;

    await this.prisma.withTenant(tenantId, async (tx) => {
      await tx.sermonInsight.upsert({
        where: { sermonId },
        create: {
          tenantId,
          sermonId,
          summary,
          keyPoints,
          socialCaption,
          provider,
        },
        update: { summary, keyPoints, socialCaption, provider },
      });
      await tx.sermon.update({
        where: { id: sermonId },
        data: { summaryStatus: 'READY' },
      });
    });
    return { status: 'SUCCEEDED', result: { provider, keyPoints: keyPoints.length } };
  }

  private async runChapterize(tenantId: string, sermonId: string): Promise<StageOutcome> {
    const sermon = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermon.findFirst({
        where: { id: sermonId, tenantId },
        select: { durationMs: true },
      }),
    );
    const text = await this.requireText(tenantId, sermonId);
    if (!text) return { status: 'BLOCKED', reason: 'TRANSCRIPT_REQUIRED' };
    const chapters = chapterize(text, sermon?.durationMs ?? null);
    await this.prisma.withTenant(tenantId, async (tx) => {
      await tx.sermonChapter.deleteMany({ where: { tenantId, sermonId } });
      if (chapters.length > 0) {
        await tx.sermonChapter.createMany({
          data: chapters.map((chapter) => ({
            tenantId,
            sermonId,
            ordinal: chapter.ordinal,
            startMs: chapter.startMs,
            endMs: chapter.endMs,
            title: chapter.title,
            summary: chapter.summary,
          })),
        });
      }
    });
    return { status: 'SUCCEEDED', result: { count: chapters.length } };
  }

  private async runTag(tenantId: string, sermonId: string): Promise<StageOutcome> {
    const text = await this.requireText(tenantId, sermonId);
    if (!text) return { status: 'BLOCKED', reason: 'TRANSCRIPT_REQUIRED' };
    const existing = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermonTag.findMany({ where: { tenantId, sermonId }, select: { tag: true } }),
    );
    const suggested = suggestTags(
      text,
      existing.map((row) => row.tag),
    );
    if (suggested.length > 0) {
      await this.prisma.withTenant(tenantId, (tx) =>
        tx.sermonTag.createMany({
          data: suggested.map((tag) => ({ tenantId, sermonId, tag })),
          skipDuplicates: true,
        }),
      );
    }
    return { status: 'SUCCEEDED', result: { added: suggested } };
  }

  private async runIndex(tenantId: string, sermonId: string): Promise<StageOutcome> {
    const text = await this.requireText(tenantId, sermonId);
    if (!text) return { status: 'BLOCKED', reason: 'TRANSCRIPT_REQUIRED' };
    const sermon = await this.prisma.withTenant(tenantId, (tx) =>
      tx.sermon.findFirst({
        where: { id: sermonId, tenantId },
        select: { title: true, preachedAt: true, slug: true },
      }),
    );
    if (!sermon) return { status: 'BLOCKED', reason: 'SERMON_NOT_FOUND' };

    const contentHash = contentHashOf(text);
    await this.prisma.withTenant(tenantId, (tx) =>
      tx.aiDocument.upsert({
        where: {
          tenantId_sourceType_sourceId_versionKey: {
            tenantId,
            sourceType: 'SERMON',
            sourceId: sermonId,
            versionKey: 'current',
          },
        },
        create: {
          tenantId,
          sourceType: 'SERMON',
          sourceId: sermonId,
          versionKey: 'current',
          title: sermon.title.slice(0, 300),
          kind: 'SERMON',
          content: text,
          contentHash,
          occurredAt: sermon.preachedAt,
          charCount: text.length,
          status: 'PENDING',
          sensitivity: 'INTERNAL',
          requiredPermission: 'sermon:read',
        },
        update: {
          title: sermon.title.slice(0, 300),
          content: text,
          contentHash,
          occurredAt: sermon.preachedAt,
          charCount: text.length,
          status: 'PENDING',
          lastError: null,
        },
      }),
    );
    return { status: 'SUCCEEDED', result: { queued: true } };
  }
}

export type StageOutcome =
  | { status: 'SUCCEEDED'; result?: Record<string, unknown> }
  | { status: 'BLOCKED'; reason: string };
