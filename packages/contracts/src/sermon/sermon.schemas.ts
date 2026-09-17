import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { personNameSchema, slugSchema, uuidSchema } from '../common/primitives';
import {
  ALLOWED_ARTIFACT_TYPES,
  MAX_ARTIFACT_BYTES,
  memoryJobStatusSchema,
} from '../memory/artifact.schemas';

/**
 * Sermon management.
 *
 * A sermon is a published teaching: title, speaker, series, when it was preached,
 * and the derived study surface (transcript, chapters, scripture, summary). The
 * bytes of the recording live in the Digital Memory Engine; this bounded context
 * never stores media of its own. Zion AI ports produce the derived surface, so
 * the same deterministic providers that index the archive also chapterize and
 * summarise a sermon.
 */

export const SermonStatus = {
  DRAFT: 'DRAFT',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  PUBLISHED: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type SermonStatus = (typeof SermonStatus)[keyof typeof SermonStatus];

export const sermonStatusSchema = z.enum(
  Object.values(SermonStatus) as [SermonStatus, ...SermonStatus[]],
);

/**
 * Who may hear a published sermon. PRIVATE is staff-only; MEMBERS is anyone with
 * `sermon:read`; PUBLIC is the podcast feed and an unauthenticated permalink.
 * Drafts are never public regardless of this flag.
 */
export const SermonVisibility = {
  PRIVATE: 'PRIVATE',
  MEMBERS: 'MEMBERS',
  PUBLIC: 'PUBLIC',
} as const;

export type SermonVisibility = (typeof SermonVisibility)[keyof typeof SermonVisibility];

export const sermonVisibilitySchema = z.enum(
  Object.values(SermonVisibility) as [SermonVisibility, ...SermonVisibility[]],
);

export const SermonMediaKind = {
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO',
  TEXT: 'TEXT',
  NONE: 'NONE',
} as const;

export type SermonMediaKind = (typeof SermonMediaKind)[keyof typeof SermonMediaKind];

export const sermonMediaKindSchema = z.enum(
  Object.values(SermonMediaKind) as [SermonMediaKind, ...SermonMediaKind[]],
);

export const SermonDerivedStatus = {
  NONE: 'NONE',
  PENDING: 'PENDING',
  READY: 'READY',
  PARTIAL: 'PARTIAL',
  BLOCKED: 'BLOCKED',
  FAILED: 'FAILED',
} as const;

export type SermonDerivedStatus = (typeof SermonDerivedStatus)[keyof typeof SermonDerivedStatus];

export const sermonDerivedStatusSchema = z.enum(
  Object.values(SermonDerivedStatus) as [SermonDerivedStatus, ...SermonDerivedStatus[]],
);

export const SermonStage = {
  TRANSCRIBE: 'TRANSCRIBE',
  SCRIPTURE: 'SCRIPTURE',
  SPEAKER: 'SPEAKER',
  SUMMARIZE: 'SUMMARIZE',
  CHAPTERIZE: 'CHAPTERIZE',
  TAG: 'TAG',
  INDEX: 'INDEX',
} as const;

export type SermonStage = (typeof SermonStage)[keyof typeof SermonStage];

export const sermonStageSchema = z.enum(
  Object.values(SermonStage) as [SermonStage, ...SermonStage[]],
);

export const SermonGenerateKind = {
  SUMMARY: 'SUMMARY',
  CHAPTERS: 'CHAPTERS',
  TAGS: 'TAGS',
  SOCIAL: 'SOCIAL',
} as const;

export type SermonGenerateKind = (typeof SermonGenerateKind)[keyof typeof SermonGenerateKind];

export const sermonGenerateKindSchema = z.enum(
  Object.values(SermonGenerateKind) as [SermonGenerateKind, ...SermonGenerateKind[]],
);

export const ALLOWED_SERMON_MEDIA_TYPES: readonly string[] = ALLOWED_ARTIFACT_TYPES.filter(
  (type) =>
    type.startsWith('audio/') ||
    type.startsWith('video/') ||
    type === 'text/plain' ||
    type === 'text/markdown' ||
    type === 'application/pdf',
);

export const MAX_SERMON_MEDIA_BYTES = MAX_ARTIFACT_BYTES;

const base64Schema = z
  .string()
  .min(1)
  .max(Math.ceil((MAX_SERMON_MEDIA_BYTES * 4) / 3) + 4)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Content must be base64 encoded');

const tagSchema = z.string().trim().min(1).max(64);

export const sermonCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    subtitle: z.string().trim().max(240).optional(),
    description: z.string().trim().max(8000).optional(),
    slug: slugSchema.optional(),
    seriesId: uuidSchema.optional(),
    speakerName: personNameSchema.optional(),
    speakerMemberId: uuidSchema.optional(),
    preachedAt: z.string().datetime().optional(),
    location: z.string().trim().max(200).optional(),
    language: z.string().trim().min(2).max(16).default('en'),
    visibility: sermonVisibilitySchema.default('MEMBERS'),
    tags: z.array(tagSchema).max(50).default([]),
    artifactId: uuidSchema.optional(),
    fileName: z.string().trim().min(1).max(255).optional(),
    contentType: z.string().trim().min(3).max(120).optional(),
    contentBase64: base64Schema.optional(),
    transcriptText: z.string().trim().min(1).max(200_000).optional(),
  })
  .superRefine((value, ctx) => {
    const hasUpload = Boolean(value.fileName || value.contentType || value.contentBase64);
    if (hasUpload) {
      if (!value.fileName || !value.contentType || !value.contentBase64) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Uploading media requires fileName, contentType and contentBase64 together',
          path: ['contentBase64'],
        });
      }
    }
    if (value.artifactId && hasUpload) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either an existing artifact or a new upload, not both',
        path: ['artifactId'],
      });
    }
  });

