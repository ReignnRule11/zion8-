import { z } from 'zod';
import { accountTypeSchema, reportKindSchema } from './enums';
import { isoDateSchema, uuidSchema } from './primitives';

export const reportQuerySchema = z.object({
  kind: reportKindSchema,
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  asOf: isoDateSchema.optional(),
  budgetId: uuidSchema.optional(),
  projectId: uuidSchema.optional(),
  memberId: uuidSchema.optional(),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const reportLineSchema = z.object({
  accountId: uuidSchema.nullable(),
  accountCode: z.string().nullable(),
  accountName: z.string(),
  accountType: accountTypeSchema.nullable(),
  debitMinor: z.number().int(),
  creditMinor: z.number().int(),
  balanceMinor: z.number().int(),
  budgetMinor: z.number().int().nullable(),
  actualMinor: z.number().int().nullable(),
  varianceMinor: z.number().int().nullable(),
});

export type ReportLine = z.infer<typeof reportLineSchema>;

export const reportSectionSchema = z.object({
  name: z.string(),
  totalMinor: z.number().int(),
  lines: z.array(reportLineSchema),
});

export type ReportSection = z.infer<typeof reportSectionSchema>;

export const reportSchema = z.object({
  kind: reportKindSchema,
  title: z.string(),
  generatedAt: z.string().datetime(),
  from: isoDateSchema.nullable(),
  to: isoDateSchema.nullable(),
  asOf: isoDateSchema.nullable(),
  currency: z.string(),
  sections: z.array(reportSectionSchema),
  netMinor: z.number().int(),
});

export type Report = z.infer<typeof reportSchema>;

export const ledgerBalanceSchema = z.object({
  accountId: uuidSchema,
  accountCode: z.string(),
  accountName: z.string(),
  accountType: accountTypeSchema,
  debitMinor: z.number().int(),
  creditMinor: z.number().int(),
  balanceMinor: z.number().int(),
});

export type LedgerBalance = z.infer<typeof ledgerBalanceSchema>;
