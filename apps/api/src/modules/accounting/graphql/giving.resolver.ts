import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Permission,
  contributionCreateSchema,
  contributionListQuerySchema,
  contributionRefundSchema,
  fundCreateSchema,
  fundListQuerySchema,
  fundUpdateSchema,
  type Contribution,
  type ContributionCreateRequest,
  type ContributionListQuery,
  type ContributionPage,
  type ContributionRefundRequest,
  type Fund,
  type FundCreateRequest,
  type FundListQuery,
  type FundPage,
  type FundUpdateRequest,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../../common/security/decorators';
import { tenantOf, type AuthenticatedPrincipal } from '../../../common/security/principal';
import { GivingService } from '../giving.service';
import {
  ContributionCreateInput,
  ContributionListInput,
  ContributionRefundInput,
  FundCreateInput,
  FundListInput,
  FundUpdateInput,
} from './inputs';
import { ContributionPageType, ContributionType, FundPageType, FundType } from './types';

@Resolver(() => FundType)
export class GivingResolver {
  constructor(private readonly giving: GivingService) {}

  @Query(() => FundPageType, { name: 'givingFunds' })
  @RequirePermissions(Permission.GIVING_READ)
  listFunds(
    @Args('filter', { type: () => FundListInput, nullable: true }, new ZodValidationPipe(fundListQuerySchema.default({})))
    filter: FundListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<FundPage> {
    return this.giving.listFunds(tenantOf(principal), filter);
  }

  @Query(() => FundType, { name: 'givingFund' })
  @RequirePermissions(Permission.GIVING_READ)
  getFund(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Fund> {
    return this.giving.getFund(tenantOf(principal), id);
  }

  @Mutation(() => FundType, { name: 'createGivingFund' })
  @RequirePermissions(Permission.GIVING_RECORD)
  createFund(
    @Args('input', { type: () => FundCreateInput }, new ZodValidationPipe(fundCreateSchema))
    input: FundCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Fund> {
    return this.giving.createFund(tenantOf(principal), principal.userId, input);
  }

  @Mutation(() => FundType, { name: 'updateGivingFund' })
  @RequirePermissions(Permission.GIVING_RECORD)
  updateFund(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => FundUpdateInput }, new ZodValidationPipe(fundUpdateSchema))
    input: FundUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Fund> {
    return this.giving.updateFund(tenantOf(principal), principal.userId, id, input);
  }

  @Query(() => ContributionPageType, { name: 'contributions' })
  @RequirePermissions(Permission.GIVING_READ)
  listContributions(
    @Args('filter', { type: () => ContributionListInput, nullable: true }, new ZodValidationPipe(contributionListQuerySchema.default({})))
    filter: ContributionListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<ContributionPage> {
    return this.giving.listContributions(tenantOf(principal), filter);
  }

  @Query(() => ContributionType, { name: 'contribution' })
  @RequirePermissions(Permission.GIVING_READ)
  getContribution(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Contribution> {
    return this.giving.getContribution(tenantOf(principal), id);
  }

  @Mutation(() => ContributionType, { name: 'recordContribution' })
  @RequirePermissions(Permission.GIVING_RECORD)
  recordContribution(
    @Args('input', { type: () => ContributionCreateInput }, new ZodValidationPipe(contributionCreateSchema))
    input: ContributionCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Contribution> {
    return this.giving.recordContribution(tenantOf(principal), principal.userId, input);
  }

  @Mutation(() => ContributionType, { name: 'refundContribution' })
  @RequirePermissions(Permission.GIVING_REFUND)
  refundContribution(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => ContributionRefundInput }, new ZodValidationPipe(contributionRefundSchema))
    input: ContributionRefundRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<Contribution> {
    return this.giving.refundContribution(tenantOf(principal), principal.userId, id, input);
  }
}