export type SermonCreateRequest = z.infer<typeof sermonCreateSchema>;

export const sermonUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  subtitle: z.string().trim().max(240).nullable().optional(),
  description: z.string().trim().max(8000).nullable().optional(),
  slug: slugSchema.optional(),
  seriesId: uuidSchema.nullable().optional(),
  speakerName: personNameSchema.nullable().optional(),
  speakerMemberId: uuidSchema.nullable().optional(),
  preachedAt: z.string().datetime().nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
  language: z.string().trim().min(2).max(16).optional(),
  visibility: sermonVisibilitySchema.optional(),
  tags: z.array(tagSchema).max(50).optional(),
});

export type SermonUpdateRequest = z.infer<typeof sermonUpdateSchema>;

export const sermonPublishSchema = z.object({
  visibility: sermonVisibilitySchema.optional(),
});

export type SermonPublishRequest = z.infer<typeof sermonPublishSchema>;

export const sermonReprocessSchema = z.object({
  stages: z.array(sermonStageSchema).min(1).max(7).optional(),
});

export type SermonReprocessRequest = z.infer<typeof sermonReprocessSchema>;

export const sermonGenerateSchema = z.object({
  kind: sermonGenerateKindSchema,
});

export type SermonGenerateRequest = z.infer<typeof sermonGenerateSchema>;

export const sermonTranscriptUpsertSchema = z.object({
  language: z.string().trim().min(2).max(16).default('en'),
  text: z.string().trim().min(1).max(200_000),
});

export type SermonTranscriptUpsertRequest = z.infer<typeof sermonTranscriptUpsertSchema>;

export const sermonListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: sermonStatusSchema.optional(),
  visibility: sermonVisibilitySchema.optional(),
  seriesId: uuidSchema.optional(),
  speaker: z.string().trim().max(120).optional(),
  tag: tagSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  includeArchived: z.coerce.boolean().optional(),
});

export type SermonListQuery = z.infer<typeof sermonListQuerySchema>;

export const sermonSearchQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(200),
  seriesId: uuidSchema.optional(),
  speaker: z.string().trim().max(120).optional(),
  tag: tagSchema.optional(),
});

export type SermonSearchQuery = z.infer<typeof sermonSearchQuerySchema>;

export const sermonJobSummarySchema = z.object({
  id: uuidSchema,
  sermonId: uuidSchema,
  type: sermonStageSchema,
  status: memoryJobStatusSchema,
  attempts: z.number().int().min(0),
  maxAttempts: z.number().int().min(1),
  provider: z.string().nullable(),
  blockedReason: z.string().nullable(),
  lastError: z.string().nullable(),
  availableAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SermonJobSummary = z.infer<typeof sermonJobSummarySchema>;

export const sermonReprocessResponseSchema = z.object({
  sermonId: uuidSchema,
  jobs: z.array(sermonJobSummarySchema),
});

export type SermonReprocessResponse = z.infer<typeof sermonReprocessResponseSchema>;

export const sermonMediaSchema = z.object({
  kind: sermonMediaKindSchema,
  artifactId: uuidSchema.nullable(),
  contentType: z.string().nullable(),
  fileName: z.string().nullable(),
  sizeBytes: z.number().int().min(0).nullable(),
  durationMs: z.number().int().min(0).nullable(),
  url: z.string().nullable(),
});

export type SermonMedia = z.infer<typeof sermonMediaSchema>;

export const sermonSeriesRefSchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  title: z.string(),
});

