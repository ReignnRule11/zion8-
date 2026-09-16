import { z } from 'zod';

/**
 * List endpoints share one pagination contract: a bounded page size and an
 * offset. Offset pagination is deliberate here — church lists are sorted by a
 * name or a date the administrator chose, not by an opaque cursor, and the
 * volumes are small enough that skipping is cheap.
 */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().min(0),
    limit: z.number().int().positive(),
    offset: z.number().int().min(0),
  });
}
