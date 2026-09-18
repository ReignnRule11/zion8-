import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Permission,
  budgetCreateSchema,
  budgetListQuerySchema,
  projectCreateSchema,
  projectListQuerySchema,
  projectUpdateSchema,
  type Budget,
  type BudgetCreateRequest,
  type BudgetListQuery,
  type BudgetPage,
  type Project,
  type ProjectCreateRequest,
  type ProjectListQuery,
  type ProjectPage,
  type ProjectUpdateRequest,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../../common/security/decorators';
import { tenantOf, type AuthenticatedPrincipal } from '../../../common/security/principal';
import { BudgetService } from '../budget.service';
import {
  BudgetCreateInput,
  BudgetListInput,
  ProjectCreateInput,
  ProjectListInput,
  ProjectUpdateInput,
} from './inputs';
import { BudgetPageType, BudgetType, FinanceProjectPageType, FinanceProjectType } from './types';

@Resolver(() => BudgetType)
export class BudgetResolver {
  constructor(private readonly budgets: BudgetService) {}

  @Query(() => BudgetPageType, { name: 'budgets' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listBudgets(
    @Args('filter', { type: () => BudgetListInput, nullable: true }, new ZodValidationPipe(budgetListQuerySchema.default({})))
    filter: BudgetListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<BudgetPage> {
    return this.budgets.listBudgets(tenantOf(principal), filter);
  }

  @Query(() => BudgetType, { name: 'budget' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getBudget(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Budget> {
    return this.budgets.getBudget(tenantOf(principal), id);
  }

  @Mutation(() => BudgetType, { name: 'createBudget' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createBudget(
    @Args('input', { type: () => BudgetCreateInput }, new ZodValidationPipe(budgetCreateSchema))
    input: BudgetCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Budget> {
    return this.budgets.createBudget(tenantOf(principal), principal.userId, input);
  }

  @Mutation(() => BudgetType, { name: 'activateBudget' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  activateBudget(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Budget> {
    return this.budgets.activateBudget(tenantOf(principal), principal.userId, id);
  }

  @Query(() => FinanceProjectPageType, { name: 'financeProjects' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listProjects(
    @Args('filter', { type: () => ProjectListInput, nullable: true }, new ZodValidationPipe(projectListQuerySchema.default({})))
    filter: ProjectListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<ProjectPage> {
    return this.budgets.listProjects(tenantOf(principal), filter);
  }

  @Query(() => FinanceProjectType, { name: 'financeProject' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getProject(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Project> {
    return this.budgets.getProject(tenantOf(principal), id);
  }

  @Mutation(() => FinanceProjectType, { name: 'createFinanceProject' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createProject(
    @Args('input', { type: () => ProjectCreateInput }, new ZodValidationPipe(projectCreateSchema))
    input: ProjectCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Project> {
    return this.budgets.createProject(tenantOf(principal), principal.userId, input);
  }

  @Mutation(() => FinanceProjectType, { name: 'updateFinanceProject' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  updateProject(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => ProjectUpdateInput }, new ZodValidationPipe(projectUpdateSchema))
    input: ProjectUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Project> {
    return this.budgets.updateProject(tenantOf(principal), principal.userId, id, input);
  }
}
