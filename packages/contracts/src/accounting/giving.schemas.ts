import { z } from 'zod';
import { contributionMethodSchema, contributionStatusSchema, fundStatusSchema } from './enums';
import {
  currencySchema,
  isoDateSchema,
  moneyMinorSchema,
  paginatedSchema,
  paginationQuerySchema,
  uuidSchema,
} from './primitives';

export const fundCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  restricted: z.boolean().default(false),
  revenueAccountId: uuidSchema.optional(),
  assetAccountId: uuidSchema.optional(),
});

export type FundCreateRequest = z.infer<typeof fundCreateSchema>;

export const fundUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  restricted: z.boolean().optional(),
  revenueAccountId: uuidSchema.nullable().optional(),
  assetAccountId: uuidSchema.nullable().optional(),
  status: fundStatusSchema.optional(),
});

export type FundUpdateRequest = z.infer<typeof fundUpdateSchema>;

export const fundListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  includeArchived: z.coerce.boolean().optional(),
});

export type FundListQuery = z.infer<typeof fundListQuerySchema>;

export const fundSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  restricted: z.boolean(),
  status: fundStatusSchema,
  revenueAccountId: uuidSchema.nullable(),
  assetAccountId: uuidSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Fund = z.infer<typeof fundSchema>;

export const fundPageSchema = paginatedSchema(fundSchema);

export type FundPage = z.infer<typeof fundPageSchema>;

export const contributionCreateSchema = z.object({
  memberId: uuidSchema.optional(),
  donorName: z.string().trim().max(120).optional(),
  fundId: uuidSchema,
  amountMinor: moneyMinorSchema.refine((value) => value > 0, 'Amount must be greater than zero'),
  currency: currencySchema.default('USD'),
  method: contributionMethodSchema.default('CASH'),
  receivedOn: isoDateSchema,
  externalRef: z.string().trim().max(80).optional(),
  note: z.string().trim().max(500).optional(),
  taxDeductible: z.boolean().default(true),
});

export type ContributionCreateRequest = z.infer<typeof contributionCreateSchema>;

export const contributionListQuerySchema = paginationQuerySchema.extend({
  memberId: uuidSchema.optional(),
  fundId: uuidSchema.optional(),
  status: contributionStatusSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  search: z.string().trim().max(200).optional(),
});

export type ContributionListQuery = z.infer<typeof contributionListQuerySchema>;

export const contributionSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  memberId: uuidSchema.nullable(),
  donorName: z.string().nullable(),
  fundId: uuidSchema,
  fundName: z.string(),
  amountMinor: z.number().int(),
  currency: z.string(),
  method: contributionMethodSchema,
  status: contributionStatusSchema,
  receivedOn: isoDateSchema,
  externalRef: z.string().nullable(),
  note: z.string().nullable(),
  taxDeductible: z.boolean(),
  journalId: uuidSchema.nullable(),
  refundOfId: uuidSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Contribution = z.infer<typeof contributionSchema>;

export const contributionPageSchema = paginatedSchema(contributionSchema);

export type ContributionPage = z.infer<typeof contributionPageSchema>;

export const contributionRefundSchema = z.object({
  reason: z.string().trim().min(1).max(240),
});

export type ContributionRefundRequest = z.infer<typeof contributionRefundSchema>;
