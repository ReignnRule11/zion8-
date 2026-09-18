import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Permission,
  memberListQuerySchema,
  memberSchema,
  memberUpdateSchema,
  type MemberListQuery,
  type MemberPage,
  type MemberProfile,
  type MemberRequest,
  type MemberResponse,
  type MemberUpdateRequest,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../../common/security/principal';
import { MemberProfileService } from '../member-profile.service';
import { MemberService } from '../member.service';
import { tenantOf } from '../membership.utils';
import { MemberInput, MemberListInput, MemberUpdateInput } from './inputs';
import { MemberPageType, MemberProfileType, MemberType } from './types';

@Resolver(() => MemberType)
export class MembersResolver {
  constructor(
    private readonly members: MemberService,
    private readonly profiles: MemberProfileService,
  ) {}

  @Query(() => MemberPageType, { name: 'members' })
  @RequirePermissions(Permission.MEMBER_READ)
  listMembers(
    @Args('filter', { type: () => MemberListInput, nullable: true }, new ZodValidationPipe(memberListQuerySchema.default({})))
    filter: MemberListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberPage> {
    return this.members.list(tenantOf(principal), filter);
  }

  @Query(() => MemberType, { name: 'member' })
  @RequirePermissions(Permission.MEMBER_READ)
  getMember(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberResponse> {
    return this.members.get(tenantOf(principal), id);
  }

  @Query(() => MemberProfileType, { name: 'memberProfile' })
  @RequirePermissions(Permission.MEMBER_READ)
  getMemberProfile(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberProfile> {
    return this.profiles.get(tenantOf(principal), id);
  }

  @Mutation(() => MemberType, { name: 'createMember' })
  @RequirePermissions(Permission.MEMBER_CREATE)
  createMember(
    @Args('input', { type: () => MemberInput }, new ZodValidationPipe(memberSchema))
    input: MemberRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberResponse> {
    return this.members.create(tenantOf(principal), principal.userId, input);
  }

  @Mutation(() => MemberType, { name: 'updateMember' })
  @RequirePermissions(Permission.MEMBER_UPDATE)
  updateMember(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => MemberUpdateInput }, new ZodValidationPipe(memberUpdateSchema))
    input: MemberUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberResponse> {
    return this.members.update(tenantOf(principal), principal.userId, id, input);
  }

  @Mutation(() => MemberType, { name: 'archiveMember' })
  @RequirePermissions(Permission.MEMBER_ARCHIVE)
  archiveMember(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberResponse> {
    return this.members.archive(tenantOf(principal), principal.userId, id);
  }
}
