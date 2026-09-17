import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  Permission,
  sermonCreateSchema,
  sermonGenerateSchema,
  sermonListQuerySchema,
  sermonNoteCreateSchema,
  sermonNoteListQuerySchema,
  sermonNoteUpdateSchema,
  sermonPublishSchema,
  sermonReprocessSchema,
  sermonSearchQuerySchema,
  sermonSeriesCreateSchema,
  sermonSeriesListQuerySchema,
  sermonSeriesUpdateSchema,
  sermonShareCreateSchema,
  sermonTranscriptUpsertSchema,
  sermonUpdateSchema,
  type SermonCreateRequest,
  type SermonGenerateRequest,
  type SermonGenerateResponse,
  type SermonJobSummary,
  type SermonListQuery,
  type SermonNote,
  type SermonNoteCreateRequest,
  type SermonNoteListQuery,
  type SermonNotePage,
  type SermonNoteUpdateRequest,
  type SermonPage,
  type SermonPublishRequest,
  type SermonRecommendationPage,
  type SermonReprocessRequest,
  type SermonReprocessResponse,
  type SermonResponse,
  type SermonSearchQuery,
  type SermonSeriesCreateRequest,
  type SermonSeriesListQuery,
  type SermonSeriesPage,
  type SermonSeriesResponse,
  type SermonSeriesUpdateRequest,
  type SermonShare,
  type SermonShareCreateRequest,
  type SermonTranscript,
  type SermonTranscriptUpsertRequest,
  type SermonUpdateRequest,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../common/security/decorators';
import { tenantOf, type AuthenticatedPrincipal } from '../../common/security/principal';
import { SermonService } from './sermon.service';

/**
 * Authenticated sermon REST surface.
 *
 * The tenant always comes from the principal. Public permalinks, share tokens
 * and the podcast feed live on `SermonPublicController`.
 */
@Controller('sermons')
export class SermonController {
  constructor(private readonly sermons: SermonService) {}

