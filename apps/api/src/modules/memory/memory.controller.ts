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
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  Permission,
  memoryArtifactCreateSchema,
  memoryArtifactLinkSchema,
  memoryArtifactListQuerySchema,
  memoryArtifactUpdateSchema,
  memoryReprocessSchema,
  memoryVersionQuerySchema,
  type MemoryArtifactCreateRequest,
  type MemoryArtifactDownload,
  type MemoryArtifactLinkRequest,
  type MemoryArtifactListQuery,
  type MemoryArtifactPage,
  type MemoryArtifactResponse,
  type MemoryArtifactUpdateRequest,
  type MemoryJobSummary,
  type MemoryReprocessRequest,
  type MemoryReprocessResponse,
  type MemoryVersionQuery,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, RequirePermissions } from '../../common/security/decorators';
import { tenantOf, type AuthenticatedPrincipal } from '../../common/security/principal';
import { ArtifactService } from './artifact.service';

/**
 * Memory REST surface.
 *
 * Binary content is carried on REST only; the GraphQL surface (added with the
 * retrieval phase) will expose metadata and download handles, never bytes. The
 * tenant always comes from the authenticated principal, never from the request.
 */
@Controller('memory')
export class MemoryController {
  constructor(private readonly artifacts: ArtifactService) {}

  @Post('artifacts')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.MEMORY_INGEST)
  create(
    @Body(new ZodValidationPipe(memoryArtifactCreateSchema)) body: MemoryArtifactCreateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemoryArtifactResponse> {
    return this.artifacts.create(tenantOf(principal), principal.userId, body);
  }

  @Get('artifacts')
  @RequirePermissions(Permission.MEMORY_READ)
  list(
    @Query(new ZodValidationPipe(memoryArtifactListQuerySchema)) query: MemoryArtifactListQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemoryArtifactPage> {
    return this.artifacts.list(tenantOf(principal), query);
  }

  @Get('artifacts/:artifactId')
  @RequirePermissions(Permission.MEMORY_READ)
  get(
    @Param('artifactId') artifactId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemoryArtifactResponse> {
    return this.artifacts.get(tenantOf(principal), artifactId);
  }

  @Patch('artifacts/:artifactId')
  @RequirePermissions(Permission.MEMORY_CURATE)
  update(
    @Param('artifactId') artifactId: string,
    @Body(new ZodValidationPipe(memoryArtifactUpdateSchema)) body: MemoryArtifactUpdateRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemoryArtifactResponse> {
    return this.artifacts.update(tenantOf(principal), artifactId, body);
  }

  @Delete('artifacts/:artifactId')
  @RequirePermissions(Permission.MEMORY_CURATE)
  archive(
    @Param('artifactId') artifactId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemoryArtifactResponse> {
    return this.artifacts.archive(tenantOf(principal), artifactId, principal.userId);
  }

  @Post('artifacts/:artifactId/links')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.MEMORY_CURATE)
  addLink(
    @Param('artifactId') artifactId: string,
    @Body(new ZodValidationPipe(memoryArtifactLinkSchema)) body: MemoryArtifactLinkRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemoryArtifactResponse> {
    return this.artifacts.addLink(tenantOf(principal), principal.userId, artifactId, body);
  }

  @Delete('artifacts/:artifactId/links/:linkId')
  @RequirePermissions(Permission.MEMORY_CURATE)
  removeLink(
    @Param('artifactId') artifactId: string,
    @Param('linkId') linkId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemoryArtifactResponse> {
    return this.artifacts.removeLink(tenantOf(principal), artifactId, linkId);
  }

  @Post('artifacts/:artifactId/reprocess')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.MEMORY_CURATE)
  reprocess(
    @Param('artifactId') artifactId: string,
    @Body(new ZodValidationPipe(memoryReprocessSchema)) body: MemoryReprocessRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemoryReprocessResponse> {
    return this.artifacts.reprocess(tenantOf(principal), artifactId, body);
  }

  @Get('artifacts/:artifactId/jobs')
  @RequirePermissions(Permission.MEMORY_READ)
  listJobs(
    @Param('artifactId') artifactId: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemoryJobSummary[]> {
    return this.artifacts.listJobs(tenantOf(principal), artifactId);
  }

  @Get('artifacts/:artifactId/download')
  @RequirePermissions(Permission.MEMORY_READ)
  download(
    @Param('artifactId') artifactId: string,
    @Query(new ZodValidationPipe(memoryVersionQuerySchema)) query: MemoryVersionQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<MemoryArtifactDownload> {
    return this.artifacts.download(tenantOf(principal), artifactId, query.versionId);
  }

  @Get('artifacts/:artifactId/content')
  @RequirePermissions(Permission.MEMORY_READ)
  async content(
    @Param('artifactId') artifactId: string,
    @Query(new ZodValidationPipe(memoryVersionQuerySchema)) query: MemoryVersionQuery,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.artifacts.content(tenantOf(principal), artifactId, query.versionId);
    response.setHeader('content-type', file.contentType);
    response.setHeader(
      'content-disposition',
      `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    );
    return new StreamableFile(file.bytes);
  }
}
