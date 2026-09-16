import { z } from 'zod';
import { uuidSchema } from '../common/primitives';

/**
 * AI summary of a member.
 *
 * The summary is a persisted projection, not a live call: it records which
 * provider produced it, when, and which version of the member's data it saw, so
 * a stale summary is detectable and regeneration is explainable. The provider
 * itself is a port — a deterministic analyzer by default, an LLM when the
 * workspace configures one.
 */

export const SummaryStatus = {
  FRESH: 'FRESH',
  STALE: 'STALE',
  GENERATING: 'GENERATING',
  FAILED: 'FAILED',
} as const;

export type SummaryStatus = (typeof SummaryStatus)[keyof typeof SummaryStatus];

export const summaryStatusSchema = z.enum(
  Object.values(SummaryStatus) as [SummaryStatus, ...SummaryStatus[]],
);

export const SummaryProviderKind = {
  DETERMINISTIC: 'DETERMINISTIC',
  LLM: 'LLM',
} as const;

export type SummaryProviderKind =
  (typeof SummaryProviderKind)[keyof typeof SummaryProviderKind];

export const summaryProviderKindSchema = z.enum(
  Object.values(SummaryProviderKind) as [SummaryProviderKind, ...SummaryProviderKind[]],
);

/** The structured facts the summary is built from. Persisted alongside the text. */
export const memberAiSummaryFactsSchema = z.object({
  tenureDays: z.number().int().min(0),
  attendanceRate: z.number().min(0).max(1),
  sessionsAttended: z.number().int().min(0),
  sessionsRecorded: z.number().int().min(0),
  currentStreak: z.number().int().min(0),
  lastAttendedAt: z.string().datetime().nullable(),
  familyCount: z.number().int().min(0),
  relationshipCount: z.number().int().min(0),
  departmentCount: z.number().int().min(0),
  volunteerRoleCount: z.number().int().min(0),
  documentCount: z.number().int().min(0),
  timelineEventCount: z.number().int().min(0),
  openFollowUps: z.number().int().min(0),
  tags: z.array(z.string()),
});

export type MemberAiSummaryFacts = z.infer<typeof memberAiSummaryFactsSchema>;

export const memberAiSummaryResponseSchema = z.object({
  memberId: uuidSchema,
  status: summaryStatusSchema,
  provider: summaryProviderKindSchema,
  model: z.string().nullable(),
  content: z.string().nullable(),
  highlights: z.array(z.string()),
  facts: memberAiSummaryFactsSchema.nullable(),
  generatedAt: z.string().datetime().nullable(),
  sourceVersion: z.number().int().min(0),
  error: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MemberAiSummaryResponse = z.infer<typeof memberAiSummaryResponseSchema>;

export const generateSummarySchema = z.object({
  force: z.boolean().default(false),
  focus: z.string().trim().max(300).optional(),
});

export type GenerateSummaryRequest = z.infer<typeof generateSummarySchema>;
