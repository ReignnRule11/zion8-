import { z } from 'zod';
import { paginationQuerySchema } from '../common/pagination';
import { uuidSchema } from '../common/primitives';

/**
 * Zion AI retrieval.
 *
 * The retrieval engine is shared by every capability. A capability is a scope: a
 * filter set, a prompt, and an output contract. Search itself needs no model, so
 * it remains fully available when generation is unavailable or refused.
 */

/**
 * The capabilities the engine exposes. Each one is a scoped retrieval over the
 * same index, not a separate pipeline.
 */
export const AiCapability = {
  KNOWLEDGE_SEARCH: 'KNOWLEDGE_SEARCH',
  HISTORICAL_SEARCH: 'HISTORICAL_SEARCH',
  DOCUMENT_QA: 'DOCUMENT_QA',
  SERMON_SEARCH: 'SERMON_SEARCH',
  PRAYER_INSIGHTS: 'PRAYER_INSIGHTS',
  MEETING_SUMMARY: 'MEETING_SUMMARY',
  EVENT_RECOMMENDATION: 'EVENT_RECOMMENDATION',
  VOLUNTEER_RECOMMENDATION: 'VOLUNTEER_RECOMMENDATION',
} as const;

export type AiCapability = (typeof AiCapability)[keyof typeof AiCapability];

export const aiCapabilitySchema = z.enum(
  Object.values(AiCapability) as [AiCapability, ...AiCapability[]],
);

/** Which domain row a passage or citation came from. */
export const AiSourceType = {
  MEMORY_ARTIFACT: 'MEMORY_ARTIFACT',
  SERMON: 'SERMON',
  MEETING: 'MEETING',
  MEMBER_TIMELINE: 'MEMBER_TIMELINE',
  PRAYER_REQUEST: 'PRAYER_REQUEST',
  EVENT: 'EVENT',
  MEMBER: 'MEMBER',
} as const;

export type AiSourceType = (typeof AiSourceType)[keyof typeof AiSourceType];

export const aiSourceTypeSchema = z.enum(
  Object.values(AiSourceType) as [AiSourceType, ...AiSourceType[]],
);

/**
 * How sensitive a document's content is. A document is only retrievable by a
 * principal holding `requiredPermission`; the level is a second, coarser axis so
 * an administrator can reason about the corpus without knowing every permission.
 */
export const AiSensitivity = {
  PUBLIC: 'PUBLIC',
  INTERNAL: 'INTERNAL',
  CONFIDENTIAL: 'CONFIDENTIAL',
  RESTRICTED: 'RESTRICTED',
} as const;

export type AiSensitivity = (typeof AiSensitivity)[keyof typeof AiSensitivity];

export const aiSensitivitySchema = z.enum(
  Object.values(AiSensitivity) as [AiSensitivity, ...AiSensitivity[]],
);

/** Which runtime produced an embedding or an answer. */
export const AiProviderKind = {
  DETERMINISTIC: 'DETERMINISTIC',
  LLM: 'LLM',
} as const;

export type AiProviderKind = (typeof AiProviderKind)[keyof typeof AiProviderKind];

export const aiProviderKindSchema = z.enum(
  Object.values(AiProviderKind) as [AiProviderKind, ...AiProviderKind[]],
);

/** Why an answer carries no generated prose. */
export const AiAbstentionReason = {
  NO_EVIDENCE: 'NO_EVIDENCE',
  BELOW_SUPPORT_THRESHOLD: 'BELOW_SUPPORT_THRESHOLD',
  CAPABILITY_UNAVAILABLE: 'CAPABILITY_UNAVAILABLE',
  NO_PROVIDER: 'NO_PROVIDER',
  PROVIDER_FAILED: 'PROVIDER_FAILED',
} as const;

export type AiAbstentionReason = (typeof AiAbstentionReason)[keyof typeof AiAbstentionReason];

