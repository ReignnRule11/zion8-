import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Permission,
  volunteerAssignmentSchema,
  volunteerAssignmentUpdateSchema,
  volunteerRoleListQuerySchema,
  volunteerRoleSchema,
  volunteerRoleUpdateSchema,
  type VolunteerAssignmentRequest,
  type VolunteerAssignmentResponse,
  type VolunteerAssignmentUpdateRequest,
  type VolunteerRoleListQuery,
  type VolunteerRolePage,
  type VolunteerRoleRequest,
  type VolunteerRoleResponse,
  type VolunteerRoleUpdateRequest,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../../common/security/principal';
import { tenantOf } from '../membership.utils';
import { VolunteerService } from '../volunteer.service';
import {
  VolunteerAssignmentInput,
  VolunteerAssignmentUpdateInput,
  VolunteerRoleInput,
  VolunteerRoleListInput,
  VolunteerRoleUpdateInput,
} from './inputs';
import { VolunteerAssignmentType, VolunteerRolePageType, VolunteerRoleType } from './types';

@Resolver(() => VolunteerRoleType)
export class VolunteersResolver {
  constructor(private readonly volunteers: VolunteerService) {}

  @Query(() => VolunteerRolePageType, { name: 'volunteerRoles' })
  @RequirePermissions(Permission.VOLUNTEER_READ)
  listRoles(
    @Args('filter', { type: () => VolunteerRoleListInput, nullable: true }, new ZodValidationPipe(volunteerRoleListQuerySchema.default({})))
    filter: VolunteerRoleListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VolunteerRolePage> {
    return this.volunteers.listRoles(tenantOf(principal), filter);
  }

  @Query(() => VolunteerRoleType, { name: 'volunteerRole' })
  @RequirePermissions(Permission.VOLUNTEER_READ)
  getRole(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VolunteerRoleResponse> {
    return this.volunteers.getRole(tenantOf(principal), id);
  }

  @Mutation(() => VolunteerRoleType, { name: 'createVolunteerRole' })
  @RequirePermissions(Permission.VOLUNTEER_MANAGE)
  createRole(
    @Args('input', { type: () => VolunteerRoleInput }, new ZodValidationPipe(volunteerRoleSchema))
    input: VolunteerRoleRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VolunteerRoleResponse> {
    return this.volunteers.createRole(tenantOf(principal), input);
  }

  @Mutation(() => VolunteerRoleType, { name: 'updateVolunteerRole' })
  @RequirePermissions(Permission.VOLUNTEER_MANAGE)
  updateRole(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => VolunteerRoleUpdateInput }, new ZodValidationPipe(volunteerRoleUpdateSchema))
    input: VolunteerRoleUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VolunteerRoleResponse> {
    return this.volunteers.updateRole(tenantOf(principal), id, input);
  }

  @Mutation(() => VolunteerAssignmentType, { name: 'assignVolunteer' })
  @RequirePermissions(Permission.VOLUNTEER_MANAGE)
  assign(
    @Args('roleId', { type: () => ID }) roleId: string,
    @Args('input', { type: () => VolunteerAssignmentInput }, new ZodValidationPipe(volunteerAssignmentSchema))
    input: VolunteerAssignmentRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VolunteerAssignmentResponse> {
    return this.volunteers.assign(tenantOf(principal), principal.userId, roleId, input);
  }

  @Mutation(() => VolunteerAssignmentType, { name: 'updateVolunteerAssignment' })
  @RequirePermissions(Permission.VOLUNTEER_MANAGE)
  updateAssignment(
    @Args('roleId', { type: () => ID }) roleId: string,
    @Args('assignmentId', { type: () => ID }) assignmentId: string,
    @Args('input', { type: () => VolunteerAssignmentUpdateInput }, new ZodValidationPipe(volunteerAssignmentUpdateSchema))
    input: VolunteerAssignmentUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VolunteerAssignmentResponse> {
    return this.volunteers.updateAssignment(tenantOf(principal), roleId, assignmentId, input);
  }

  @Mutation(() => Boolean, { name: 'endVolunteerAssignment' })
  @RequirePermissions(Permission.VOLUNTEER_MANAGE)
  async endAssignment(
    @Args('roleId', { type: () => ID }) roleId: string,
    @Args('assignmentId', { type: () => ID }) assignmentId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<boolean> {
    await this.volunteers.endAssignment(tenantOf(principal), roleId, assignmentId);
    return true;
  }
}