  @Post('series')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.SERMON_MANAGE)
  createSeries(
    @Body(new ZodValidationPipe(sermonSeriesCreateSchema)) body: SermonSeriesCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonSeriesResponse> {
    return this.sermons.createSeries(tenantOf(principal), body);
  }

  @Get('series')
  @RequirePermissions(Permission.SERMON_READ)
  listSeries(
    @Query(new ZodValidationPipe(sermonSeriesListQuerySchema)) query: SermonSeriesListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonSeriesPage> {
    return this.sermons.listSeries(tenantOf(principal), query);
  }

  @Get('series/:seriesId')
  @RequirePermissions(Permission.SERMON_READ)
  getSeries(
    @Param('seriesId') seriesId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonSeriesResponse> {
    return this.sermons.getSeries(tenantOf(principal), seriesId);
  }

  @Patch('series/:seriesId')
  @RequirePermissions(Permission.SERMON_MANAGE)
  updateSeries(
    @Param('seriesId') seriesId: string,
    @Body(new ZodValidationPipe(sermonSeriesUpdateSchema)) body: SermonSeriesUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonSeriesResponse> {
    return this.sermons.updateSeries(tenantOf(principal), seriesId, body);
  }

  @Delete('series/:seriesId')
  @RequirePermissions(Permission.SERMON_MANAGE)
  archiveSeries(
    @Param('seriesId') seriesId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonSeriesResponse> {
    return this.sermons.archiveSeries(tenantOf(principal), seriesId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.SERMON_MANAGE)
  create(
    @Body(new ZodValidationPipe(sermonCreateSchema)) body: SermonCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonResponse> {
    return this.sermons.create(tenantOf(principal), principal.userId, body);
  }

  @Get()
  @RequirePermissions(Permission.SERMON_READ)
  list(
    @Query(new ZodValidationPipe(sermonListQuerySchema)) query: SermonListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonPage> {
    return this.sermons.list(tenantOf(principal), query);
  }

  @Get('search')
  @RequirePermissions(Permission.SERMON_READ)
  search(
    @Query(new ZodValidationPipe(sermonSearchQuerySchema)) query: SermonSearchQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonPage> {
    return this.sermons.search(tenantOf(principal), query);
  }

  @Get(':sermonId')
  @RequirePermissions(Permission.SERMON_READ)
  get(
    @Param('sermonId') sermonId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonResponse> {
    return this.sermons.get(tenantOf(principal), sermonId);
  }

  @Patch(':sermonId')
  @RequirePermissions(Permission.SERMON_MANAGE)
  update(
    @Param('sermonId') sermonId: string,
    @Body(new ZodValidationPipe(sermonUpdateSchema)) body: SermonUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonResponse> {
    return this.sermons.update(tenantOf(principal), sermonId, body);
  }

  @Post(':sermonId/publish')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.SERMON_PUBLISH)
  publish(
    @Param('sermonId') sermonId: string,
    @Body(new ZodValidationPipe(sermonPublishSchema)) body: SermonPublishRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonResponse> {
    return this.sermons.publish(tenantOf(principal), sermonId, body);
  }

  @Delete(':sermonId')
  @RequirePermissions(Permission.SERMON_MANAGE)
  archive(
    @Param('sermonId') sermonId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonResponse> {
    return this.sermons.archive(tenantOf(principal), principal.userId, sermonId);
  }

  @Post(':sermonId/reprocess')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.SERMON_MANAGE)
  reprocess(
    @Param('sermonId') sermonId: string,
    @Body(new ZodValidationPipe(sermonReprocessSchema)) body: SermonReprocessRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonReprocessResponse> {
    return this.sermons.reprocess(tenantOf(principal), sermonId, body);
  }

  @Post(':sermonId/generate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.SERMON_MANAGE)
  generate(
    @Param('sermonId') sermonId: string,
    @Body(new ZodValidationPipe(sermonGenerateSchema)) body: SermonGenerateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonGenerateResponse> {
    return this.sermons.generate(tenantOf(principal), sermonId, body.kind);
  }

  @Post(':sermonId/transcript')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.SERMON_MANAGE)
  upsertTranscript(
    @Param('sermonId') sermonId: string,
    @Body(new ZodValidationPipe(sermonTranscriptUpsertSchema)) body: SermonTranscriptUpsertRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonTranscript> {
    return this.sermons.upsertTranscript(tenantOf(principal), sermonId, body);
  }

  @Get(':sermonId/jobs')
  @RequirePermissions(Permission.SERMON_READ)
  listJobs(
    @Param('sermonId') sermonId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonJobSummary[]> {
    return this.sermons.listJobs(tenantOf(principal), sermonId);
  }

  @Get(':sermonId/recommendations')
  @RequirePermissions(Permission.SERMON_READ)
  recommendations(
    @Param('sermonId') sermonId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonRecommendationPage> {
    return this.sermons.recommendations(tenantOf(principal), sermonId);
  }

  @Get(':sermonId/notes')
  @RequirePermissions(Permission.SERMON_READ)
  listNotes(
    @Param('sermonId') sermonId: string,
    @Query(new ZodValidationPipe(sermonNoteListQuerySchema)) query: SermonNoteListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonNotePage> {
    return this.sermons.listNotes(tenantOf(principal), principal.userId, sermonId, query);
  }

  @Post(':sermonId/notes')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.SERMON_READ)
  createNote(
    @Param('sermonId') sermonId: string,
    @Body(new ZodValidationPipe(sermonNoteCreateSchema)) body: SermonNoteCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonNote> {
    return this.sermons.createNote(tenantOf(principal), principal.userId, sermonId, body);
  }

  @Patch(':sermonId/notes/:noteId')
  @RequirePermissions(Permission.SERMON_READ)
  updateNote(
    @Param('sermonId') sermonId: string,
    @Param('noteId') noteId: string,
    @Body(new ZodValidationPipe(sermonNoteUpdateSchema)) body: SermonNoteUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonNote> {
    return this.sermons.updateNote(tenantOf(principal), principal.userId, sermonId, noteId, body);
  }

  @Delete(':sermonId/notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(Permission.SERMON_READ)
  deleteNote(
    @Param('sermonId') sermonId: string,
    @Param('noteId') noteId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<void> {
    return this.sermons.deleteNote(tenantOf(principal), principal.userId, sermonId, noteId);
  }

  @Post(':sermonId/shares')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.SERMON_PUBLISH)
  createShare(
    @Param('sermonId') sermonId: string,
    @Body(new ZodValidationPipe(sermonShareCreateSchema)) body: SermonShareCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonShare> {
    return this.sermons.createShare(tenantOf(principal), principal.userId, sermonId, body);
  }

  @Get(':sermonId/shares')
  @RequirePermissions(Permission.SERMON_PUBLISH)
  listShares(
    @Param('sermonId') sermonId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonShare[]> {
    return this.sermons.listShares(tenantOf(principal), sermonId);
  }

  @Delete(':sermonId/shares/:shareId')
  @RequirePermissions(Permission.SERMON_PUBLISH)
  revokeShare(
    @Param('sermonId') sermonId: string,
    @Param('shareId') shareId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<SermonShare> {
    return this.sermons.revokeShare(tenantOf(principal), sermonId, shareId);
  }
}
