import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Permission,
  bankAccountCreateSchema,
  bankAccountListQuerySchema,
  bankTransactionCreateSchema,
  bankTransactionListQuerySchema,
  reconciliationCreateSchema,
  reconciliationListQuerySchema,
  reconciliationMatchSchema,
  type BankAccount,
  type BankAccountCreateRequest,
  type BankAccountListQuery,
  type BankAccountPage,
  type BankTransaction,
  type BankTransactionCreateRequest,
  type BankTransactionListQuery,
  type BankTransactionPage,
  type Reconciliation,
  type ReconciliationCreateRequest,
  type ReconciliationListQuery,
  type ReconciliationMatchRequest,
  type ReconciliationPage,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../../common/security/decorators';
import { tenantOf, type AuthenticatedPrincipal } from '../../../common/security/principal';
import { ReconService } from '../recon.service';
import {
  BankAccountCreateInput,
  BankAccountListInput,
  BankTransactionCreateInput,
  BankTransactionListInput,
  ReconciliationCreateInput,
  ReconciliationListInput,
  ReconciliationMatchInput,
} from './inputs';
import {
  BankAccountPageType,
  BankAccountType,
  BankTransactionPageType,
  BankTransactionType,
  ReconciliationPageType,
  ReconciliationType,
} from './types';

@Resolver(() => BankAccountType)
export class ReconResolver {
  constructor(private readonly recon: ReconService) {}

  @Query(() => BankAccountPageType, { name: 'bankAccounts' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listBankAccounts(
    @Args('filter', { type: () => BankAccountListInput, nullable: true }, new ZodValidationPipe(bankAccountListQuerySchema.default({})))
    filter: BankAccountListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<BankAccountPage> {
    return this.recon.listBankAccounts(tenantOf(principal), filter);
  }

  @Query(() => BankAccountType, { name: 'bankAccount' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getBankAccount(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<BankAccount> {
    return this.recon.getBankAccount(tenantOf(principal), id);
  }

  @Mutation(() => BankAccountType, { name: 'createBankAccount' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createBankAccount(
    @Args('input', { type: () => BankAccountCreateInput }, new ZodValidationPipe(bankAccountCreateSchema))
    input: BankAccountCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<BankAccount> {
    return this.recon.createBankAccount(tenantOf(principal), principal.userId, input);
  }

  @Query(() => BankTransactionPageType, { name: 'bankTransactions' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listTransactions(
    @Args('bankAccountId', { type: () => ID }) bankAccountId: string,
    @Args('filter', { type: () => BankTransactionListInput, nullable: true }, new ZodValidationPipe(bankTransactionListQuerySchema.default({})))
    filter: BankTransactionListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<BankTransactionPage> {
    return this.recon.listTransactions(tenantOf(principal), bankAccountId, filter);
  }

  @Mutation(() => BankTransactionType, { name: 'addBankTransaction' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  addTransaction(
    @Args('bankAccountId', { type: () => ID }) bankAccountId: string,
    @Args('input', { type: () => BankTransactionCreateInput }, new ZodValidationPipe(bankTransactionCreateSchema))
    input: BankTransactionCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<BankTransaction> {
    return this.recon.addTransaction(tenantOf(principal), principal.userId, bankAccountId, input);
  }

  @Query(() => ReconciliationPageType, { name: 'reconciliations' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listReconciliations(
    @Args('bankAccountId', { type: () => ID }) bankAccountId: string,
    @Args('filter', { type: () => ReconciliationListInput, nullable: true }, new ZodValidationPipe(reconciliationListQuerySchema.default({})))
    filter: ReconciliationListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<ReconciliationPage> {
    return this.recon.listReconciliations(tenantOf(principal), bankAccountId, filter);
  }

  @Query(() => ReconciliationType, { name: 'reconciliation' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getReconciliation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Reconciliation> {
    return this.recon.getReconciliation(tenantOf(principal), id);
  }

  @Mutation(() => ReconciliationType, { name: 'createReconciliation' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createReconciliation(
    @Args('bankAccountId', { type: () => ID }) bankAccountId: string,
    @Args('input', { type: () => ReconciliationCreateInput }, new ZodValidationPipe(reconciliationCreateSchema))
    input: ReconciliationCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Reconciliation> {
    return this.recon.createReconciliation(tenantOf(principal), principal.userId, bankAccountId, input);
  }

  @Mutation(() => ReconciliationType, { name: 'matchReconciliation' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  matchReconciliation(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => ReconciliationMatchInput }, new ZodValidationPipe(reconciliationMatchSchema))
    input: ReconciliationMatchRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Reconciliation> {
    return this.recon.match(tenantOf(principal), principal.userId, id, input);
  }

  @Mutation(() => ReconciliationType, { name: 'completeReconciliation' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  completeReconciliation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Reconciliation> {
    return this.recon.complete(tenantOf(principal), principal.userId, id);
  }
}