export type SermonSeriesRef = z.infer<typeof sermonSeriesRefSchema>;

export const sermonSummarySchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  speakerName: z.string().nullable(),
  preachedAt: z.string().datetime().nullable(),
  status: sermonStatusSchema,
  visibility: sermonVisibilitySchema,
  mediaKind: sermonMediaKindSchema,
  durationMs: z.number().int().min(0).nullable(),
  series: sermonSeriesRefSchema.nullable(),
  tags: z.array(z.string()),
  scriptureCount: z.number().int().min(0),
  chapterCount: z.number().int().min(0),
  transcriptStatus: sermonDerivedStatusSchema,
  summaryStatus: sermonDerivedStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SermonSummary = z.infer<typeof sermonSummarySchema>;

export const sermonPageSchema = paginatedSchema(sermonSummarySchema);

export type SermonPage = z.infer<typeof sermonPageSchema>;

export const sermonTranscriptSegmentSchema = z.object({
  id: uuidSchema,
  ordinal: z.number().int().min(0),
  startMs: z.number().int().min(0).nullable(),
  endMs: z.number().int().min(0).nullable(),
  speakerLabel: z.string().nullable(),
  text: z.string(),
});

export type SermonTranscriptSegment = z.infer<typeof sermonTranscriptSegmentSchema>;

export const sermonTranscriptSchema = z.object({
  id: uuidSchema,
  sermonId: uuidSchema,
  version: z.number().int().min(1),
  language: z.string(),
  status: sermonDerivedStatusSchema,
  source: z.enum(['DETERMINISTIC', 'STT', 'MANUAL']),
  text: z.string(),
  segments: z.array(sermonTranscriptSegmentSchema),
  createdAt: z.string().datetime(),
});

export type SermonTranscript = z.infer<typeof sermonTranscriptSchema>;

export const sermonChapterSchema = z.object({
  id: uuidSchema,
  ordinal: z.number().int().min(0),
  startMs: z.number().int().min(0).nullable(),
  endMs: z.number().int().min(0).nullable(),
  title: z.string(),
  summary: z.string().nullable(),
});

export type SermonChapter = z.infer<typeof sermonChapterSchema>;

export const sermonScriptureSchema = z.object({
  id: uuidSchema,
  book: z.string(),
  chapter: z.number().int().min(1),
  verseStart: z.number().int().min(1),
  verseEnd: z.number().int().min(1),
  reference: z.string(),
  startMs: z.number().int().min(0).nullable(),
});

export type SermonScripture = z.infer<typeof sermonScriptureSchema>;

export const sermonInsightSchema = z.object({
  summary: z.string().nullable(),
  keyPoints: z.array(z.string()),
  socialCaption: z.string().nullable(),
  provider: z.string().nullable(),
});

export type SermonInsight = z.infer<typeof sermonInsightSchema>;

export const sermonResponseSchema = sermonSummarySchema.extend({
  tenantId: uuidSchema,
  description: z.string().nullable(),
  location: z.string().nullable(),
  language: z.string(),
  speakerMemberId: uuidSchema.nullable(),
  mediaArtifactId: uuidSchema.nullable(),
  publishedAt: z.string().datetime().nullable(),
  archivedAt: z.string().datetime().nullable(),
  media: sermonMediaSchema,
  insight: sermonInsightSchema,
  chapters: z.array(sermonChapterSchema),
  scriptures: z.array(sermonScriptureSchema),
  transcript: sermonTranscriptSchema.nullable(),
  jobs: z.array(sermonJobSummarySchema),
});

export type SermonResponse = z.infer<typeof sermonResponseSchema>;

export const sermonGenerateResponseSchema = z.object({
  sermonId: uuidSchema,
  kind: sermonGenerateKindSchema,
  insight: sermonInsightSchema,
  chapters: z.array(sermonChapterSchema),
  tags: z.array(z.string()),
});

export type SermonGenerateResponse = z.infer<typeof sermonGenerateResponseSchema>;

export const sermonRecommendationPageSchema = z.object({
  sermonId: uuidSchema,
  items: z.array(sermonSummarySchema),
});

export type SermonRecommendationPage = z.infer<typeof sermonRecommendationPageSchema>;
