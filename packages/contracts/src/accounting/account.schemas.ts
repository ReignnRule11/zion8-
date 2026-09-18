import { z } from 'zod';
import {
  AccountNormalBalance,
  AccountStatus,
  AccountType,
  accountNormalBalanceSchema,
  accountStatusSchema,
  accountTypeSchema,
} from './enums';
import {
  accountCodeSchema,
  isoDateSchema,
  paginatedSchema,
  paginationQuerySchema,
  uuidSchema,
} from './primitives';

export const DEFAULT_CHART_ACCOUNTS: readonly {
  code: string;
  name: string;
  type: AccountType;
  normalBalance: AccountNormalBalance;
}[] = [
  { code: '1000', name: 'Operating Cash', type: AccountType.ASSET, normalBalance: AccountNormalBalance.DEBIT },
  { code: '1100', name: 'Undeposited Funds', type: AccountType.ASSET, normalBalance: AccountNormalBalance.DEBIT },
  { code: '1200', name: 'Accounts Receivable', type: AccountType.ASSET, normalBalance: AccountNormalBalance.DEBIT },
  { code: '2000', name: 'Accounts Payable', type: AccountType.LIABILITY, normalBalance: AccountNormalBalance.CREDIT },
  { code: '2100', name: 'Payroll Liabilities', type: AccountType.LIABILITY, normalBalance: AccountNormalBalance.CREDIT },
  { code: '3000', name: 'Net Assets', type: AccountType.EQUITY, normalBalance: AccountNormalBalance.CREDIT },
  { code: '3100', name: 'Restricted Net Assets', type: AccountType.EQUITY, normalBalance: AccountNormalBalance.CREDIT },
  { code: '4000', name: 'Tithes and Offerings', type: AccountType.REVENUE, normalBalance: AccountNormalBalance.CREDIT },
  { code: '4100', name: 'Designated Giving', type: AccountType.REVENUE, normalBalance: AccountNormalBalance.CREDIT },
  { code: '5000', name: 'Ministry Expenses', type: AccountType.EXPENSE, normalBalance: AccountNormalBalance.DEBIT },
  { code: '5100', name: 'Payroll Expense', type: AccountType.EXPENSE, normalBalance: AccountNormalBalance.DEBIT },
  { code: '5200', name: 'Facilities Expense', type: AccountType.EXPENSE, normalBalance: AccountNormalBalance.DEBIT },
];

export const accountCreateSchema = z.object({
  code: accountCodeSchema,
  name: z.string().trim().min(1).max(120),
  type: accountTypeSchema,
  normalBalance: accountNormalBalanceSchema.optional(),
  parentId: uuidSchema.optional(),
  description: z.string().trim().max(2000).optional(),
  isPostable: z.boolean().default(true),
});

export type AccountCreateRequest = z.infer<typeof accountCreateSchema>;

export const accountUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  parentId: uuidSchema.nullable().optional(),
  isPostable: z.boolean().optional(),
  status: accountStatusSchema.optional(),
});

export type AccountUpdateRequest = z.infer<typeof accountUpdateSchema>;

export const accountListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(200).optional(),
  type: accountTypeSchema.optional(),
  status: accountStatusSchema.optional(),
  includeArchived: z.coerce.boolean().optional(),
});

export type AccountListQuery = z.infer<typeof accountListQuerySchema>;

export const accountSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  code: z.string(),
  name: z.string(),
  type: accountTypeSchema,
  normalBalance: accountNormalBalanceSchema,
  parentId: uuidSchema.nullable(),
  description: z.string().nullable(),
  isPostable: z.boolean(),
  status: accountStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Account = z.infer<typeof accountSchema>;

export const accountPageSchema = paginatedSchema(accountSchema);

export type AccountPage = z.infer<typeof accountPageSchema>;

export const fiscalPeriodCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    startsOn: isoDateSchema,
    endsOn: isoDateSchema,
  })
  .refine((value) => value.startsOn <= value.endsOn, {
    message: 'Period end must be on or after the start date',
    path: ['endsOn'],
  });

export type FiscalPeriodCreateRequest = z.infer<typeof fiscalPeriodCreateSchema>;

export const fiscalPeriodSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  name: z.string(),
  startsOn: isoDateSchema,
  endsOn: isoDateSchema,
  status: z.enum(['OPEN', 'CLOSED', 'LOCKED']),
  closedAt: z.string().datetime().nullable(),
  closedByUserId: uuidSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type FiscalPeriod = z.infer<typeof fiscalPeriodSchema>;

export const fiscalPeriodPageSchema = paginatedSchema(fiscalPeriodSchema);

export type FiscalPeriodPage = z.infer<typeof fiscalPeriodPageSchema>;

export const fiscalPeriodListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['OPEN', 'CLOSED', 'LOCKED']).optional(),
});

export type FiscalPeriodListQuery = z.infer<typeof fiscalPeriodListQuerySchema>;

export { AccountStatus };
