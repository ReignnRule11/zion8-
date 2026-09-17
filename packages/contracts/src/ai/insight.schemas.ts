import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { uuidSchema } from '../common/primitives';
import { aiDocumentStatusSchema, aiPassageSchema, aiSourceTypeSchema } from './search.schemas';

/**
 * The scoped capabilities built on the shared retrieval engine: meeting
 * summaries, prayer insights, and recommendations.
 *
 * Each returns evidence. A recommendation says why it was made; a summary says
 * where each decision came from; an insight reports its cohort size so a small
 * group cannot be reverse-engineered from an aggregate.
 */

// Meeting summaries ----------------------------------------------------------

/**
 * A summary is a draft until a human approves it. The status is part of the
 * contract, not an internal flag, because publishing unreviewed minutes is the
 * failure this guards against.
 */
export const MeetingSummaryStatus = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  DISCARDED: 'DISCARDED',
} as const;

export type MeetingSummaryStatus = (typeof MeetingSummaryStatus)[keyof typeof MeetingSummaryStatus];

export const meetingSummaryStatusSchema = z.enum(
  Object.values(MeetingSummaryStatus) as [MeetingSummaryStatus, ...MeetingSummaryStatus[]],
);

export const meetingActionItemSchema = z.object({
  description: z.string().min(1),
  ownerMemberId: uuidSchema.nullable(),
  ownerName: z.string().nullable(),
  dueAt: z.string().datetime().nullable(),
  citationChunkIds: z.array(uuidSchema),
});

export type MeetingActionItem = z.infer<typeof meetingActionItemSchema>;

export const meetingDecisionSchema = z.object({
  description: z.string().min(1),
  citationChunkIds: z.array(uuidSchema),
});

export type MeetingDecision = z.infer<typeof meetingDecisionSchema>;

export const meetingSummarySchema = z.object({
  id: uuidSchema,
  status: meetingSummaryStatusSchema,
  title: z.string(),
  meetingAt: z.string().datetime().nullable(),
  attendees: z.array(z.string()),
  decisions: z.array(meetingDecisionSchema),
  actionItems: z.array(meetingActionItemSchema),
  nextSteps: z.array(z.string()),
  narrative: z.string().nullable(),
  passages: z.array(aiPassageSchema),
  sourceDocumentIds: z.array(uuidSchema),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  approvedByUserId: uuidSchema.nullable(),
  approvedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MeetingSummary = z.infer<typeof meetingSummarySchema>;

export const meetingSummaryRequestSchema = z
  .object({
    sourceIds: z.array(uuidSchema).min(1).max(20),
    title: z.string().trim().min(1).max(200).optional(),
    meetingAt: z.string().datetime().optional(),
    language: z.string().trim().min(2).max(16).optional(),
  })
  .refine((value) => value.sourceIds.length > 0, {
    message: 'At least one source document is required',
  });

export type MeetingSummaryRequest = z.infer<typeof meetingSummaryRequestSchema>;

export const meetingSummaryListQuerySchema = paginationQuerySchema.extend({
  status: meetingSummaryStatusSchema.optional(),
});

export type MeetingSummaryListQuery = z.infer<typeof meetingSummaryListQuerySchema>;

export const meetingSummaryPageSchema = paginatedSchema(meetingSummarySchema);

export type MeetingSummaryPage = z.infer<typeof meetingSummaryPageSchema>;

export const approveMeetingSummarySchema = z.object({
  approve: z.boolean(),
  notes: z.string().trim().max(2000).optional(),
});

export type ApproveMeetingSummaryRequest = z.infer<typeof approveMeetingSummarySchema>;

// Prayer insights ------------------------------------------------------------

/**
 * `MIN_INSIGHT_COHORT` is enforced server-side. An aggregate over fewer than this
 * many distinct requests is withheld, so a theme cannot be used to work out what
 * one person asked for.
 */
export const MIN_INSIGHT_COHORT = 5;

export const prayerThemeSchema = z.object({
  theme: z.string().min(1),
  requestCount: z.number().int().min(0),
  share: z.number().min(0).max(1),
  trend: z.enum(['RISING', 'STEADY', 'FALLING', 'UNKNOWN']),
  scriptures: z.array(z.string()),
  examplePhrases: z.array(z.string()),
});

export type PrayerTheme = z.infer<typeof prayerThemeSchema>;

export const prayerInsightsResponseSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  totalRequests: z.number().int().min(0),
  distinctRequesters: z.number().int().min(0),
  cohortSufficient: z.boolean(),
  themes: z.array(prayerThemeSchema),
  notes: z.string().nullable(),
  generatedAt: z.string().datetime(),
});

export type PrayerInsightsResponse = z.infer<typeof prayerInsightsResponseSchema>;

