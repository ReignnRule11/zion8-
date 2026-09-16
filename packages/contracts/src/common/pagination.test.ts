import { describe, expect, it } from 'vitest';
import { paginatedSchema, paginationQuerySchema } from './pagination';
import { z } from 'zod';

describe('pagination', () => {
  it('applies sensible defaults', () => {
    const parsed = paginationQuerySchema.parse({});
    expect(parsed).toEqual({ limit: 50, offset: 0 });
  });

  it('coerces numeric strings from query parameters', () => {
    const parsed = paginationQuerySchema.parse({ limit: '25', offset: '75' });
    expect(parsed.limit).toBe(25);
    expect(parsed.offset).toBe(75);
  });

  it('rejects out-of-range limits', () => {
    expect(paginationQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ limit: '201' }).success).toBe(false);
  });

  it('rejects a negative offset', () => {
    expect(paginationQuerySchema.safeParse({ offset: '-1' }).success).toBe(false);
  });

  it('round-trips a paginated envelope', () => {
    const pageSchema = paginatedSchema(z.object({ id: z.string() }));
    const parsed = pageSchema.parse({
      items: [{ id: 'a' }],
      total: 1,
      limit: 50,
      offset: 0,
    });
    expect(parsed).toEqual({ items: [{ id: 'a' }], total: 1, limit: 50, offset: 0 });
  });

  it('rejects a page whose metadata is inconsistent', () => {
    const pageSchema = paginatedSchema(z.object({ id: z.string() }));
    expect(pageSchema.safeParse({ items: [], total: 0, limit: 0, offset: 0 }).success).toBe(false);
    expect(pageSchema.safeParse({ items: [], total: -1, limit: 50, offset: 0 }).success).toBe(
      false,
    );
  });
});
