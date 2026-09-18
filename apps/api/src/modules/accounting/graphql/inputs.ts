import { Field, InputType, Int } from '@nestjs/graphql';
import {
  AccountStatusEnum,
  AccountTypeEnum,
  ApprovalDecisionEnum,
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

@InputType()
export class AccountCreateInput {
  @Field() code!: string;
  @Field() name!: string;
  @Field(() => AccountTypeEnum) type!: string;
  @Field(() => String, { nullable: true }) normalBalance?: string;
  @Field(() => String, { nullable: true }) parentId?: string;
  @Field(() => String, { nullable: true }) description?: string;
  @Field(() => Boolean, { nullable: true }) isPostable?: boolean;
}

@InputType()
export class AccountUpdateInput {
  @Field(() => String, { nullable: true }) name?: string;
  @Field(() => String, { nullable: true }) description?: string;
  @Field(() => String, { nullable: true }) parentId?: string;
  @Field(() => Boolean, { nullable: true }) isPostable?: boolean;
  @Field(() => AccountStatusEnum, { nullable: true }) status?: string;
}

@InputType()
export class AccountListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => String, { nullable: true }) search?: string;
  @Field(() => AccountTypeEnum, { nullable: true }) type?: string;
  @Field(() => AccountStatusEnum, { nullable: true }) status?: string;
  @Field(() => Boolean, { nullable: true }) includeArchived?: boolean;
}

@InputType()
export class FiscalPeriodCreateInput {
  @Field() name!: string;
  @Field() startsOn!: string;
  @Field() endsOn!: string;
}

@InputType()
export class FiscalPeriodListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => FiscalPeriodStatusEnum, { nullable: true }) status?: string;
}

@InputType()
export class JournalLineInput {
  @Field() accountId!: string;
  @Field(() => String, { nullable: true }) description?: string;
  @Field(() => Int, { nullable: true }) debitMinor?: number;
  @Field(() => Int, { nullable: true }) creditMinor?: number;
  @Field(() => String, { nullable: true }) fundId?: string;
  @Field(() => String, { nullable: true }) projectId?: string;
  @Field(() => String, { nullable: true }) departmentId?: string;
}

@InputType()
export class JournalCreateInput {
  @Field() memo!: string;
  @Field() occurredOn!: string;
  @Field(() => JournalSourceEnum, { nullable: true }) source?: string;
  @Field(() => String, { nullable: true }) reference?: string;
  @Field(() => [JournalLineInput]) lines!: JournalLineInput[];
}

@InputType()
export class JournalListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => JournalStatusEnum, { nullable: true }) status?: string;
  @Field(() => JournalSourceEnum, { nullable: true }) source?: string;
  @Field(() => String, { nullable: true }) from?: string;
  @Field(() => String, { nullable: true }) to?: string;
  @Field(() => String, { nullable: true }) search?: string;
}

@InputType()
export class JournalVoidInput {
  @Field() reason!: string;
}

@InputType()
export class FundCreateInput {
  @Field() name!: string;
  @Field(() => String, { nullable: true }) description?: string;
  @Field(() => Boolean, { nullable: true }) restricted?: boolean;
  @Field(() => String, { nullable: true }) revenueAccountId?: string;
  @Field(() => String, { nullable: true }) assetAccountId?: string;
}

@InputType()
export class FundUpdateInput {
  @Field(() => String, { nullable: true }) name?: string;
  @Field(() => String, { nullable: true }) description?: string;
  @Field(() => Boolean, { nullable: true }) restricted?: boolean;
  @Field(() => String, { nullable: true }) revenueAccountId?: string;
  @Field(() => String, { nullable: true }) assetAccountId?: string;
  @Field(() => FundStatusEnum, { nullable: true }) status?: string;
}

@InputType()
export class FundListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => String, { nullable: true }) search?: string;
  @Field(() => Boolean, { nullable: true }) includeArchived?: boolean;
}

@InputType()
export class ContributionCreateInput {
  @Field(() => String, { nullable: true }) memberId?: string;
  @Field(() => String, { nullable: true }) donorName?: string;
  @Field() fundId!: string;
  @Field(() => Int) amountMinor!: number;
  @Field(() => String, { nullable: true }) currency?: string;
  @Field(() => ContributionMethodEnum, { nullable: true }) method?: string;
  @Field() receivedOn!: string;
  @Field(() => String, { nullable: true }) externalRef?: string;
  @Field(() => String, { nullable: true }) note?: string;
  @Field(() => Boolean, { nullable: true }) taxDeductible?: boolean;
}

