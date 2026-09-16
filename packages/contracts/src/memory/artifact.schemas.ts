import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { uuidSchema } from '../common/primitives';

/**
 * The Digital Memory Engine archive.
 *
 * An artifact is any piece of institutional memory a church holds: a photograph,
 * a scanned minute book, a sermon recording, a bulletin, a certificate. Modality
 * is an attribute (`kind`), not a separate aggregate, so one pipeline and one
 * retrieval surface serve the whole archive.
 *
 * Bytes are immutable and content-addressed. Metadata that a person edits lives on
 * the artifact; everything derived by automation hangs off a specific version, so
 * re-processing never destroys what was known before.
 */

export const MemoryArtifactKind = {
  PHOTO: 'PHOTO',
  DOCUMENT: 'DOCUMENT',
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO',
  SERMON: 'SERMON',
  WORSHIP_SET: 'WORSHIP_SET',
  MEETING_MINUTE: 'MEETING_MINUTE',
  BULLETIN: 'BULLETIN',
  CERTIFICATE: 'CERTIFICATE',
  CORRESPONDENCE: 'CORRESPONDENCE',
  HISTORICAL: 'HISTORICAL',
  OTHER: 'OTHER',
} as const;

export type MemoryArtifactKind = (typeof MemoryArtifactKind)[keyof typeof MemoryArtifactKind];

export const memoryArtifactKindSchema = z.enum(
  Object.values(MemoryArtifactKind) as [MemoryArtifactKind, ...MemoryArtifactKind[]],
);

export const MemoryArtifactStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type MemoryArtifactStatus = (typeof MemoryArtifactStatus)[keyof typeof MemoryArtifactStatus];

export const memoryArtifactStatusSchema = z.enum(
  Object.values(MemoryArtifactStatus) as [MemoryArtifactStatus, ...MemoryArtifactStatus[]],
);

export const MemoryArtifactOrigin = {
  UPLOAD: 'UPLOAD',
  MEMBERSHIP_DOCUMENT: 'MEMBERSHIP_DOCUMENT',
  MEMBER_IMPORT: 'MEMBER_IMPORT',
  EXTERNAL: 'EXTERNAL',
} as const;

export type MemoryArtifactOrigin = (typeof MemoryArtifactOrigin)[keyof typeof MemoryArtifactOrigin];

export const memoryArtifactOriginSchema = z.enum(
  Object.values(MemoryArtifactOrigin) as [
    MemoryArtifactOrigin,
    ...MemoryArtifactOrigin[],
  ],
);

/**
 * How precisely the capture date is known. A labelled 1952 photograph is YEAR
 * precision; an undated letter is UNKNOWN. The engine reports the precision
 * rather than inventing a day, so the timeline never fabricates history.
 */
export const CaptureDatePrecision = {
  EXACT: 'EXACT',
  DAY: 'DAY',
  MONTH: 'MONTH',
  YEAR: 'YEAR',
  DECADE: 'DECADE',
  UNKNOWN: 'UNKNOWN',
} as const;

export type CaptureDatePrecision =
  (typeof CaptureDatePrecision)[keyof typeof CaptureDatePrecision];

export const captureDatePrecisionSchema = z.enum(
  Object.values(CaptureDatePrecision) as [CaptureDatePrecision, ...CaptureDatePrecision[]],
);

/**
 * What an artifact can be attached to. Links are how a photograph reaches every
 * member in it, and how a sermon reaches a series, a department, or a fund.
 */
export const MemoryLinkType = {
  MEMBER: 'MEMBER',
  FAMILY: 'FAMILY',
  DEPARTMENT: 'DEPARTMENT',
  VISITOR: 'VISITOR',
  EVENT: 'EVENT',
  SERMON: 'SERMON',
  GIVING_FUND: 'GIVING_FUND',
  TENANT: 'TENANT',
} as const;

export type MemoryLinkType = (typeof MemoryLinkType)[keyof typeof MemoryLinkType];

export const memoryLinkTypeSchema = z.enum(
  Object.values(MemoryLinkType) as [MemoryLinkType, ...MemoryLinkType[]],
);

/** 4 MiB decoded. Larger media moves to direct object-storage uploads. */
export const MAX_ARTIFACT_BYTES = 4_194_304;

export const ALLOWED_ARTIFACT_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/tiff',
  'image/gif',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/rtf',
  'text/plain',
  'text/markdown',
  'text/csv',
];

/**
 * Base64 of the maximum payload. The API accepts binary only over REST; the
 * GraphQL surface exposes metadata and download handles, never bytes.
 */
const base64Schema = z
  .string()
  .min(1)
  .max(Math.ceil((MAX_ARTIFACT_BYTES * 4) / 3) + 4)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Content must be base64 encoded');

export const memoryArtifactLinkSchema = z.object({
  linkType: memoryLinkTypeSchema,
  linkId: uuidSchema,
});

export type MemoryArtifactLinkRequest = z.infer<typeof memoryArtifactLinkSchema>;

export const memoryArtifactCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  kind: memoryArtifactKindSchema.default('OTHER'),
  capturedAt: z.string().datetime().optional(),
  datePrecision: captureDatePrecisionSchema.default('UNKNOWN'),
  tags: z.array(z.string().trim().min(1).max(64)).max(50).default([]),
  links: z.array(memoryArtifactLinkSchema).max(100).default([]),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(3).max(120),
  contentBase64: base64Schema,
});

export type MemoryArtifactCreateRequest = z.infer<typeof memoryArtifactCreateSchema>;

/**
 * A person may correct what the engine derived, but may not rewrite the bytes.
 * Setting a field to null clears an optional value.
 */
