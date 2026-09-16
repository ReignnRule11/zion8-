import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Permission,
  generateSummarySchema,
  type GenerateSummaryRequest,
  type MemberAiSummaryResponse,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../../common/security/principal';
import { tenantOf } from '../membership.utils';
import { SummaryService } from '../summaries/summary.service';
import { GenerateSummaryInput } from './inputs';
import { MemberAiSummaryType } from './types';

@Resolver(() => MemberAiSummaryType)
export class SummariesResolver {
  constructor(private readonly summaries: SummaryService) {}

  @Query(() => MemberAiSummaryType, { name: 'memberSummary', nullable: true })
  @RequirePermissions(Permission.SUMMARY_READ)
  get(
    @Args('memberId', { type: () => ID }) memberId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberAiSummaryResponse | null> {
    return this.summaries.get(tenantOf(principal), memberId);
  }

  @Mutation(() => MemberAiSummaryType, { name: 'generateMemberSummary' })
  @RequirePermissions(Permission.SUMMARY_GENERATE)
  generate(
    @Args('memberId', { type: () => ID }) memberId: string,
    @Args('input', { type: () => GenerateSummaryInput, nullable: true }, new ZodValidationPipe(generateSummarySchema.default({})))
    input: GenerateSummaryRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemberAiSummaryResponse> {
    return this.summaries.generate(tenantOf(principal), principal.userId, memberId, input);
  }
}