@InputType()
export class ContributionListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => String, { nullable: true }) memberId?: string;
  @Field(() => String, { nullable: true }) fundId?: string;
  @Field(() => ContributionStatusEnum, { nullable: true }) status?: string;
  @Field(() => String, { nullable: true }) from?: string;
  @Field(() => String, { nullable: true }) to?: string;
  @Field(() => String, { nullable: true }) search?: string;
}

@InputType()
export class ContributionRefundInput {
  @Field() reason!: string;
}

@InputType()
export class PayrollEmployeeCreateInput {
  @Field(() => String, { nullable: true }) memberId?: string;
  @Field() displayName!: string;
  @Field(() => String, { nullable: true }) title?: string;
  @Field(() => PayFrequencyEnum, { nullable: true }) payFrequency?: string;
  @Field(() => Int) grossMinor!: number;
  @Field(() => String, { nullable: true }) expenseAccountId?: string;
  @Field(() => String, { nullable: true }) liabilityAccountId?: string;
}

@InputType()
export class PayrollEmployeeUpdateInput {
  @Field(() => String, { nullable: true }) displayName?: string;
  @Field(() => String, { nullable: true }) title?: string;
  @Field(() => PayFrequencyEnum, { nullable: true }) payFrequency?: string;
  @Field(() => Int, { nullable: true }) grossMinor?: number;
  @Field(() => String, { nullable: true }) expenseAccountId?: string;
  @Field(() => String, { nullable: true }) liabilityAccountId?: string;
  @Field(() => PayrollEmployeeStatusEnum, { nullable: true }) status?: string;
}

@InputType()
export class PayrollEmployeeListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => String, { nullable: true }) search?: string;
  @Field(() => PayrollEmployeeStatusEnum, { nullable: true }) status?: string;
}

@InputType()
export class PayrollRunCreateInput {
  @Field() periodStart!: string;
  @Field() periodEnd!: string;
  @Field() payOn!: string;
  @Field(() => String, { nullable: true }) memo?: string;
}

@InputType()
export class PayrollRunListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => PayrollRunStatusEnum, { nullable: true }) status?: string;
}

@InputType()
export class BudgetLineInput {
  @Field() accountId!: string;
  @Field(() => Int) amountMinor!: number;
  @Field(() => String, { nullable: true }) notes?: string;
}

@InputType()
export class BudgetCreateInput {
  @Field() name!: string;
  @Field() startsOn!: string;
  @Field() endsOn!: string;
  @Field(() => String, { nullable: true }) notes?: string;
  @Field(() => [BudgetLineInput]) lines!: BudgetLineInput[];
}

@InputType()
export class BudgetListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => BudgetStatusEnum, { nullable: true }) status?: string;
  @Field(() => String, { nullable: true }) search?: string;
}

@InputType()
export class ProjectCreateInput {
  @Field() name!: string;
  @Field(() => String, { nullable: true }) description?: string;
  @Field(() => String, { nullable: true }) startsOn?: string;
  @Field(() => String, { nullable: true }) endsOn?: string;
  @Field(() => Int, { nullable: true }) budgetMinor?: number;
  @Field(() => String, { nullable: true }) expenseAccountId?: string;
}

@InputType()
export class ProjectUpdateInput {
  @Field(() => String, { nullable: true }) name?: string;
  @Field(() => String, { nullable: true }) description?: string;
  @Field(() => String, { nullable: true }) startsOn?: string;
  @Field(() => String, { nullable: true }) endsOn?: string;
  @Field(() => Int, { nullable: true }) budgetMinor?: number;
  @Field(() => String, { nullable: true }) expenseAccountId?: string;
  @Field(() => ProjectStatusEnum, { nullable: true }) status?: string;
}

@InputType()
export class ProjectListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => ProjectStatusEnum, { nullable: true }) status?: string;
  @Field(() => String, { nullable: true }) search?: string;
}

@InputType()
export class VendorCreateInput {
  @Field() name!: string;
  @Field(() => String, { nullable: true }) contactName?: string;
  @Field(() => String, { nullable: true }) email?: string;
  @Field(() => String, { nullable: true }) phone?: string;
  @Field(() => String, { nullable: true }) notes?: string;
}

@InputType()
export class VendorUpdateInput {
  @Field(() => String, { nullable: true }) name?: string;
  @Field(() => String, { nullable: true }) contactName?: string;
  @Field(() => String, { nullable: true }) email?: string;
  @Field(() => String, { nullable: true }) phone?: string;
  @Field(() => String, { nullable: true }) notes?: string;
  @Field(() => VendorStatusEnum, { nullable: true }) status?: string;
}