export const memoryArtifactUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  kind: memoryArtifactKindSchema.optional(),
  capturedAt: z.string().datetime().nullable().optional(),
  datePrecision: captureDatePrecisionSchema.optional(),
  tags: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
});

export type MemoryArtifactUpdateRequest = z.infer<typeof memoryArtifactUpdateSchema>;

export const memoryArtifactVersionSchema = z.object({
  id: uuidSchema,
  artifactId: uuidSchema,
  version: z.number().int().min(1),
  sha256: z.string().length(64),
  sizeBytes: z.number().int().min(0),
  fileName: z.string(),
  declaredContentType: z.string(),
  detectedContentType: z.string().nullable(),
  isCurrent: z.boolean(),
  createdAt: z.string().datetime(),
});

export type MemoryArtifactVersion = z.infer<typeof memoryArtifactVersionSchema>;

export const memoryArtifactLinkResponseSchema = z.object({
  id: uuidSchema,
  linkType: memoryLinkTypeSchema,
  linkId: uuidSchema,
  createdAt: z.string().datetime(),
});

export type MemoryArtifactLinkResponse = z.infer<typeof memoryArtifactLinkResponseSchema>;

/**
 * The list projection. It carries the current version because a browse grid needs
 * the file name, size, and type without loading the version history.
 */
export const memoryArtifactSummarySchema = z.object({
  id: uuidSchema,
  kind: memoryArtifactKindSchema,
  status: memoryArtifactStatusSchema,
  title: z.string(),
  description: z.string().nullable(),
  capturedAt: z.string().datetime().nullable(),
  datePrecision: captureDatePrecisionSchema,
  origin: memoryArtifactOriginSchema,
  sourceResourceType: z.string().nullable(),
  sourceResourceId: z.string().nullable(),
  tags: z.array(z.string()),
  duplicateOfArtifactId: uuidSchema.nullable(),
  currentVersion: memoryArtifactVersionSchema.nullable(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MemoryArtifactSummary = z.infer<typeof memoryArtifactSummarySchema>;

export const memoryArtifactResponseSchema = memoryArtifactSummarySchema.extend({
  tenantId: uuidSchema,
  links: z.array(memoryArtifactLinkResponseSchema),
  versions: z.array(memoryArtifactVersionSchema),
});

export type MemoryArtifactResponse = z.infer<typeof memoryArtifactResponseSchema>;

export const memoryArtifactListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  kind: memoryArtifactKindSchema.optional(),
  status: memoryArtifactStatusSchema.optional(),
  tag: z.string().trim().max(64).optional(),
  linkType: memoryLinkTypeSchema.optional(),
  linkId: uuidSchema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  includeArchived: z.coerce.boolean().optional(),
});

export type MemoryArtifactListQuery = z.infer<typeof memoryArtifactListQuerySchema>;

export const memoryArtifactPageSchema = paginatedSchema(memoryArtifactSummarySchema);

export type MemoryArtifactPage = z.infer<typeof memoryArtifactPageSchema>;

/** Selects a specific stored version when more than one exists. */
export const memoryVersionQuerySchema = z.object({
  versionId: uuidSchema.optional(),
});

export type MemoryVersionQuery = z.infer<typeof memoryVersionQuerySchema>;

export const memoryArtifactDownloadSchema = z.object({
  artifactId: uuidSchema,
  versionId: uuidSchema,
  url: z.string(),
  expiresInSeconds: z.number().int().positive(),
});

export type MemoryArtifactDownload = z.infer<typeof memoryArtifactDownloadSchema>;

/**
 * The processing stages a memory job moves through. The enum is shared with the
 * database; the API only ever exposes the stages a client may request.
 */
export const MemoryStage = {
  METADATA: 'METADATA',
  EXTRACT: 'EXTRACT',
  TRANSCRIBE: 'TRANSCRIBE',
  CATEGORIZE: 'CATEGORIZE',
  CHUNK: 'CHUNK',
  EMBED: 'EMBED',
  INDEX: 'INDEX',
  GRAPH: 'GRAPH',
  TIMELINE: 'TIMELINE',
} as const;

export type MemoryStage = (typeof MemoryStage)[keyof typeof MemoryStage];

export const memoryStageSchema = z.enum(
  Object.values(MemoryStage) as [MemoryStage, ...MemoryStage[]],
);

export const MemoryJobStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  SUCCEEDED: 'SUCCEEDED',
  BLOCKED: 'BLOCKED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type MemoryJobStatus = (typeof MemoryJobStatus)[keyof typeof MemoryJobStatus];

export const memoryJobStatusSchema = z.enum(
  Object.values(MemoryJobStatus) as [MemoryJobStatus, ...MemoryJobStatus[]],
);

export const memoryJobSummarySchema = z.object({
  id: uuidSchema,
  artifactId: uuidSchema,
  type: memoryStageSchema,
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

export type MemoryJobSummary = z.infer<typeof memoryJobSummarySchema>;

/**
 * Requesting reprocessing is how an administrator asks the engine to run stages
 * that need an external capability. When the capability is not configured the
 * job does not fail silently — it becomes BLOCKED and says why.
 */
export const memoryReprocessSchema = z.object({
  stages: z.array(memoryStageSchema).min(1).max(9).optional(),
});

export type MemoryReprocessRequest = z.infer<typeof memoryReprocessSchema>;

export const memoryReprocessResponseSchema = z.object({
  artifactId: uuidSchema,
  jobs: z.array(memoryJobSummarySchema),
});

export type MemoryReprocessResponse = z.infer<typeof memoryReprocessResponseSchema>;