export const prayerInsightsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  departmentId: uuidSchema.optional(),
});

export type PrayerInsightsQuery = z.infer<typeof prayerInsightsQuerySchema>;

// Recommendations ------------------------------------------------------------

/**
 * A recommendation always carries its reasons. An unexplainable suggestion about
 * who should serve, or who should be invited, is not usable by a pastor.
 */
export const eventRecommendationSchema = z.object({
  eventId: uuidSchema,
  title: z.string(),
  startsAt: z.string().datetime(),
  score: z.number(),
  reasons: z.array(z.string().min(1)),
});

export type EventRecommendation = z.infer<typeof eventRecommendationSchema>;

export const volunteerRecommendationSchema = z.object({
  memberId: uuidSchema,
  memberName: z.string(),
  roleId: uuidSchema,
  roleName: z.string(),
  score: z.number(),
  reasons: z.array(z.string().min(1)),
  eligible: z.boolean(),
  ineligibilityReasons: z.array(z.string()),
});

export type VolunteerRecommendation = z.infer<typeof volunteerRecommendationSchema>;

export const eventRecommendationQuerySchema = z.object({
  memberId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export type EventRecommendationQuery = z.infer<typeof eventRecommendationQuerySchema>;

export const volunteerRecommendationQuerySchema = z.object({
  roleId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

export type VolunteerRecommendationQuery = z.infer<typeof volunteerRecommendationQuerySchema>;

export const eventRecommendationResponseSchema = z.object({
  memberId: uuidSchema.nullable(),
  generatedAt: z.string().datetime(),
  recommendations: z.array(eventRecommendationSchema),
});

export type EventRecommendationResponse = z.infer<typeof eventRecommendationResponseSchema>;

export const volunteerRecommendationResponseSchema = z.object({
  roleId: uuidSchema.nullable(),
  generatedAt: z.string().datetime(),
  recommendations: z.array(volunteerRecommendationSchema),
});

export type VolunteerRecommendationResponse = z.infer<typeof volunteerRecommendationResponseSchema>;

// Index administration -------------------------------------------------------

/** The projection of a source row into the search index. */
export const aiIndexedDocumentSchema = z.object({
  id: uuidSchema,
  sourceType: aiSourceTypeSchema,
  sourceId: uuidSchema,
  sourceVersionId: uuidSchema.nullable(),
  title: z.string(),
  status: aiDocumentStatusSchema,
  sensitivity: z.string(),
  requiredPermission: z.string().nullable(),
  chunkCount: z.number().int().min(0),
  tokenCount: z.number().int().min(0),
  language: z.string().nullable(),
  occurredAt: z.string().datetime().nullable(),
  indexedAt: z.string().datetime().nullable(),
  lastError: z.string().nullable(),
  updatedAt: z.string().datetime(),
});

export type AiIndexedDocument = z.infer<typeof aiIndexedDocumentSchema>;

export const aiIndexedDocumentPageSchema = paginatedSchema(aiIndexedDocumentSchema);

export type AiIndexedDocumentPage = z.infer<typeof aiIndexedDocumentPageSchema>;

export const aiIndexedDocumentListQuerySchema = paginationQuerySchema.extend({
  sourceType: aiSourceTypeSchema.optional(),
  status: aiDocumentStatusSchema.optional(),
  search: z.string().trim().max(200).optional(),
});

export type AiIndexedDocumentListQuery = z.infer<typeof aiIndexedDocumentListQuerySchema>;

/**
 * Reindexing is explicit because it is the operation that follows a model change.
 * `force` re-embeds unchanged content; without it, content-addressed chunks are
 * skipped and only new or changed sources are processed.
 */
export const aiReindexRequestSchema = z.object({
  sourceTypes: z.array(aiSourceTypeSchema).max(8).optional(),
  sourceIds: z.array(uuidSchema).max(200).optional(),
  force: z.boolean().default(false),
});

export type AiReindexRequest = z.infer<typeof aiReindexRequestSchema>;

export const aiReindexResponseSchema = z.object({
  queued: z.number().int().min(0),
  skipped: z.number().int().min(0),
  embeddingModel: z.string(),
});

export type AiReindexResponse = z.infer<typeof aiReindexResponseSchema>;

export const aiEmbeddingModelSchema = z.object({
  id: uuidSchema,
  provider: z.string(),
  model: z.string(),
  revision: z.string().nullable(),
  dimensions: z.number().int().positive(),
  metric: z.string(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});

export type AiEmbeddingModel = z.infer<typeof aiEmbeddingModelSchema>;

export const aiEmbeddingModelListResponseSchema = z.object({
  models: z.array(aiEmbeddingModelSchema),
});

export type AiEmbeddingModelListResponse = z.infer<typeof aiEmbeddingModelListResponseSchema>;
