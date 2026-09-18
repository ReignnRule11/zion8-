import { registerEnumType } from '@nestjs/graphql';
import {
  AccountNormalBalance,
  AccountStatus,
  AccountType,
  ApprovalDecision,
  BankTransactionKind,
  BillStatus,
  BudgetStatus,
  ContributionMethod,
  ContributionStatus,
  ExpenseStatus,
  FiscalPeriodStatus,
  FundStatus,
  JournalSource,
  JournalStatus,
  PayFrequency,
  PayrollEmployeeStatus,
  PayrollRunStatus,
  ProjectStatus,
  PurchaseOrderStatus,
  ReconciliationStatus,
  ReportKind,
  VendorStatus,
} from '@zion8/contracts';

const enums: Array<[object, string]> = [
  [AccountType, 'AccountType'],
  [AccountNormalBalance, 'AccountNormalBalance'],
  [AccountStatus, 'AccountStatus'],
  [FiscalPeriodStatus, 'FiscalPeriodStatus'],
  [JournalStatus, 'JournalStatus'],
  [JournalSource, 'JournalSource'],
  [FundStatus, 'FundStatus'],
  [ContributionStatus, 'ContributionStatus'],
  [ContributionMethod, 'ContributionMethod'],
  [PayFrequency, 'PayFrequency'],
  [PayrollEmployeeStatus, 'PayrollEmployeeStatus'],
  [PayrollRunStatus, 'PayrollRunStatus'],
  [BudgetStatus, 'BudgetStatus'],
  [ProjectStatus, 'ProjectStatus'],
  [VendorStatus, 'VendorStatus'],
  [PurchaseOrderStatus, 'PurchaseOrderStatus'],
  [BillStatus, 'BillStatus'],
  [ExpenseStatus, 'ExpenseStatus'],
  [ApprovalDecision, 'ApprovalDecision'],
  [BankTransactionKind, 'BankTransactionKind'],
  [ReconciliationStatus, 'ReconciliationStatus'],
  [ReportKind, 'ReportKind'],
];

for (const [ref, name] of enums) {
  registerEnumType(ref, { name });
}

export const AccountTypeEnum = AccountType;
export const AccountNormalBalanceEnum = AccountNormalBalance;
export const AccountStatusEnum = AccountStatus;
export const FiscalPeriodStatusEnum = FiscalPeriodStatus;
export const JournalStatusEnum = JournalStatus;
export const JournalSourceEnum = JournalSource;
export const FundStatusEnum = FundStatus;
export const ContributionStatusEnum = ContributionStatus;
export const ContributionMethodEnum = ContributionMethod;
export const PayFrequencyEnum = PayFrequency;
export const PayrollEmployeeStatusEnum = PayrollEmployeeStatus;
export const PayrollRunStatusEnum = PayrollRunStatus;
export const BudgetStatusEnum = BudgetStatus;
export const ProjectStatusEnum = ProjectStatus;
export const VendorStatusEnum = VendorStatus;
export const PurchaseOrderStatusEnum = PurchaseOrderStatus;
export const BillStatusEnum = BillStatus;
export const ExpenseStatusEnum = ExpenseStatus;
export const ApprovalDecisionEnum = ApprovalDecision;
export const BankTransactionKindEnum = BankTransactionKind;
export const ReconciliationStatusEnum = ReconciliationStatus;
export const ReportKindEnum = ReportKind;
