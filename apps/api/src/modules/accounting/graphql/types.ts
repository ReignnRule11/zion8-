import { Field, Int, ObjectType } from '@nestjs/graphql';
import {
  AccountNormalBalanceEnum,
  AccountStatusEnum,
  AccountTypeEnum,
  BankTransactionKindEnum,
  BillStatusEnum,
  BudgetStatusEnum,
  ContributionMethodEnum,
  ContributionStatusEnum,
  ExpenseStatusEnum,
  FiscalPeriodStatusEnum,
  FundStatusEnum,
  JournalSourceEnum,
  JournalStatusEnum,
  PayFrequencyEnum,
  PayrollEmployeeStatusEnum,
  PayrollRunStatusEnum,
  ProjectStatusEnum,
  PurchaseOrderStatusEnum,
  ReconciliationStatusEnum,
  ReportKindEnum,
  VendorStatusEnum,
} from './enums';

@ObjectType()
export class GlAccountType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() code!: string;
  @Field() name!: string;
  @Field(() => AccountTypeEnum) type!: string;
  @Field(() => AccountNormalBalanceEnum) normalBalance!: string;
  @Field(() => String, { nullable: true }) parentId!: string | null;
  @Field(() => String, { nullable: true }) description!: string | null;
  @Field() isPostable!: boolean;
  @Field(() => AccountStatusEnum) status!: string;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class GlAccountPageType {
  @Field(() => [GlAccountType]) items!: GlAccountType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class FiscalPeriodType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() name!: string;
  @Field() startsOn!: string;
  @Field() endsOn!: string;
  @Field(() => FiscalPeriodStatusEnum) status!: string;
  @Field(() => String, { nullable: true }) closedAt!: string | null;
  @Field(() => String, { nullable: true }) closedByUserId!: string | null;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class FiscalPeriodPageType {
  @Field(() => [FiscalPeriodType]) items!: FiscalPeriodType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class JournalLineType {
  @Field() id!: string;
  @Field() accountId!: string;
  @Field() accountCode!: string;
  @Field() accountName!: string;
  @Field(() => String, { nullable: true }) description!: string | null;
  @Field(() => Int) debitMinor!: number;
  @Field(() => Int) creditMinor!: number;
  @Field(() => String, { nullable: true }) fundId!: string | null;
  @Field(() => String, { nullable: true }) projectId!: string | null;
  @Field(() => String, { nullable: true }) departmentId!: string | null;
}

@ObjectType()
export class JournalSummaryType {
  @Field() id!: string;
  @Field(() => Int) number!: number;
  @Field() memo!: string;
  @Field() occurredOn!: string;
  @Field(() => JournalStatusEnum) status!: string;
  @Field(() => JournalSourceEnum) source!: string;
  @Field(() => String, { nullable: true }) reference!: string | null;
  @Field(() => Int) debitMinor!: number;
  @Field(() => Int) creditMinor!: number;
  @Field(() => String, { nullable: true }) postedAt!: string | null;
  @Field() createdAt!: string;
}

@ObjectType()
export class JournalPageType {
  @Field(() => [JournalSummaryType]) items!: JournalSummaryType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class JournalType {
  @Field() id!: string;
  @Field(() => Int) number!: number;
  @Field() memo!: string;
  @Field() occurredOn!: string;
  @Field(() => JournalStatusEnum) status!: string;
  @Field(() => JournalSourceEnum) source!: string;
  @Field(() => String, { nullable: true }) reference!: string | null;
  @Field(() => Int) debitMinor!: number;
  @Field(() => Int) creditMinor!: number;
  @Field(() => String, { nullable: true }) postedAt!: string | null;
  @Field() createdAt!: string;
  @Field() tenantId!: string;
  @Field(() => String, { nullable: true }) periodId!: string | null;
  @Field(() => String, { nullable: true }) createdByUserId!: string | null;
  @Field(() => String, { nullable: true }) postedByUserId!: string | null;
  @Field(() => String, { nullable: true }) voidedAt!: string | null;
  @Field(() => String, { nullable: true }) voidReason!: string | null;
  @Field(() => [JournalLineType]) lines!: JournalLineType[];
  @Field() updatedAt!: string;
}

@ObjectType()
export class FundType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() name!: string;
  @Field(() => String, { nullable: true }) description!: string | null;
  @Field() restricted!: boolean;
  @Field(() => FundStatusEnum) status!: string;
  @Field(() => String, { nullable: true }) revenueAccountId!: string | null;
  @Field(() => String, { nullable: true }) assetAccountId!: string | null;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class FundPageType {
  @Field(() => [FundType]) items!: FundType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class ContributionType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field(() => String, { nullable: true }) memberId!: string | null;
  @Field(() => String, { nullable: true }) donorName!: string | null;
  @Field() fundId!: string;
  @Field() fundName!: string;
  @Field(() => Int) amountMinor!: number;
  @Field() currency!: string;
  @Field(() => ContributionMethodEnum) method!: string;
  @Field(() => ContributionStatusEnum) status!: string;
  @Field() receivedOn!: string;
  @Field(() => String, { nullable: true }) externalRef!: string | null;
  @Field(() => String, { nullable: true }) note!: string | null;
  @Field() taxDeductible!: boolean;
  @Field(() => String, { nullable: true }) journalId!: string | null;
  @Field(() => String, { nullable: true }) refundOfId!: string | null;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class ContributionPageType {
  @Field(() => [ContributionType]) items!: ContributionType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class PayrollEmployeeType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field(() => String, { nullable: true }) memberId!: string | null;
  @Field() displayName!: string;
  @Field(() => String, { nullable: true }) title!: string | null;
  @Field(() => PayFrequencyEnum) payFrequency!: string;
  @Field(() => Int) grossMinor!: number;
  @Field(() => PayrollEmployeeStatusEnum) status!: string;
  @Field(() => String, { nullable: true }) expenseAccountId!: string | null;
  @Field(() => String, { nullable: true }) liabilityAccountId!: string | null;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class PayrollEmployeePageType {
  @Field(() => [PayrollEmployeeType]) items!: PayrollEmployeeType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class PayrollItemType {
  @Field() id!: string;
  @Field() employeeId!: string;
  @Field() employeeName!: string;
  @Field(() => Int) grossMinor!: number;
  @Field(() => Int) taxMinor!: number;
  @Field(() => Int) netMinor!: number;
}

@ObjectType()
export class PayrollRunType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() periodStart!: string;
  @Field() periodEnd!: string;
  @Field() payOn!: string;
  @Field(() => String, { nullable: true }) memo!: string | null;
  @Field(() => PayrollRunStatusEnum) status!: string;
  @Field(() => Int) grossMinor!: number;
  @Field(() => Int) taxMinor!: number;
  @Field(() => Int) netMinor!: number;
  @Field(() => String, { nullable: true }) journalId!: string | null;
  @Field(() => [PayrollItemType]) items!: PayrollItemType[];
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class PayrollRunSummaryType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() periodStart!: string;
  @Field() periodEnd!: string;
  @Field() payOn!: string;
  @Field(() => String, { nullable: true }) memo!: string | null;
  @Field(() => PayrollRunStatusEnum) status!: string;
  @Field(() => Int) grossMinor!: number;
  @Field(() => Int) taxMinor!: number;
  @Field(() => Int) netMinor!: number;
  @Field(() => String, { nullable: true }) journalId!: string | null;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class PayrollRunPageType {
  @Field(() => [PayrollRunSummaryType]) items!: PayrollRunSummaryType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class BudgetLineType {
  @Field() id!: string;
  @Field() accountId!: string;
  @Field() accountCode!: string;
  @Field() accountName!: string;
  @Field(() => Int) amountMinor!: number;
  @Field(() => Int) actualMinor!: number;
  @Field(() => Int) varianceMinor!: number;
  @Field(() => String, { nullable: true }) notes!: string | null;
}

@ObjectType()
export class BudgetType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() name!: string;
  @Field() startsOn!: string;
  @Field() endsOn!: string;
  @Field(() => BudgetStatusEnum) status!: string;
  @Field(() => String, { nullable: true }) notes!: string | null;
  @Field(() => Int) totalMinor!: number;
  @Field(() => Int) actualMinor!: number;
  @Field(() => [BudgetLineType]) lines!: BudgetLineType[];
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class BudgetSummaryType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() name!: string;
  @Field() startsOn!: string;
  @Field() endsOn!: string;
  @Field(() => BudgetStatusEnum) status!: string;
  @Field(() => String, { nullable: true }) notes!: string | null;
  @Field(() => Int) totalMinor!: number;
  @Field(() => Int) actualMinor!: number;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class BudgetPageType {
  @Field(() => [BudgetSummaryType]) items!: BudgetSummaryType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class FinanceProjectType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() name!: string;
  @Field(() => String, { nullable: true }) description!: string | null;
  @Field(() => ProjectStatusEnum) status!: string;
  @Field(() => String, { nullable: true }) startsOn!: string | null;
  @Field(() => String, { nullable: true }) endsOn!: string | null;
  @Field(() => Int) budgetMinor!: number;
  @Field(() => Int) spentMinor!: number;
  @Field(() => Int) remainingMinor!: number;
  @Field(() => String, { nullable: true }) expenseAccountId!: string | null;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class FinanceProjectPageType {
  @Field(() => [FinanceProjectType]) items!: FinanceProjectType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class VendorType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() name!: string;
  @Field(() => String, { nullable: true }) contactName!: string | null;
  @Field(() => String, { nullable: true }) email!: string | null;
  @Field(() => String, { nullable: true }) phone!: string | null;
  @Field(() => String, { nullable: true }) notes!: string | null;
  @Field(() => VendorStatusEnum) status!: string;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class VendorPageType {
  @Field(() => [VendorType]) items!: VendorType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class PurchaseOrderLineType {
  @Field() id!: string;
  @Field() description!: string;
  @Field(() => Int) quantity!: number;
  @Field(() => Int) unitCostMinor!: number;
  @Field(() => Int) amountMinor!: number;
  @Field(() => String, { nullable: true }) accountId!: string | null;
}

@ObjectType()
export class PurchaseOrderType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field(() => Int) number!: number;
  @Field() vendorId!: string;
  @Field() vendorName!: string;
  @Field() orderedOn!: string;
  @Field(() => String, { nullable: true }) expectedOn!: string | null;
  @Field(() => String, { nullable: true }) memo!: string | null;
  @Field(() => PurchaseOrderStatusEnum) status!: string;
  @Field(() => String, { nullable: true }) projectId!: string | null;
  @Field(() => Int) totalMinor!: number;
  @Field(() => [PurchaseOrderLineType]) lines!: PurchaseOrderLineType[];
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class PurchaseOrderSummaryType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field(() => Int) number!: number;
  @Field() vendorId!: string;
  @Field() vendorName!: string;
  @Field() orderedOn!: string;
  @Field(() => String, { nullable: true }) expectedOn!: string | null;
  @Field(() => String, { nullable: true }) memo!: string | null;
  @Field(() => PurchaseOrderStatusEnum) status!: string;
  @Field(() => String, { nullable: true }) projectId!: string | null;
  @Field(() => Int) totalMinor!: number;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class PurchaseOrderPageType {
  @Field(() => [PurchaseOrderSummaryType]) items!: PurchaseOrderSummaryType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class BillType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field(() => Int) number!: number;
  @Field() vendorId!: string;
  @Field() vendorName!: string;
  @Field(() => String, { nullable: true }) purchaseOrderId!: string | null;
  @Field() billedOn!: string;
  @Field(() => String, { nullable: true }) dueOn!: string | null;
  @Field(() => String, { nullable: true }) memo!: string | null;
  @Field(() => BillStatusEnum) status!: string;
  @Field() expenseAccountId!: string;
  @Field(() => Int) amountMinor!: number;
  @Field(() => String, { nullable: true }) projectId!: string | null;
  @Field(() => String, { nullable: true }) journalId!: string | null;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class BillPageType {
  @Field(() => [BillType]) items!: BillType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class ExpenseType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field(() => String, { nullable: true }) memberId!: string | null;
  @Field(() => String, { nullable: true }) submitterName!: string | null;
  @Field() incurredOn!: string;
  @Field(() => Int) amountMinor!: number;
  @Field(() => String, { nullable: true }) merchant!: string | null;
  @Field() memo!: string;
  @Field(() => ExpenseStatusEnum) status!: string;
  @Field() expenseAccountId!: string;
  @Field(() => String, { nullable: true }) projectId!: string | null;
  @Field(() => String, { nullable: true }) departmentId!: string | null;
  @Field(() => String, { nullable: true }) journalId!: string | null;
  @Field(() => String, { nullable: true }) decidedByUserId!: string | null;
  @Field(() => String, { nullable: true }) decidedAt!: string | null;
  @Field(() => String, { nullable: true }) decisionNote!: string | null;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class ExpensePageType {
  @Field(() => [ExpenseType]) items!: ExpenseType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class BankAccountType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() name!: string;
  @Field(() => String, { nullable: true }) institution!: string | null;
  @Field(() => String, { nullable: true }) accountNumberMasked!: string | null;
  @Field() glAccountId!: string;
  @Field() glAccountCode!: string;
  @Field() glAccountName!: string;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class BankAccountPageType {
  @Field(() => [BankAccountType]) items!: BankAccountType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class BankTransactionType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() bankAccountId!: string;
  @Field() occurredOn!: string;
  @Field(() => Int) amountMinor!: number;
  @Field(() => BankTransactionKindEnum) kind!: string;
  @Field() description!: string;
  @Field(() => String, { nullable: true }) externalRef!: string | null;
  @Field(() => String, { nullable: true }) matchedJournalId!: string | null;
  @Field() createdAt!: string;
}

@ObjectType()
export class BankTransactionPageType {
  @Field(() => [BankTransactionType]) items!: BankTransactionType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class ReconciliationType {
  @Field() id!: string;
  @Field() tenantId!: string;
  @Field() bankAccountId!: string;
  @Field() bankAccountName!: string;
  @Field() statementOn!: string;
  @Field(() => Int) statementBalanceMinor!: number;
  @Field(() => Int) bookBalanceMinor!: number;
  @Field(() => Int) differenceMinor!: number;
  @Field(() => ReconciliationStatusEnum) status!: string;
  @Field(() => String, { nullable: true }) completedAt!: string | null;
  @Field(() => Int) matchedCount!: number;
  @Field(() => Int) unmatchedCount!: number;
  @Field() createdAt!: string;
  @Field() updatedAt!: string;
}

@ObjectType()
export class ReconciliationPageType {
  @Field(() => [ReconciliationType]) items!: ReconciliationType[];
  @Field(() => Int) total!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) offset!: number;
}

@ObjectType()
export class ReportLineType {
  @Field(() => String, { nullable: true }) accountId!: string | null;
  @Field(() => String, { nullable: true }) accountCode!: string | null;
  @Field() accountName!: string;
  @Field(() => AccountTypeEnum, { nullable: true }) accountType!: string | null;
  @Field(() => Int) debitMinor!: number;
  @Field(() => Int) creditMinor!: number;
  @Field(() => Int) balanceMinor!: number;
  @Field(() => Int, { nullable: true }) budgetMinor!: number | null;
  @Field(() => Int, { nullable: true }) actualMinor!: number | null;
  @Field(() => Int, { nullable: true }) varianceMinor!: number | null;
}

@ObjectType()
export class ReportSectionType {
  @Field() name!: string;
  @Field(() => Int) totalMinor!: number;
  @Field(() => [ReportLineType]) lines!: ReportLineType[];
}

@ObjectType()
export class AccountingReportType {
  @Field(() => ReportKindEnum) kind!: string;
  @Field() title!: string;
  @Field() generatedAt!: string;
  @Field(() => String, { nullable: true }) from!: string | null;
  @Field(() => String, { nullable: true }) to!: string | null;
  @Field(() => String, { nullable: true }) asOf!: string | null;
  @Field() currency!: string;
  @Field(() => [ReportSectionType]) sections!: ReportSectionType[];
  @Field(() => Int) netMinor!: number;
}
