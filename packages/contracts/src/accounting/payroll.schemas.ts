import { z } from 'zod';
import { payFrequencySchema, payrollEmployeeStatusSchema, payrollRunStatusSchema } from './enums';
import {
  isoDateSchema,
  moneyMinorSchema,
  paginatedSchema,
  paginationQuerySchema,
  uuidSchema,
} from './primitives';

export const payrollEmployeeCreateSchema = z.object({
  memberId: uuidSchema.optional(),
  displayName: z.string().trim().min(1).max(120),
  title: z.string().trim().max(120).optional(),
  payFrequency: payFrequencySchema.default('MONTHLY'),
  grossMinor: moneyMinorSchema,
  expenseAccountId: uuidSchema.optional(),
  liabilityAccountId: uuidSchema.optional(),
});

export type PayrollEmployeeCreateRequest = z.infer<typeof payrollEmployeeCreateSchema>;

export const payrollEmployeeUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().max(120).nullable().optional(),
  payFrequency: payFrequencySchema.optional(),
  grossMinor: moneyMinorSchema.optional(),
  expenseAccountId: uuidSchema.nullable().optional(),
  liabilityAccountId: uuidSchema.nullable().optional(),
  status: payrollEmployeeStatusSchema.optional(),
});

export type PayrollEmployeeUpdateRequest = z.infer<typeof payrollEmployeeUpdateSchema>;

export const payrollEmployeeListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: payrollEmployeeStatusSchema.optional(),
});

export type PayrollEmployeeListQuery = z.infer<typeof payrollEmployeeListQuerySchema>;

export const payrollEmployeeSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  memberId: uuidSchema.nullable(),
  displayName: z.string(),
  title: z.string().nullable(),
  payFrequency: payFrequencySchema,
  grossMinor: z.number().int(),
  status: payrollEmployeeStatusSchema,
  expenseAccountId: uuidSchema.nullable(),
  liabilityAccountId: uuidSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PayrollEmployee = z.infer<typeof payrollEmployeeSchema>;

export const payrollEmployeePageSchema = paginatedSchema(payrollEmployeeSchema);

export type PayrollEmployeePage = z.infer<typeof payrollEmployeePageSchema>;

export const payrollRunCreateSchema = z
  .object({
    periodStart: isoDateSchema,
    periodEnd: isoDateSchema,
    payOn: isoDateSchema,
    memo: z.string().trim().max(240).optional(),
  })
  .refine((value) => value.periodStart <= value.periodEnd, {
    message: 'Pay period end must be on or after the start date',
    path: ['periodEnd'],
  });

export type PayrollRunCreateRequest = z.infer<typeof payrollRunCreateSchema>;

export const payrollRunListQuerySchema = paginationQuerySchema.extend({
  status: payrollRunStatusSchema.optional(),
});

export type PayrollRunListQuery = z.infer<typeof payrollRunListQuerySchema>;

export const payrollItemSchema = z.object({
  id: uuidSchema,
  employeeId: uuidSchema,
  employeeName: z.string(),
  grossMinor: z.number().int(),
  taxMinor: z.number().int(),
  netMinor: z.number().int(),
});

export type PayrollItem = z.infer<typeof payrollItemSchema>;

export const payrollRunSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  periodStart: isoDateSchema,
  periodEnd: isoDateSchema,
  payOn: isoDateSchema,
  memo: z.string().nullable(),
  status: payrollRunStatusSchema,
  grossMinor: z.number().int(),
  taxMinor: z.number().int(),
  netMinor: z.number().int(),
  journalId: uuidSchema.nullable(),
  items: z.array(payrollItemSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PayrollRun = z.infer<typeof payrollRunSchema>;

export const payrollRunSummarySchema = payrollRunSchema.omit({ items: true });

export type PayrollRunSummary = z.infer<typeof payrollRunSummarySchema>;

export const payrollRunPageSchema = paginatedSchema(payrollRunSummarySchema);

export type PayrollRunPage = z.infer<typeof payrollRunPageSchema>;
