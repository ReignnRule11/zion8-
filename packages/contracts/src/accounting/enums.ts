import { z } from 'zod';

export const AccountType = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
} as const;

export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const accountTypeSchema = z.enum(
  Object.values(AccountType) as [AccountType, ...AccountType[]],
);

export const AccountNormalBalance = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const;

export type AccountNormalBalance = (typeof AccountNormalBalance)[keyof typeof AccountNormalBalance];

export const accountNormalBalanceSchema = z.enum(
  Object.values(AccountNormalBalance) as [AccountNormalBalance, ...AccountNormalBalance[]],
);

export const AccountStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

export const accountStatusSchema = z.enum(
  Object.values(AccountStatus) as [AccountStatus, ...AccountStatus[]],
);

export const FiscalPeriodStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  LOCKED: 'LOCKED',
} as const;

export type FiscalPeriodStatus = (typeof FiscalPeriodStatus)[keyof typeof FiscalPeriodStatus];

export const fiscalPeriodStatusSchema = z.enum(
  Object.values(FiscalPeriodStatus) as [FiscalPeriodStatus, ...FiscalPeriodStatus[]],
);

export const JournalStatus = {
  DRAFT: 'DRAFT',
  POSTED: 'POSTED',
  VOID: 'VOID',
} as const;

export type JournalStatus = (typeof JournalStatus)[keyof typeof JournalStatus];

export const journalStatusSchema = z.enum(
  Object.values(JournalStatus) as [JournalStatus, ...JournalStatus[]],
);

export const JournalSource = {
  MANUAL: 'MANUAL',
  GIVING: 'GIVING',
  PAYROLL: 'PAYROLL',
  PROCUREMENT: 'PROCUREMENT',
  EXPENSE: 'EXPENSE',
  PROJECT: 'PROJECT',
  BANK_RECON: 'BANK_RECON',
  PERIOD_CLOSE: 'PERIOD_CLOSE',
  SYSTEM: 'SYSTEM',
} as const;

export type JournalSource = (typeof JournalSource)[keyof typeof JournalSource];

export const journalSourceSchema = z.enum(
  Object.values(JournalSource) as [JournalSource, ...JournalSource[]],
);

export const FundStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export type FundStatus = (typeof FundStatus)[keyof typeof FundStatus];

export const fundStatusSchema = z.enum(Object.values(FundStatus) as [FundStatus, ...FundStatus[]]);

export const ContributionStatus = {
  RECORDED: 'RECORDED',
  POSTED: 'POSTED',
  REFUNDED: 'REFUNDED',
  VOID: 'VOID',
} as const;

export type ContributionStatus = (typeof ContributionStatus)[keyof typeof ContributionStatus];

export const contributionStatusSchema = z.enum(
  Object.values(ContributionStatus) as [ContributionStatus, ...ContributionStatus[]],
);

export const ContributionMethod = {
  CASH: 'CASH',
  CHECK: 'CHECK',
  CARD: 'CARD',
  ACH: 'ACH',
  MOBILE: 'MOBILE',
  IN_KIND: 'IN_KIND',
  OTHER: 'OTHER',
} as const;

export type ContributionMethod = (typeof ContributionMethod)[keyof typeof ContributionMethod];

export const contributionMethodSchema = z.enum(
  Object.values(ContributionMethod) as [ContributionMethod, ...ContributionMethod[]],
);

export const PayFrequency = {
  WEEKLY: 'WEEKLY',
  BIWEEKLY: 'BIWEEKLY',
  SEMIMONTHLY: 'SEMIMONTHLY',
  MONTHLY: 'MONTHLY',
} as const;

export type PayFrequency = (typeof PayFrequency)[keyof typeof PayFrequency];

export const payFrequencySchema = z.enum(
  Object.values(PayFrequency) as [PayFrequency, ...PayFrequency[]],
);

export const PayrollEmployeeStatus = {
  ACTIVE: 'ACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  TERMINATED: 'TERMINATED',
} as const;

export type PayrollEmployeeStatus =
  (typeof PayrollEmployeeStatus)[keyof typeof PayrollEmployeeStatus];

