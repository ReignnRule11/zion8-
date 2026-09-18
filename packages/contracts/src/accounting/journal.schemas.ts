import { z } from 'zod';
import { journalSourceSchema, journalStatusSchema } from './enums';
import {
  isoDateSchema,
  moneyMinorSchema,
  paginatedSchema,
  paginationQuerySchema,
  uuidSchema,
} from './primitives';

export const journalLineInputSchema = z.object({
  accountId: uuidSchema,
  description: z.string().trim().max(240).optional(),
  debitMinor: moneyMinorSchema.default(0),
  creditMinor: moneyMinorSchema.default(0),
  fundId: uuidSchema.optional(),
  projectId: uuidSchema.optional(),
  departmentId: uuidSchema.optional(),
});

export const journalCreateSchema = z
  .object({
    memo: z.string().trim().min(1).max(240),
    occurredOn: isoDateSchema,
    source: journalSourceSchema.default('MANUAL'),
    reference: z.string().trim().max(80).optional(),
    lines: z.array(journalLineInputSchema).min(2).max(200),
  })
  .superRefine((value, ctx) => {
    const debit = value.lines.reduce((sum, line) => sum + line.debitMinor, 0);
    const credit = value.lines.reduce((sum, line) => sum + line.creditMinor, 0);
    if (debit !== credit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Journal entries must balance: total debit must equal total credit',
        path: ['lines'],
      });
    }
    if (debit === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A journal must have a non-zero amount',
        path: ['lines'],
      });
    }
    for (const [index, line] of value.lines.entries()) {
      if (line.debitMinor > 0 && line.creditMinor > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A line cannot debit and credit at the same time',
          path: ['lines', index],
        });
      }
      if (line.debitMinor === 0 && line.creditMinor === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A line must have a debit or a credit',
          path: ['lines', index],
        });
      }
    }
  });

export type JournalCreateRequest = z.infer<typeof journalCreateSchema>;

export const journalListQuerySchema = paginationQuerySchema.extend({
  status: journalStatusSchema.optional(),
  source: journalSourceSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  search: z.string().trim().max(200).optional(),
});

export type JournalListQuery = z.infer<typeof journalListQuerySchema>;

export const journalLineSchema = z.object({
  id: uuidSchema,
  accountId: uuidSchema,
  accountCode: z.string(),
  accountName: z.string(),
  description: z.string().nullable(),
  debitMinor: z.number().int(),
  creditMinor: z.number().int(),
  fundId: uuidSchema.nullable(),
  projectId: uuidSchema.nullable(),
  departmentId: uuidSchema.nullable(),
});

export type JournalLine = z.infer<typeof journalLineSchema>;

export const journalSummarySchema = z.object({
  id: uuidSchema,
  number: z.number().int(),
  memo: z.string(),
  occurredOn: isoDateSchema,
  status: journalStatusSchema,
  source: journalSourceSchema,
  reference: z.string().nullable(),
  debitMinor: z.number().int(),
  creditMinor: z.number().int(),
  postedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export type JournalSummary = z.infer<typeof journalSummarySchema>;

export const journalPageSchema = paginatedSchema(journalSummarySchema);

export type JournalPage = z.infer<typeof journalPageSchema>;

export const journalSchema = journalSummarySchema.extend({
  tenantId: uuidSchema,
  periodId: uuidSchema.nullable(),
  createdByUserId: uuidSchema.nullable(),
  postedByUserId: uuidSchema.nullable(),
  voidedAt: z.string().datetime().nullable(),
  voidReason: z.string().nullable(),
  lines: z.array(journalLineSchema),
  updatedAt: z.string().datetime(),
});

export type Journal = z.infer<typeof journalSchema>;

export const journalVoidSchema = z.object({
  reason: z.string().trim().min(1).max(240),
});

export type JournalVoidRequest = z.infer<typeof journalVoidSchema>;
