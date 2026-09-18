import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Permission,
  familyListQuerySchema,
  familyMemberAddSchema,
  familySchema,
  familyUpdateSchema,
  type FamilyListQuery,
  type FamilyMemberAddRequest,
  type FamilyPage,
  type FamilyRequest,
  type FamilyResponse,
  type FamilyUpdateRequest,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../../common/security/principal';
import { FamilyService } from '../family.service';
import { tenantOf } from '../membership.utils';
import { FamilyInput, FamilyListInput, FamilyMemberAddInput, FamilyUpdateInput } from './inputs';
import { FamilyPageType, FamilyType } from './types';

@Resolver(() => FamilyType)
export class FamiliesResolver {
  constructor(private readonly families: FamilyService) {}

  @Query(() => FamilyPageType, { name: 'families' })
  @RequirePermissions(Permission.FAMILY_READ)
  listFamilies(
    @Args('filter', { type: () => FamilyListInput, nullable: true }, new ZodValidationPipe(familyListQuerySchema.default({})))
    filter: FamilyListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FamilyPage> {
    return this.families.list(tenantOf(principal), filter);
  }

  @Query(() => FamilyType, { name: 'family' })
  @RequirePermissions(Permission.FAMILY_READ)
  getFamily(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FamilyResponse> {
    return this.families.get(tenantOf(principal), id);
  }

  @Mutation(() => FamilyType, { name: 'createFamily' })
  @RequirePermissions(Permission.FAMILY_MANAGE)
  createFamily(
    @Args('input', { type: () => FamilyInput }, new ZodValidationPipe(familySchema))
    input: FamilyRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FamilyResponse> {
    return this.families.create(tenantOf(principal), input);
  }

  @Mutation(() => FamilyType, { name: 'updateFamily' })
  @RequirePermissions(Permission.FAMILY_MANAGE)
  updateFamily(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => FamilyUpdateInput }, new ZodValidationPipe(familyUpdateSchema))
    input: FamilyUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FamilyResponse> {
    return this.families.update(tenantOf(principal), id, input);
  }

  @Mutation(() => FamilyType, { name: 'addFamilyMember' })
  @RequirePermissions(Permission.FAMILY_MANAGE)
  addFamilyMember(
    @Args('familyId', { type: () => ID }) familyId: string,
    @Args('input', { type: () => FamilyMemberAddInput }, new ZodValidationPipe(familyMemberAddSchema))
    input: FamilyMemberAddRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FamilyResponse> {
    return this.families.addMember(tenantOf(principal), principal.userId, familyId, input);
  }

  @Mutation(() => FamilyType, { name: 'removeFamilyMember' })
  @RequirePermissions(Permission.FAMILY_MANAGE)
  removeFamilyMember(
    @Args('familyId', { type: () => ID }) familyId: string,
    @Args('memberId', { type: () => ID }) memberId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FamilyResponse> {
    return this.families.removeMember(tenantOf(principal), principal.userId, familyId, memberId);
  }
}