@InputType()
export class VendorListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => String, { nullable: true }) search?: string;
  @Field(() => VendorStatusEnum, { nullable: true }) status?: string;
}

@InputType()
export class PurchaseOrderLineInput {
  @Field() description!: string;
  @Field(() => Int) quantity!: number;
  @Field(() => Int) unitCostMinor!: number;
  @Field(() => String, { nullable: true }) accountId?: string;
}

@InputType()
export class PurchaseOrderCreateInput {
  @Field() vendorId!: string;
  @Field() orderedOn!: string;
  @Field(() => String, { nullable: true }) expectedOn?: string;
  @Field(() => String, { nullable: true }) memo?: string;
  @Field(() => String, { nullable: true }) projectId?: string;
  @Field(() => [PurchaseOrderLineInput]) lines!: PurchaseOrderLineInput[];
}

@InputType()
export class PurchaseOrderListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => PurchaseOrderStatusEnum, { nullable: true }) status?: string;
  @Field(() => String, { nullable: true }) vendorId?: string;
}

@InputType()
export class BillCreateInput {
  @Field() vendorId!: string;
  @Field(() => String, { nullable: true }) purchaseOrderId?: string;
  @Field() billedOn!: string;
  @Field(() => String, { nullable: true }) dueOn?: string;
  @Field(() => String, { nullable: true }) memo?: string;
  @Field() expenseAccountId!: string;
  @Field(() => Int) amountMinor!: number;
  @Field(() => String, { nullable: true }) projectId?: string;
}

@InputType()
export class BillListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => BillStatusEnum, { nullable: true }) status?: string;
  @Field(() => String, { nullable: true }) vendorId?: string;
}

@InputType()
export class ExpenseCreateInput {
  @Field(() => String, { nullable: true }) memberId?: string;
  @Field(() => String, { nullable: true }) submitterName?: string;
  @Field() incurredOn!: string;
  @Field(() => Int) amountMinor!: number;
  @Field(() => String, { nullable: true }) merchant?: string;
  @Field() memo!: string;
  @Field() expenseAccountId!: string;
  @Field(() => String, { nullable: true }) projectId?: string;
  @Field(() => String, { nullable: true }) departmentId?: string;
}

@InputType()
export class ExpenseListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => ExpenseStatusEnum, { nullable: true }) status?: string;
  @Field(() => String, { nullable: true }) memberId?: string;
}

@InputType()
export class ExpenseDecisionInput {
  @Field(() => ApprovalDecisionEnum) decision!: string;
  @Field(() => String, { nullable: true }) note?: string;
}

@InputType()
export class BankAccountCreateInput {
  @Field() name!: string;
  @Field(() => String, { nullable: true }) institution?: string;
  @Field(() => String, { nullable: true }) accountNumberMasked?: string;
  @Field() glAccountId!: string;
}

@InputType()
export class BankAccountListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => String, { nullable: true }) search?: string;
}

@InputType()
export class BankTransactionCreateInput {
  @Field() occurredOn!: string;
  @Field(() => Int) amountMinor!: number;
  @Field(() => BankTransactionKindEnum) kind!: string;
  @Field() description!: string;
  @Field(() => String, { nullable: true }) externalRef?: string;
}

@InputType()
export class BankTransactionListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => Boolean, { nullable: true }) unmatchedOnly?: boolean;
  @Field(() => String, { nullable: true }) from?: string;
  @Field(() => String, { nullable: true }) to?: string;
}

@InputType()
export class ReconciliationCreateInput {
  @Field() statementOn!: string;
  @Field(() => Int) statementBalanceMinor!: number;
}

@InputType()
export class ReconciliationMatchInput {
  @Field() bankTransactionId!: string;
  @Field() journalId!: string;
}

@InputType()
export class ReconciliationListInput {
  @Field(() => Int, { nullable: true }) limit?: number;
  @Field(() => Int, { nullable: true }) offset?: number;
  @Field(() => ReconciliationStatusEnum, { nullable: true }) status?: string;
}

@InputType()
export class ReportQueryInput {
  @Field(() => ReportKindEnum) kind!: string;
  @Field(() => String, { nullable: true }) from?: string;
  @Field(() => String, { nullable: true }) to?: string;
  @Field(() => String, { nullable: true }) asOf?: string;
  @Field(() => String, { nullable: true }) budgetId?: string;
  @Field(() => String, { nullable: true }) projectId?: string;
  @Field(() => String, { nullable: true }) memberId?: string;
}
