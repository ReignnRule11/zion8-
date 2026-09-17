import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Permission,
  departmentListQuerySchema,
  departmentMemberAddSchema,
  departmentMemberUpdateSchema,
  departmentSchema,
  departmentUpdateSchema,
  type DepartmentListQuery,
  type DepartmentMember,
  type DepartmentMemberAddRequest,
  type DepartmentMemberUpdateRequest,
  type DepartmentPage,
  type DepartmentRequest,
  type DepartmentResponse,
  type DepartmentUpdateRequest,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../../common/security/principal';
import { DepartmentService } from '../department.service';
import { tenantOf } from '../membership.utils';
import {
  DepartmentInput,
  DepartmentListInput,
  DepartmentMemberAddInput,
  DepartmentMemberUpdateInput,
  DepartmentUpdateInput,
} from './inputs';
import { DepartmentMemberType, DepartmentPageType, DepartmentType } from './types';

@Resolver(() => DepartmentType)
export class DepartmentsResolver {
  constructor(private readonly departments: DepartmentService) {}

  @Query(() => DepartmentPageType, { name: 'departments' })
  @RequirePermissions(Permission.DEPARTMENT_READ)
  listDepartments(
    @Args('filter', { type: () => DepartmentListInput, nullable: true }, new ZodValidationPipe(departmentListQuerySchema.default({})))
    filter: DepartmentListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DepartmentPage> {
    return this.departments.list(tenantOf(principal), filter);
  }

  @Query(() => DepartmentType, { name: 'department' })
  @RequirePermissions(Permission.DEPARTMENT_READ)
  getDepartment(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DepartmentResponse> {
    return this.departments.get(tenantOf(principal), id);
  }

  @Mutation(() => DepartmentType, { name: 'createDepartment' })
  @RequirePermissions(Permission.DEPARTMENT_MANAGE)
  createDepartment(
    @Args('input', { type: () => DepartmentInput }, new ZodValidationPipe(departmentSchema))
    input: DepartmentRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DepartmentResponse> {
    return this.departments.create(tenantOf(principal), input);
  }

  @Mutation(() => DepartmentType, { name: 'updateDepartment' })
  @RequirePermissions(Permission.DEPARTMENT_MANAGE)
  updateDepartment(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => DepartmentUpdateInput }, new ZodValidationPipe(departmentUpdateSchema))
    input: DepartmentUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DepartmentResponse> {
    return this.departments.update(tenantOf(principal), id, input);
  }

  @Mutation(() => DepartmentMemberType, { name: 'addDepartmentMember' })
  @RequirePermissions(Permission.DEPARTMENT_MANAGE)
  addMember(
    @Args('departmentId', { type: () => ID }) departmentId: string,
    @Args('input', { type: () => DepartmentMemberAddInput }, new ZodValidationPipe(departmentMemberAddSchema))
    input: DepartmentMemberAddRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DepartmentMember> {
    return this.departments.addMember(tenantOf(principal), principal.userId, departmentId, input);
  }

  @Mutation(() => DepartmentMemberType, { name: 'updateDepartmentMember' })
  @RequirePermissions(Permission.DEPARTMENT_MANAGE)
  updateMember(
    @Args('departmentId', { type: () => ID }) departmentId: string,
    @Args('memberId', { type: () => ID }) memberId: string,
    @Args('input', { type: () => DepartmentMemberUpdateInput }, new ZodValidationPipe(departmentMemberUpdateSchema))
    input: DepartmentMemberUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<DepartmentMember> {
    return this.departments.updateMember(tenantOf(principal), departmentId, memberId, input);
  }

  @Mutation(() => Boolean, { name: 'removeDepartmentMember' })
  @RequirePermissions(Permission.DEPARTMENT_MANAGE)
  async removeMember(
    @Args('departmentId', { type: () => ID }) departmentId: string,
    @Args('memberId', { type: () => ID }) memberId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<boolean> {
    await this.departments.removeMember(tenantOf(principal), principal.userId, departmentId, memberId);
    return true;
  }
}
