import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Permission,
  visitorConvertSchema,
  visitorListQuerySchema,
  visitorSchema,
  visitorUpdateSchema,
  visitorVisitSchema,
  type VisitorConvertRequest,
  type VisitorListQuery,
  type VisitorPage,
  type VisitorRequest,
  type VisitorResponse,
  type VisitorUpdateRequest,
  type VisitorVisitRequest,
  type VisitorVisitResponse,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../../common/security/principal';
import { tenantOf } from '../membership.utils';
import { VisitorService } from '../visitor.service';
import {
  VisitorConvertInput,
  VisitorInput,
  VisitorListInput,
  VisitorUpdateInput,
  VisitorVisitInput,
} from './inputs';
import { VisitorPageType, VisitorType, VisitorVisitType } from './types';

@Resolver(() => VisitorType)
export class VisitorsResolver {
  constructor(private readonly visitors: VisitorService) {}

  @Query(() => VisitorPageType, { name: 'visitors' })
  @RequirePermissions(Permission.VISITOR_READ)
  listVisitors(
    @Args('filter', { type: () => VisitorListInput, nullable: true }, new ZodValidationPipe(visitorListQuerySchema.default({})))
    filter: VisitorListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VisitorPage> {
    return this.visitors.list(tenantOf(principal), filter);
  }

  @Query(() => VisitorType, { name: 'visitor' })
  @RequirePermissions(Permission.VISITOR_READ)
  getVisitor(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VisitorResponse> {
    return this.visitors.get(tenantOf(principal), id);
  }

  @Mutation(() => VisitorType, { name: 'createVisitor' })
  @RequirePermissions(Permission.VISITOR_CREATE)
  createVisitor(
    @Args('input', { type: () => VisitorInput }, new ZodValidationPipe(visitorSchema))
    input: VisitorRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VisitorResponse> {
    return this.visitors.create(tenantOf(principal), principal.userId, input);
  }

  @Mutation(() => VisitorType, { name: 'updateVisitor' })
  @RequirePermissions(Permission.VISITOR_UPDATE)
  updateVisitor(
    @Args('id', { type: () => ID }) id: string,
    @Args('input', { type: () => VisitorUpdateInput }, new ZodValidationPipe(visitorUpdateSchema))
    input: VisitorUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VisitorResponse> {
    return this.visitors.update(tenantOf(principal), id, input);
  }

  @Mutation(() => VisitorVisitType, { name: 'addVisitorVisit' })
  @RequirePermissions(Permission.VISITOR_UPDATE)
  addVisitorVisit(
    @Args('visitorId', { type: () => ID }) visitorId: string,
    @Args('input', { type: () => VisitorVisitInput }, new ZodValidationPipe(visitorVisitSchema))
    input: VisitorVisitRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VisitorVisitResponse> {
    return this.visitors.addVisit(tenantOf(principal), principal.userId, visitorId, input);
  }

  @Mutation(() => VisitorType, { name: 'convertVisitor' })
  @RequirePermissions(Permission.VISITOR_MANAGE)
  convertVisitor(
    @Args('visitorId', { type: () => ID }) visitorId: string,
    @Args('input', { type: () => VisitorConvertInput, nullable: true }, new ZodValidationPipe(visitorConvertSchema.default({})))
    input: VisitorConvertRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<VisitorResponse> {
    return this.visitors.convert(tenantOf(principal), principal.userId, visitorId, input);
  }
}
