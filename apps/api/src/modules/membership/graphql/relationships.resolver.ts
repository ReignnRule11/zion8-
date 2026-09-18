import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Permission,
  relationshipGraphQuerySchema,
  relationshipListQuerySchema,
  relationshipSchema,
  type RelationshipGraph,
  type RelationshipGraphQuery,
  type RelationshipListQuery,
  type RelationshipPage,
  type RelationshipRequest,
  type RelationshipResponse,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../../common/security/principal';
import { tenantOf } from '../membership.utils';
import { RelationshipService } from '../relationship.service';
import { RelationshipGraphInput, RelationshipInput, RelationshipListInput } from './inputs';
import { RelationshipGraphType, RelationshipPageType, RelationshipTypeObject } from './types';

@Resolver(() => RelationshipTypeObject)
export class RelationshipsResolver {
  constructor(private readonly relationships: RelationshipService) {}

  @Query(() => RelationshipPageType, { name: 'relationships' })
  @RequirePermissions(Permission.RELATIONSHIP_READ)
  listRelationships(
    @Args('filter', { type: () => RelationshipListInput, nullable: true }, new ZodValidationPipe(relationshipListQuerySchema.default({})))
    filter: RelationshipListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<RelationshipPage> {
    return this.relationships.list(tenantOf(principal), filter);
  }

  @Query(() => RelationshipGraphType, { name: 'relationshipGraph' })
  @RequirePermissions(Permission.RELATIONSHIP_READ)
  graph(
    @Args('input', { type: () => RelationshipGraphInput }, new ZodValidationPipe(relationshipGraphQuerySchema))
    input: RelationshipGraphQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<RelationshipGraph> {
    return this.relationships.graph(tenantOf(principal), input);
  }

  @Mutation(() => RelationshipTypeObject, { name: 'createRelationship' })
  @RequirePermissions(Permission.RELATIONSHIP_MANAGE)
  createRelationship(
    @Args('input', { type: () => RelationshipInput }, new ZodValidationPipe(relationshipSchema))
    input: RelationshipRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<RelationshipResponse> {
    return this.relationships.create(tenantOf(principal), principal.userId, input);
  }

  @Mutation(() => Boolean, { name: 'removeRelationship' })
  @RequirePermissions(Permission.RELATIONSHIP_MANAGE)
  async removeRelationship(
    @Args('id', { type: () => ID }) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<boolean> {
    await this.relationships.remove(tenantOf(principal), id);
    return true;
  }
}