export const aiAbstentionReasonSchema = z.enum(
  Object.values(AiAbstentionReason) as [AiAbstentionReason, ...AiAbstentionReason[]],
);

/** The stages a source document moves through to become searchable. */
export const AiDocumentStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  INDEXED: 'INDEXED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  STALE: 'STALE',
} as const;

export type AiDocumentStatus = (typeof AiDocumentStatus)[keyof typeof AiDocumentStatus];

export const aiDocumentStatusSchema = z.enum(
  Object.values(AiDocumentStatus) as [AiDocumentStatus, ...AiDocumentStatus[]],
);

export const MAX_QUERY_LENGTH = 1000;
export const MAX_SEARCH_LIMIT = 50;
export const DEFAULT_SEARCH_LIMIT = 10;

/**
 * A verified pointer back to the church's own record. Every claim in a generated
 * answer must resolve to one of these, and a citation is only ever constructed on
 * the server from a row the caller is permitted to read.
 */
export const aiCitationSchema = z.object({
  chunkId: uuidSchema,
  documentId: uuidSchema,
  sourceType: aiSourceTypeSchema,
  sourceId: uuidSchema,
  sourceVersionId: uuidSchema.nullable(),
  title: z.string(),
  snippet: z.string(),
  charStart: z.number().int().min(0).nullable(),
  charEnd: z.number().int().min(0).nullable(),
  page: z.number().int().min(1).nullable(),
  startMs: z.number().int().min(0).nullable(),
  endMs: z.number().int().min(0).nullable(),
});

export type AiCitation = z.infer<typeof aiCitationSchema>;

/** A retrieved passage: the content the model is allowed to reason over. */
export const aiPassageSchema = z.object({
  chunkId: uuidSchema,
  documentId: uuidSchema,
  ordinal: z.number().int().min(0),
  content: z.string(),
  score: z.number(),
  citation: aiCitationSchema,
});

export type AiPassage = z.infer<typeof aiPassageSchema>;

/**
 * Structured filters. They are applied inside the SQL query, alongside Row-Level
 * Security and the permission filter, so a filter can never be the only thing
 * separating one church's content from another's.
 */
export const aiFiltersSchema = z.object({
  sourceTypes: z.array(aiSourceTypeSchema).max(8).optional(),
  sourceIds: z.array(uuidSchema).max(100).optional(),
  kinds: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
  tags: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
  entities: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  language: z.string().trim().min(2).max(16).optional(),
});

export type AiFilters = z.infer<typeof aiFiltersSchema>;

export const aiSearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(MAX_QUERY_LENGTH),
  capability: aiCapabilitySchema.default('KNOWLEDGE_SEARCH'),
  filters: aiFiltersSchema.default({}),
  limit: z.coerce.number().int().min(1).max(MAX_SEARCH_LIMIT).default(DEFAULT_SEARCH_LIMIT),
});

export type AiSearchRequest = z.infer<typeof aiSearchRequestSchema>;

/**
 * `abstained` on a search response means retrieval found nothing that met the
 * evidence threshold. It is reported rather than hidden so a client can say
 * "nothing in the archive matches" instead of rendering an empty list.
 */
export const aiSearchResponseSchema = z.object({
  query: z.string(),
  capability: aiCapabilitySchema,
  passages: z.array(aiPassageSchema),
  abstained: z.boolean(),
  candidateCount: z.number().int().min(0),
  embeddingModel: z.string().nullable(),
  tookMs: z.number().int().min(0),
});

export type AiSearchResponse = z.infer<typeof aiSearchResponseSchema>;

/** Filters a client may save and reuse as a scope (for example, one document set). */
export const aiScopeSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  filters: aiFiltersSchema.default({}),
});

export type AiScope = z.infer<typeof aiScopeSchema>;

export const aiSearchHistoryQuerySchema = paginationQuerySchema.extend({
  capability: aiCapabilitySchema.optional(),
});

export type AiSearchHistoryQuery = z.infer<typeof aiSearchHistoryQuerySchema>;
