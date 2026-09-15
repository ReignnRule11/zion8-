import { describe, expect, it } from 'vitest';
import { buildPaginationMeta, paginationQuerySchema, toSkipTake } from './pagination';

describe('pagination', () => {
  it('applies sensible defaults', () => {
    const parsed = paginationQuerySchema.parse({});
    expect(parsed).toEqual({ page: 1, pageSize: 20, sortDirection: 'desc' });
  });

  it('coerces numeric strings from query parameters', () => {
    const parsed = paginationQuerySchema.parse({ page: '3', pageSize: '50' });
    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(50);
  });

  it('rejects out-of-range page sizes', () => {
    expect(paginationQuerySchema.safeParse({ pageSize: '0' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });

  it('computes skip and take from the page', () => {
    expect(toSkipTake({ page: 4, pageSize: 25, sortDirection: 'desc' })).toEqual({
      skip: 75,
      take: 25,
    });
  });

  it('builds accurate pagination metadata', () => {
    expect(buildPaginationMeta(2, 10, 35)).toEqual({
      page: 2,
      pageSize: 10,
      total: 35,
      totalPages: 4,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('reports no pages for empty result sets', () => {
    const meta = buildPaginationMeta(1, 10, 0);
    expect(meta.totalPages).toBe(0);
    expect(meta.hasNextPage).toBe(false);
    expect(meta.hasPreviousPage).toBe(false);
  });
});
