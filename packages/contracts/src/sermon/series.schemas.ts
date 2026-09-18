import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { slugSchema, uuidSchema } from '../common/primitives';
import { sermonVisibilitySchema } from './sermon.schemas';

export const sermonSeriesCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(240).optional(),
  description: z.string().trim().max(8000).optional(),
  slug: slugSchema.optional(),
  visibility: sermonVisibilitySchema.default('MEMBERS'),
  startsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date such as 2024-03-17')
    .optional(),
  endsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date such as 2024-03-17')
    .optional(),
});

export type SermonSeriesCreateRequest = z.infer<typeof sermonSeriesCreateSchema>;

export const sermonSeriesUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  subtitle: z.string().trim().max(240).nullable().optional(),
  description: z.string().trim().max(8000).nullable().optional(),
  slug: slugSchema.optional(),
  visibility: sermonVisibilitySchema.optional(),
  startsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date such as 2024-03-17')
    .nullable()
    .optional(),
  endsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date such as 2024-03-17')
    .nullable()
    .optional(),
});

export type SermonSeriesUpdateRequest = z.infer<typeof sermonSeriesUpdateSchema>;

export const sermonSeriesListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  includeArchived: z.coerce.boolean().optional(),
});

export type SermonSeriesListQuery = z.infer<typeof sermonSeriesListQuerySchema>;

export const sermonSeriesSummarySchema = z.object({
  id: uuidSchema,
  slug: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  visibility: sermonVisibilitySchema,
  startsOn: z.string().nullable(),
  endsOn: z.string().nullable(),
  sermonCount: z.number().int().min(0),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type SermonSeriesSummary = z.infer<typeof sermonSeriesSummarySchema>;

export const sermonSeriesPageSchema = paginatedSchema(sermonSeriesSummarySchema);

export type SermonSeriesPage = z.infer<typeof sermonSeriesPageSchema>;

export const sermonSeriesResponseSchema = sermonSeriesSummarySchema.extend({
  tenantId: uuidSchema,
  description: z.string().nullable(),
});

export type SermonSeriesResponse = z.infer<typeof sermonSeriesResponseSchema>;
