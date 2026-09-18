import { z } from 'zod';
import {
  approvalDecisionSchema,
  billStatusSchema,
  expenseStatusSchema,
  purchaseOrderStatusSchema,
  vendorStatusSchema,
} from './enums';
import {
  isoDateSchema,
  moneyMinorSchema,
  paginatedSchema,
  paginationQuerySchema,
  uuidSchema,
} from './primitives';

export const vendorCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  contactName: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(320).optional(),
  phone: z.string().trim().max(32).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type VendorCreateRequest = z.infer<typeof vendorCreateSchema>;

export const vendorUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  contactName: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().email().max(320).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  status: vendorStatusSchema.optional(),
});

export type VendorUpdateRequest = z.infer<typeof vendorUpdateSchema>;

export const vendorListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  status: vendorStatusSchema.optional(),
});

export type VendorListQuery = z.infer<typeof vendorListQuerySchema>;

export const vendorSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  name: z.string(),
  contactName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  notes: z.string().nullable(),
  status: vendorStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Vendor = z.infer<typeof vendorSchema>;

export const vendorPageSchema = paginatedSchema(vendorSchema);

export type VendorPage = z.infer<typeof vendorPageSchema>;

export const purchaseOrderLineInputSchema = z.object({
  description: z.string().trim().min(1).max(240),
  quantity: z.number().int().min(1).max(1_000_000),
  unitCostMinor: moneyMinorSchema,
  accountId: uuidSchema.optional(),
});

export const purchaseOrderCreateSchema = z.object({
  vendorId: uuidSchema,
  orderedOn: isoDateSchema,
  expectedOn: isoDateSchema.optional(),
  memo: z.string().trim().max(240).optional(),
  projectId: uuidSchema.optional(),
  lines: z.array(purchaseOrderLineInputSchema).min(1).max(200),
});

export type PurchaseOrderCreateRequest = z.infer<typeof purchaseOrderCreateSchema>;

export const purchaseOrderListQuerySchema = paginationQuerySchema.extend({
  status: purchaseOrderStatusSchema.optional(),
  vendorId: uuidSchema.optional(),
});

export type PurchaseOrderListQuery = z.infer<typeof purchaseOrderListQuerySchema>;

export const purchaseOrderLineSchema = z.object({
  id: uuidSchema,
  description: z.string(),
  quantity: z.number().int(),
  unitCostMinor: z.number().int(),
  amountMinor: z.number().int(),
  accountId: uuidSchema.nullable(),
});

export type PurchaseOrderLine = z.infer<typeof purchaseOrderLineSchema>;

export const purchaseOrderSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  number: z.number().int(),
  vendorId: uuidSchema,
  vendorName: z.string(),
  orderedOn: isoDateSchema,
  expectedOn: isoDateSchema.nullable(),
  memo: z.string().nullable(),
  status: purchaseOrderStatusSchema,
  projectId: uuidSchema.nullable(),
  totalMinor: z.number().int(),
  lines: z.array(purchaseOrderLineSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PurchaseOrder = z.infer<typeof purchaseOrderSchema>;

export const purchaseOrderSummarySchema = purchaseOrderSchema.omit({ lines: true });

export type PurchaseOrderSummary = z.infer<typeof purchaseOrderSummarySchema>;

export const purchaseOrderPageSchema = paginatedSchema(purchaseOrderSummarySchema);

export type PurchaseOrderPage = z.infer<typeof purchaseOrderPageSchema>;

export const billCreateSchema = z.object({
  vendorId: uuidSchema,
  purchaseOrderId: uuidSchema.optional(),
  billedOn: isoDateSchema,
  dueOn: isoDateSchema.optional(),
  memo: z.string().trim().max(240).optional(),
  expenseAccountId: uuidSchema,
  amountMinor: moneyMinorSchema.refine((value) => value > 0, 'Amount must be greater than zero'),
  projectId: uuidSchema.optional(),
});

export type BillCreateRequest = z.infer<typeof billCreateSchema>;

export const billListQuerySchema = paginationQuerySchema.extend({
  status: billStatusSchema.optional(),
  vendorId: uuidSchema.optional(),
});

export type BillListQuery = z.infer<typeof billListQuerySchema>;

export const billSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  number: z.number().int(),
  vendorId: uuidSchema,
  vendorName: z.string(),
  purchaseOrderId: uuidSchema.nullable(),
  billedOn: isoDateSchema,
  dueOn: isoDateSchema.nullable(),
  memo: z.string().nullable(),
  status: billStatusSchema,
  expenseAccountId: uuidSchema,
  amountMinor: z.number().int(),
  projectId: uuidSchema.nullable(),
  journalId: uuidSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Bill = z.infer<typeof billSchema>;

export const billPageSchema = paginatedSchema(billSchema);

export type BillPage = z.infer<typeof billPageSchema>;

export const expenseCreateSchema = z.object({
  memberId: uuidSchema.optional(),
  submitterName: z.string().trim().max(120).optional(),
  incurredOn: isoDateSchema,
  amountMinor: moneyMinorSchema.refine((value) => value > 0, 'Amount must be greater than zero'),
  merchant: z.string().trim().max(120).optional(),
  memo: z.string().trim().min(1).max(240),
  expenseAccountId: uuidSchema,
  projectId: uuidSchema.optional(),
  departmentId: uuidSchema.optional(),
});

export type ExpenseCreateRequest = z.infer<typeof expenseCreateSchema>;

export const expenseListQuerySchema = paginationQuerySchema.extend({
  status: expenseStatusSchema.optional(),
  memberId: uuidSchema.optional(),
});

export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;

export const expenseSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  memberId: uuidSchema.nullable(),
  submitterName: z.string().nullable(),
  incurredOn: isoDateSchema,
  amountMinor: z.number().int(),
  merchant: z.string().nullable(),
  memo: z.string(),
  status: expenseStatusSchema,
  expenseAccountId: uuidSchema,
  projectId: uuidSchema.nullable(),
  departmentId: uuidSchema.nullable(),
  journalId: uuidSchema.nullable(),
  decidedByUserId: uuidSchema.nullable(),
  decidedAt: z.string().datetime().nullable(),
  decisionNote: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Expense = z.infer<typeof expenseSchema>;

export const expensePageSchema = paginatedSchema(expenseSchema);

export type ExpensePage = z.infer<typeof expensePageSchema>;

export const expenseDecisionSchema = z.object({
  decision: approvalDecisionSchema,
  note: z.string().trim().max(240).optional(),
});

export type ExpenseDecisionRequest = z.infer<typeof expenseDecisionSchema>;
