import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { uuidSchema } from '../common/primitives';

export const sermonNoteCreateSchema = z.object({
  body: z.string().trim().min(1).max(8000),
  timestampMs: z.number().int().min(0).optional(),
});

export type SermonNoteCreateRequest = z.infer<typeof sermonNoteCreateSchema>;

export const sermonNoteUpdateSchema = z.object({
  body: z.string().trim().min(1).max(8000).optional(),
  timestampMs: z.number().int().min(0).nullable().optional(),
});

export type SermonNoteUpdateRequest = z.infer<typeof sermonNoteUpdateSchema>;

export const sermonNoteListQuerySchema = paginationQuerySchema;

export type SermonNoteListQuery = z.infer<typeof sermonNoteListQuerySchema>;

export const sermonNoteSchema = z.object({
  id: uuidSchema,
  sermonId: uuidSchema,
  userId: uuidSchema,
  body: z.string(),
  timestampMs: z.number().int().min(0).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SermonNote = z.infer<typeof sermonNoteSchema>;

export const sermonNotePageSchema = paginatedSchema(sermonNoteSchema);

export type SermonNotePage = z.infer<typeof sermonNotePageSchema>;
