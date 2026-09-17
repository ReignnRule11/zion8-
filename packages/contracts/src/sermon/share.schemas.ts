import { z } from 'zod';
import { uuidSchema } from '../common/primitives';

export const sermonShareCreateSchema = z.object({
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export type SermonShareCreateRequest = z.infer<typeof sermonShareCreateSchema>;

export const sermonShareSchema = z.object({
  id: uuidSchema,
  sermonId: uuidSchema,
  token: z.string().min(16).max(64),
  url: z.string(),
  expiresAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type SermonShare = z.infer<typeof sermonShareSchema>;
