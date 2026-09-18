import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Permission,
  accountCreateSchema,
  accountListQuerySchema,
  accountUpdateSchema,
  fiscalPeriodCreateSchema,
  fiscalPeriodListQuerySchema,
  journalCreateSchema,
  journalListQuerySchema,
  journalVoidSchema,
  type Account,
  type AccountCreateRequest,
  type AccountListQuery,
  type AccountPage,
  type AccountUpdateRequest,
  type FiscalPeriod,
  type FiscalPeriodCreateRequest,
  type FiscalPeriodListQuery,
  type FiscalPeriodPage,
  type Journal,
  type JournalCreateRequest,
  type JournalListQuery,
  type JournalPage,
  type JournalVoidRequest,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../../common/security/decorators';
import { tenantOf, type AuthenticatedPrincipal } from '../../../common/security/principal';
import { LedgerService } from '../ledger.service';
import {
  AccountCreateInput,
  AccountListInput,
  AccountUpdateInput,
  FiscalPeriodCreateInput,
  FiscalPeriodListInput,
  JournalCreateInput,
  JournalListInput,
  JournalVoidInput,
} from './inputs';
import {
  FiscalPeriodPageType,
  FiscalPeriodType,
  GlAccountPageType,
  GlAccountType,
  JournalPageType,
  JournalType,
} from './types';

@Resolver(() => GlAccountType)
export class LedgerResolver {
  constructor(private readonly ledger: LedgerService) {}

  @Query(() => GlAccountPageType, { name: 'glAccounts' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listAccounts(
    @Args('filter', { type: () => AccountListInput, nullable: true }, new ZodValidationPipe(accountListQuerySchema.default({})))
    filter: AccountListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<AccountPage> {
    return this.ledger.listAccounts(tenantOf(principal), filter);
  }

  @Query(() => GlAccountType, { name: 'glAccount' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getAccount(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Account> {
    return this.ledger.getAccount(tenantOf(principal), id);
  }

  @Mutation(() => GlAccountType, { name: 'createGlAccount' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createAccount(
    @Args('input', { type: () => AccountCreateInput }, new ZodValidationPipe(accountCreateSchema))
    input: AccountCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Account> {
    return this.ledger.createAccount(tenantOf(principal), principal.userId, input);
  }

  @Mutation(() => GlAccountType, { name: 'updateGlAccount' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  updateAccount(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => AccountUpdateInput }, new ZodValidationPipe(accountUpdateSchema))
    input: AccountUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Account> {
    return this.ledger.updateAccount(tenantOf(principal), principal.userId, id, input);
  }

  @Query(() => FiscalPeriodPageType, { name: 'fiscalPeriods' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listPeriods(
    @Args('filter', { type: () => FiscalPeriodListInput, nullable: true }, new ZodValidationPipe(fiscalPeriodListQuerySchema.default({})))
    filter: FiscalPeriodListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FiscalPeriodPage> {
    return this.ledger.listPeriods(tenantOf(principal), filter);
  }

  @Mutation(() => FiscalPeriodType, { name: 'createFiscalPeriod' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createPeriod(
    @Args('input', { type: () => FiscalPeriodCreateInput }, new ZodValidationPipe(fiscalPeriodCreateSchema))
    input: FiscalPeriodCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FiscalPeriod> {
    return this.ledger.createPeriod(tenantOf(principal), principal.userId, input);
  }

  @Mutation(() => FiscalPeriodType, { name: 'closeFiscalPeriod' })
  @RequirePermissions(Permission.ACCOUNTING_CLOSE_PERIOD)
  closePeriod(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FiscalPeriod> {
    return this.ledger.closePeriod(tenantOf(principal), principal.userId, id);
  }

  @Query(() => JournalPageType, { name: 'journals' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listJournals(
    @Args('filter', { type: () => JournalListInput, nullable: true }, new ZodValidationPipe(journalListQuerySchema.default({})))
    filter: JournalListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<JournalPage> {
    return this.ledger.listJournals(tenantOf(principal), filter);
  }

  @Query(() => JournalType, { name: 'journal' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getJournal(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Journal> {
    return this.ledger.getJournal(tenantOf(principal), id);
  }

  @Mutation(() => JournalType, { name: 'createJournal' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createJournal(
    @Args('input', { type: () => JournalCreateInput }, new ZodValidationPipe(journalCreateSchema))
    input: JournalCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Journal> {
    return this.ledger.createJournal(tenantOf(principal), principal.userId, input);
  }

  @Mutation(() => JournalType, { name: 'postJournal' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  postJournal(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Journal> {
    return this.ledger.postJournal(tenantOf(principal), principal.userId, id);
  }

  @Mutation(() => JournalType, { name: 'voidJournal' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  voidJournal(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => JournalVoidInput }, new ZodValidationPipe(journalVoidSchema))
    input: JournalVoidRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Journal> {
    return this.ledger.voidJournal(tenantOf(principal), principal.userId, id, input);
  }
}
