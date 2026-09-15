import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerChurchSchema,
  switchTenantSchema,
  type LoginRequest,
  type MeResponse,
  type RefreshRequest,
  type RegisterChurchRequest,
  type Session,
  type SwitchTenantRequest,
  type LogoutRequest,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/security/decorators';
import { CurrentPrincipal } from '../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../common/security/principal';
import { AuthService, type RequestMetadata } from './auth.service';

function metadataOf(request: Request): RequestMetadata {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.header('user-agent') ?? null,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register-church')
  @HttpCode(HttpStatus.CREATED)
  registerChurch(
    @Body(new ZodValidationPipe(registerChurchSchema)) body: RegisterChurchRequest,
    @Req() request: Request,
  ): Promise<Session> {
    return this.auth.registerChurch(body, metadataOf(request));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginRequest,
    @Req() request: Request,
  ): Promise<Session> {
    return this.auth.login(body, metadataOf(request));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: RefreshRequest,
    @Req() request: Request,
  ): Promise<Session> {
    return this.auth.refresh(body, metadataOf(request));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body(new ZodValidationPipe(logoutSchema)) body: LogoutRequest,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.logout(body, metadataOf(request));
  }

  @Post('switch-tenant')
  @HttpCode(HttpStatus.OK)
  switchTenant(
    @Body(new ZodValidationPipe(switchTenantSchema)) body: SwitchTenantRequest,
    @Req() request: Request,
  ): Promise<Session> {
    return this.auth.switchTenant(body, metadataOf(request));
  }

  @Get('me')
  me(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<MeResponse> {
    return this.auth.me(principal.userId, principal.tenantId);
  }
}
