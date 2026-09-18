import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Permission,
  payrollEmployeeCreateSchema,
  payrollEmployeeListQuerySchema,
  payrollEmployeeUpdateSchema,
  payrollRunCreateSchema,
  payrollRunListQuerySchema,
  type PayrollEmployee,
  type PayrollEmployeeCreateRequest,
  type PayrollEmployeeListQuery,
  type PayrollEmployeePage,
  type PayrollEmployeeUpdateRequest,
  type PayrollRun,
  type PayrollRunCreateRequest,
  type PayrollRunListQuery,
  type PayrollRunPage,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../../common/security/decorators';
import { tenantOf, type AuthenticatedPrincipal } from '../../../common/security/principal';
import { PayrollService } from '../payroll.service';
import {
  PayrollEmployeeCreateInput,
  PayrollEmployeeListInput,
  PayrollEmployeeUpdateInput,
  PayrollRunCreateInput,
  PayrollRunListInput,
} from './inputs';
import { PayrollEmployeePageType, PayrollEmployeeType, PayrollRunPageType, PayrollRunType } from './types';

@Resolver(() => PayrollEmployeeType)
export class PayrollResolver {
  constructor(private readonly payroll: PayrollService) {}

  @Query(() => PayrollEmployeePageType, { name: 'payrollEmployees' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listEmployees(
    @Args('filter', { type: () => PayrollEmployeeListInput, nullable: true }, new ZodValidationPipe(payrollEmployeeListQuerySchema.default({})))
    filter: PayrollEmployeeListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollEmployeePage> {
    return this.payroll.listEmployees(tenantOf(principal), filter);
  }

  @Query(() => PayrollEmployeeType, { name: 'payrollEmployee' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getEmployee(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollEmployee> {
    return this.payroll.getEmployee(tenantOf(principal), id);
  }

  @Mutation(() => PayrollEmployeeType, { name: 'createPayrollEmployee' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createEmployee(
    @Args('input', { type: () => PayrollEmployeeCreateInput }, new ZodValidationPipe(payrollEmployeeCreateSchema))
    input: PayrollEmployeeCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollEmployee> {
    return this.payroll.createEmployee(tenantOf(principal), principal.userId, input);
  }

  @Mutation(() => PayrollEmployeeType, { name: 'updatePayrollEmployee' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  updateEmployee(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => PayrollEmployeeUpdateInput }, new ZodValidationPipe(payrollEmployeeUpdateSchema))
    input: PayrollEmployeeUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollEmployee> {
    return this.payroll.updateEmployee(tenantOf(principal), principal.userId, id, input);
  }

  @Query(() => PayrollRunPageType, { name: 'payrollRuns' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  listRuns(
    @Args('filter', { type: () => PayrollRunListInput, nullable: true }, new ZodValidationPipe(payrollRunListQuerySchema.default({})))
    filter: PayrollRunListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollRunPage> {
    return this.payroll.listRuns(tenantOf(principal), filter);
  }

  @Query(() => PayrollRunType, { name: 'payrollRun' })
  @RequirePermissions(Permission.ACCOUNTING_READ)
  getRun(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollRun> {
    return this.payroll.getRun(tenantOf(principal), id);
  }

  @Mutation(() => PayrollRunType, { name: 'createPayrollRun' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  createRun(
    @Args('input', { type: () => PayrollRunCreateInput }, new ZodValidationPipe(payrollRunCreateSchema))
    input: PayrollRunCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollRun> {
    return this.payroll.createRun(tenantOf(principal), principal.userId, input);
  }

  @Mutation(() => PayrollRunType, { name: 'approvePayrollRun' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  approveRun(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollRun> {
    return this.payroll.approveRun(tenantOf(principal), principal.userId, id);
  }

  @Mutation(() => PayrollRunType, { name: 'postPayrollRun' })
  @RequirePermissions(Permission.ACCOUNTING_MANAGE)
  postRun(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<PayrollRun> {
    return this.payroll.postRun(tenantOf(principal), principal.userId, id);
  }
}
