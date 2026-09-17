import { Controller, Get, Param, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import type { SermonResponse } from '@zion8/contracts';
import { Public } from '../../common/security/decorators';
import { SermonService } from './sermon.service';

/**
 * Unauthenticated sermon surfaces: a public permalink, a share token, and the
 * podcast RSS feed. Drafts never appear here; only PUBLISHED + PUBLIC sermons
 * (or a live share token) are returned.
 */
@Controller()
export class SermonPublicController {
  constructor(private readonly sermons: SermonService) {}

  @Public()
  @Get('public/sermons/shares/:token')
  share(@Param('token') token: string): Promise<SermonResponse> {
    return this.sermons.resolveShare(token);
  }

  @Public()
  @Get('public/sermons/shares/:token/media')
  async shareMedia(
    @Param('token') token: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.sermons.shareMedia(token);
    response.setHeader('content-type', file.contentType);
    response.setHeader(
      'content-disposition',
      `inline; filename="${encodeURIComponent(file.fileName)}"`,
    );
    return new StreamableFile(file.bytes);
  }

  @Public()
  @Get('public/sermons/:tenantSlug/podcast.xml')
  async podcast(
    @Param('tenantSlug') tenantSlug: string,
    @Res() response: Response,
  ): Promise<void> {
    const xml = await this.sermons.podcastRss(tenantSlug);
    response.type('application/rss+xml; charset=utf-8').send(xml);
  }

  @Public()
  @Get('public/sermons/:tenantSlug/:sermonSlug')
  permalink(
    @Param('tenantSlug') tenantSlug: string,
    @Param('sermonSlug') sermonSlug: string,
  ): Promise<SermonResponse> {
    return this.sermons.publicBySlug(tenantSlug, sermonSlug);
  }

  @Public()
  @Get('public/sermons/:tenantSlug/:sermonSlug/media')
  async permalinkMedia(
    @Param('tenantSlug') tenantSlug: string,
    @Param('sermonSlug') sermonSlug: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.sermons.publicMedia(tenantSlug, sermonSlug);
    response.setHeader('content-type', file.contentType);
    response.setHeader(
      'content-disposition',
      `inline; filename="${encodeURIComponent(file.fileName)}"`,
    );
    return new StreamableFile(file.bytes);
  }
}
