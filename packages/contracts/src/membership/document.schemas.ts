import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { uuidSchema } from '../common/primitives';

/**
 * Member documents: baptism certificates, membership letters, consent forms,
 * pastoral notes. Stored metadata-first so the record survives independently of
 * the bytes, and the bytes live behind a storage port (local disk in
 * development, object storage in production).
 */

export const DocumentCategory = {
  IDENTITY: 'IDENTITY',
  CERTIFICATE: 'CERTIFICATE',
  CONSENT: 'CONSENT',
  MEDICAL: 'MEDICAL',
  FINANCIAL: 'FINANCIAL',
  PASTORAL: 'PASTORAL',
  LEGAL: 'LEGAL',
  MEDIA: 'MEDIA',
  OTHER: 'OTHER',
} as const;

export type DocumentCategory = (typeof DocumentCategory)[keyof typeof DocumentCategory];

export const documentCategorySchema = z.enum(
  Object.values(DocumentCategory) as [DocumentCategory, ...DocumentCategory[]],
);

export const DocumentStatus = {
  PENDING: 'PENDING',
  AVAILABLE: 'AVAILABLE',
  ARCHIVED: 'ARCHIVED',
  FAILED: 'FAILED',
} as const;

export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

export const documentStatusSchema = z.enum(
  Object.values(DocumentStatus) as [DocumentStatus, ...DocumentStatus[]],
);

/** 512 KiB decoded. Larger files should upload directly to object storage. */
export const MAX_DOCUMENT_BYTES = 524_288;

export const ALLOWED_DOCUMENT_TYPES: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const base64Schema = z
  .string()
  .min(1)
  .max(Math.ceil((MAX_DOCUMENT_BYTES * 4) / 3) + 4)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Content must be base64 encoded');

export const documentUploadSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: documentCategorySchema.default('OTHER'),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(3).max(120),
  contentBase64: base64Schema,
  expiresAt: z.string().datetime().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type DocumentUploadRequest = z.infer<typeof documentUploadSchema>;

export const documentUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category: documentCategorySchema.optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export type DocumentUpdateRequest = z.infer<typeof documentUpdateSchema>;

export const documentResponseSchema = z.object({
  id: uuidSchema,
  memberId: uuidSchema,
  title: z.string(),
  category: documentCategorySchema,
  status: documentStatusSchema,
  fileName: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int().min(0),
  checksum: z.string().nullable(),
  notes: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  uploadedByUserId: uuidSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type DocumentResponse = z.infer<typeof documentResponseSchema>;

export const documentDownloadSchema = z.object({
  documentId: uuidSchema,
  url: z.string(),
  expiresInSeconds: z.number().int().positive(),
});

export type DocumentDownload = z.infer<typeof documentDownloadSchema>;

export const documentListQuerySchema = paginationQuerySchema.extend({
  category: documentCategorySchema.optional(),
  status: documentStatusSchema.optional(),
  search: z.string().trim().max(120).optional(),
});

export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;

export const documentPageSchema = paginatedSchema(documentResponseSchema);

export type DocumentPage = z.infer<typeof documentPageSchema>;
