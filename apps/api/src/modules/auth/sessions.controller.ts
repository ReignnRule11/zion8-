import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  revokeSessionSchema,
  type RevokeSessionRequest,
  type SessionListResponse,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal } from '../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../common/security/principal';
import { AuthService } from './auth.service';
import { requestMetadata } from './request-metadata';

@Controller('auth/sessions')
export class SessionsController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  async list(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<SessionListResponse> {
    const sessions = await this.auth.listSessions(principal.userId, principal.sessionId);
    return { sessions };
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @Param(new ZodValidationPipe(revokeSessionSchema)) params: RevokeSessionRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.revokeSession(principal.userId, params.sessionId, requestMetadata(request));
  }
}
