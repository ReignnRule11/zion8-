import { z } from 'zod';
import { bankTransactionKindSchema, reconciliationStatusSchema } from './enums';
import {
  isoDateSchema,
  moneyMinorSchema,
  paginatedSchema,
  paginationQuerySchema,
  signedMoneyMinorSchema,
  uuidSchema,
} from './primitives';

export const bankAccountCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  institution: z.string().trim().max(120).optional(),
  accountNumberMasked: z.string().trim().max(32).optional(),
  glAccountId: uuidSchema,
});

export type BankAccountCreateRequest = z.infer<typeof bankAccountCreateSchema>;

export const bankAccountListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
});

export type BankAccountListQuery = z.infer<typeof bankAccountListQuerySchema>;

export const bankAccountSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  name: z.string(),
  institution: z.string().nullable(),
  accountNumberMasked: z.string().nullable(),
  glAccountId: uuidSchema,
  glAccountCode: z.string(),
  glAccountName: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BankAccount = z.infer<typeof bankAccountSchema>;

export const bankAccountPageSchema = paginatedSchema(bankAccountSchema);

export type BankAccountPage = z.infer<typeof bankAccountPageSchema>;

export const bankTransactionCreateSchema = z.object({
  occurredOn: isoDateSchema,
  amountMinor: moneyMinorSchema.refine((value) => value > 0, 'Amount must be greater than zero'),
  kind: bankTransactionKindSchema,
  description: z.string().trim().min(1).max(240),
  externalRef: z.string().trim().max(80).optional(),
});

export type BankTransactionCreateRequest = z.infer<typeof bankTransactionCreateSchema>;

export const bankTransactionListQuerySchema = paginationQuerySchema.extend({
  unmatchedOnly: z.coerce.boolean().optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export type BankTransactionListQuery = z.infer<typeof bankTransactionListQuerySchema>;

export const bankTransactionSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  bankAccountId: uuidSchema,
  occurredOn: isoDateSchema,
  amountMinor: z.number().int(),
  kind: bankTransactionKindSchema,
  description: z.string(),
  externalRef: z.string().nullable(),
  matchedJournalId: uuidSchema.nullable(),
  createdAt: z.string().datetime(),
});

export type BankTransaction = z.infer<typeof bankTransactionSchema>;

export const bankTransactionPageSchema = paginatedSchema(bankTransactionSchema);

export type BankTransactionPage = z.infer<typeof bankTransactionPageSchema>;

export const reconciliationCreateSchema = z.object({
  statementOn: isoDateSchema,
  statementBalanceMinor: signedMoneyMinorSchema,
});

export type ReconciliationCreateRequest = z.infer<typeof reconciliationCreateSchema>;

export const reconciliationMatchSchema = z.object({
  bankTransactionId: uuidSchema,
  journalId: uuidSchema,
});

export type ReconciliationMatchRequest = z.infer<typeof reconciliationMatchSchema>;

export const reconciliationSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  bankAccountId: uuidSchema,
  bankAccountName: z.string(),
  statementOn: isoDateSchema,
  statementBalanceMinor: z.number().int(),
  bookBalanceMinor: z.number().int(),
  differenceMinor: z.number().int(),
  status: reconciliationStatusSchema,
  completedAt: z.string().datetime().nullable(),
  matchedCount: z.number().int(),
  unmatchedCount: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Reconciliation = z.infer<typeof reconciliationSchema>;

export const reconciliationListQuerySchema = paginationQuerySchema.extend({
  status: reconciliationStatusSchema.optional(),
});

export type ReconciliationListQuery = z.infer<typeof reconciliationListQuerySchema>;

export const reconciliationPageSchema = paginatedSchema(reconciliationSchema);

export type ReconciliationPage = z.infer<typeof reconciliationPageSchema>;
