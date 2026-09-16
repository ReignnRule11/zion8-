import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Permission,
  timelineNoteSchema,
  timelineQuerySchema,
  type TimelineEntryResponse,
  type TimelineNoteRequest,
  type TimelinePage,
  type TimelineQuery,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../../common/security/principal';
import { tenantOf } from '../membership.utils';
import { TimelineService } from '../timeline.service';
import { TimelineListInput, TimelineNoteInput } from './inputs';
import { TimelineEntryType, TimelinePageType } from './types';

@Resolver(() => TimelineEntryType)
export class TimelineResolver {
  constructor(private readonly timeline: TimelineService) {}

  @Query(() => TimelinePageType, { name: 'memberTimeline' })
  @RequirePermissions(Permission.TIMELINE_READ)
  list(
    @Args('memberId', { type: () => ID }) memberId: string,
    @Args('filter', { type: () => TimelineListInput, nullable: true }, new ZodValidationPipe(timelineQuerySchema.default({})))
    filter: TimelineQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<TimelinePage> {
    return this.timeline.list(tenantOf(principal), memberId, filter);
  }

  @Mutation(() => TimelineEntryType, { name: 'addMemberTimelineNote' })
  @RequirePermissions(Permission.TIMELINE_MANAGE)
  addNote(
    @Args('memberId', { type: () => ID }) memberId: string,
    @Args('input', { type: () => TimelineNoteInput }, new ZodValidationPipe(timelineNoteSchema))
    input: TimelineNoteRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<TimelineEntryResponse> {
    return this.timeline.addNote(tenantOf(principal), principal.userId, memberId, input);
  }

  @Mutation(() => Boolean, { name: 'deleteTimelineNote' })
  @RequirePermissions(Permission.TIMELINE_MANAGE)
  async deleteNote(
    @Args('noteId', { type: () => ID }) noteId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<boolean> {
    await this.timeline.deleteNote(tenantOf(principal), noteId);
    return true;
  }
}