export const payrollEmployeeStatusSchema = z.enum(
  Object.values(PayrollEmployeeStatus) as [PayrollEmployeeStatus, ...PayrollEmployeeStatus[]],
);

export const PayrollRunStatus = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
  VOID: 'VOID',
} as const;

export type PayrollRunStatus = (typeof PayrollRunStatus)[keyof typeof PayrollRunStatus];

export const payrollRunStatusSchema = z.enum(
  Object.values(PayrollRunStatus) as [PayrollRunStatus, ...PayrollRunStatus[]],
);

export const BudgetStatus = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
} as const;

export type BudgetStatus = (typeof BudgetStatus)[keyof typeof BudgetStatus];

export const budgetStatusSchema = z.enum(
  Object.values(BudgetStatus) as [BudgetStatus, ...BudgetStatus[]],
);

export const ProjectStatus = {
  PLANNED: 'PLANNED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const projectStatusSchema = z.enum(
  Object.values(ProjectStatus) as [ProjectStatus, ...ProjectStatus[]],
);

export const VendorStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
} as const;

export type VendorStatus = (typeof VendorStatus)[keyof typeof VendorStatus];

export const vendorStatusSchema = z.enum(
  Object.values(VendorStatus) as [VendorStatus, ...VendorStatus[]],
);

export const PurchaseOrderStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED',
  CLOSED: 'CLOSED',
} as const;

export type PurchaseOrderStatus = (typeof PurchaseOrderStatus)[keyof typeof PurchaseOrderStatus];

export const purchaseOrderStatusSchema = z.enum(
  Object.values(PurchaseOrderStatus) as [PurchaseOrderStatus, ...PurchaseOrderStatus[]],
);

export const BillStatus = {
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
  PAID: 'PAID',
  VOID: 'VOID',
} as const;

export type BillStatus = (typeof BillStatus)[keyof typeof BillStatus];

export const billStatusSchema = z.enum(Object.values(BillStatus) as [BillStatus, ...BillStatus[]]);

export const ExpenseStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  POSTED: 'POSTED',
  PAID: 'PAID',
  VOID: 'VOID',
} as const;

export type ExpenseStatus = (typeof ExpenseStatus)[keyof typeof ExpenseStatus];

export const expenseStatusSchema = z.enum(
  Object.values(ExpenseStatus) as [ExpenseStatus, ...ExpenseStatus[]],
);

export const ApprovalDecision = {
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type ApprovalDecision = (typeof ApprovalDecision)[keyof typeof ApprovalDecision];

export const approvalDecisionSchema = z.enum(
  Object.values(ApprovalDecision) as [ApprovalDecision, ...ApprovalDecision[]],
);

export const BankTransactionKind = {
  DEPOSIT: 'DEPOSIT',
  WITHDRAWAL: 'WITHDRAWAL',
} as const;

export type BankTransactionKind = (typeof BankTransactionKind)[keyof typeof BankTransactionKind];

export const bankTransactionKindSchema = z.enum(
  Object.values(BankTransactionKind) as [BankTransactionKind, ...BankTransactionKind[]],
);

export const ReconciliationStatus = {
  OPEN: 'OPEN',
  COMPLETED: 'COMPLETED',
} as const;

export type ReconciliationStatus = (typeof ReconciliationStatus)[keyof typeof ReconciliationStatus];

export const reconciliationStatusSchema = z.enum(
  Object.values(ReconciliationStatus) as [ReconciliationStatus, ...ReconciliationStatus[]],
);

export const ReportKind = {
  TRIAL_BALANCE: 'TRIAL_BALANCE',
  INCOME_STATEMENT: 'INCOME_STATEMENT',
  BALANCE_SHEET: 'BALANCE_SHEET',
  BUDGET_VS_ACTUAL: 'BUDGET_VS_ACTUAL',
  GIVING_STATEMENT: 'GIVING_STATEMENT',
  PROJECT_COST: 'PROJECT_COST',
  CASH_ACTIVITY: 'CASH_ACTIVITY',
} as const;

export type ReportKind = (typeof ReportKind)[keyof typeof ReportKind];

export const reportKindSchema = z.enum(Object.values(ReportKind) as [ReportKind, ...ReportKind[]]);
