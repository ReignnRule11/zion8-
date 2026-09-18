import { z } from 'zod';
import { budgetStatusSchema, projectStatusSchema } from './enums';
import {
  isoDateSchema,
  moneyMinorSchema,
  paginatedSchema,
  paginationQuerySchema,
  uuidSchema,
} from './primitives';

export const budgetLineInputSchema = z.object({
  accountId: uuidSchema,
  amountMinor: moneyMinorSchema,
  notes: z.string().trim().max(240).optional(),
});

export const budgetCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    startsOn: isoDateSchema,
    endsOn: isoDateSchema,
    notes: z.string().trim().max(2000).optional(),
    lines: z.array(budgetLineInputSchema).min(1).max(500),
  })
  .refine((value) => value.startsOn <= value.endsOn, {
    message: 'Budget end must be on or after the start date',
    path: ['endsOn'],
  });

export type BudgetCreateRequest = z.infer<typeof budgetCreateSchema>;

export const budgetListQuerySchema = paginationQuerySchema.extend({
  status: budgetStatusSchema.optional(),
  search: z.string().trim().max(200).optional(),
});

export type BudgetListQuery = z.infer<typeof budgetListQuerySchema>;

export const budgetLineSchema = z.object({
  id: uuidSchema,
  accountId: uuidSchema,
  accountCode: z.string(),
  accountName: z.string(),
  amountMinor: z.number().int(),
  actualMinor: z.number().int(),
  varianceMinor: z.number().int(),
  notes: z.string().nullable(),
});

export type BudgetLine = z.infer<typeof budgetLineSchema>;

export const budgetSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  name: z.string(),
  startsOn: isoDateSchema,
  endsOn: isoDateSchema,
  status: budgetStatusSchema,
  notes: z.string().nullable(),
  totalMinor: z.number().int(),
  actualMinor: z.number().int(),
  lines: z.array(budgetLineSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Budget = z.infer<typeof budgetSchema>;

export const budgetSummarySchema = budgetSchema.omit({ lines: true });

export type BudgetSummary = z.infer<typeof budgetSummarySchema>;

export const budgetPageSchema = paginatedSchema(budgetSummarySchema);

export type BudgetPage = z.infer<typeof budgetPageSchema>;

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  startsOn: isoDateSchema.optional(),
  endsOn: isoDateSchema.optional(),
  budgetMinor: moneyMinorSchema.default(0),
  expenseAccountId: uuidSchema.optional(),
});

export type ProjectCreateRequest = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  startsOn: isoDateSchema.nullable().optional(),
  endsOn: isoDateSchema.nullable().optional(),
  budgetMinor: moneyMinorSchema.optional(),
  expenseAccountId: uuidSchema.nullable().optional(),
  status: projectStatusSchema.optional(),
});

export type ProjectUpdateRequest = z.infer<typeof projectUpdateSchema>;

export const projectListQuerySchema = paginationQuerySchema.extend({
  status: projectStatusSchema.optional(),
  search: z.string().trim().max(200).optional(),
});

export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;

export const projectSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  status: projectStatusSchema,
  startsOn: isoDateSchema.nullable(),
  endsOn: isoDateSchema.nullable(),
  budgetMinor: z.number().int(),
  spentMinor: z.number().int(),
  remainingMinor: z.number().int(),
  expenseAccountId: uuidSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Project = z.infer<typeof projectSchema>;

export const projectPageSchema = paginatedSchema(projectSchema);

export type ProjectPage = z.infer<typeof projectPageSchema>;
