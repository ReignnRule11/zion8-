import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { uuidSchema } from '../common/primitives';

/**
 * The timeline is the append-only story of a person inside the church. It is
 * written by the domain as things actually happen — a membership recorded, a
 * service attended, a department joined, a document filed — rather than being
 * assembled at read time. That makes it stable, auditable, and the substrate the
 * AI summary reads from.
 */

export const TimelineEventType = {
  MEMBERSHIP: 'MEMBERSHIP',
  ATTENDANCE: 'ATTENDANCE',
  RELATIONSHIP: 'RELATIONSHIP',
  FAMILY: 'FAMILY',
  DEPARTMENT: 'DEPARTMENT',
  VOLUNTEER: 'VOLUNTEER',
  DOCUMENT: 'DOCUMENT',
  VISITOR: 'VISITOR',
  CONVERSION: 'CONVERSION',
  NOTE: 'NOTE',
  SUMMARY: 'SUMMARY',
  SYSTEM: 'SYSTEM',
} as const;

export type TimelineEventType = (typeof TimelineEventType)[keyof typeof TimelineEventType];

export const timelineEventTypeSchema = z.enum(
  Object.values(TimelineEventType) as [TimelineEventType, ...TimelineEventType[]],
);

/** Only NOTE entries are authored by a person; the rest are derived. */
export const MANUAL_TIMELINE_TYPES: readonly TimelineEventType[] = [TimelineEventType.NOTE];

export const timelineEntrySchema = z.object({
  type: timelineEventTypeSchema,
  occurredAt: z.string().datetime(),
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(2000).optional(),
  metadata: z.record(z.unknown()).default({}),
  sourceResourceType: z.string().trim().max(64).optional(),
  sourceResourceId: z.string().trim().max(128).optional(),
});

export type TimelineEntryRequest = z.infer<typeof timelineEntrySchema>;

export const timelineNoteSchema = z.object({
  title: z.string().trim().min(1).max(160),
  summary: z.string().trim().max(2000).optional(),
  occurredAt: z.string().datetime().optional(),
});

export type TimelineNoteRequest = z.infer<typeof timelineNoteSchema>;

export const timelineEntryResponseSchema = z.object({
  id: uuidSchema,
  memberId: uuidSchema,
  type: timelineEventTypeSchema,
  occurredAt: z.string().datetime(),
  title: z.string(),
  summary: z.string().nullable(),
  metadata: z.record(z.unknown()),
  sourceResourceType: z.string().nullable(),
  sourceResourceId: z.string().nullable(),
  createdByUserId: uuidSchema.nullable(),
  createdAt: z.string().datetime(),
});

export type TimelineEntryResponse = z.infer<typeof timelineEntryResponseSchema>;

export const timelineQuerySchema = paginationQuerySchema.extend({
  types: z
    .union([timelineEventTypeSchema, z.array(timelineEventTypeSchema)])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  search: z.string().trim().max(120).optional(),
});

export type TimelineQuery = z.infer<typeof timelineQuerySchema>;

export const timelinePageSchema = paginatedSchema(timelineEntryResponseSchema);

export type TimelinePage = z.infer<typeof timelinePageSchema>;
