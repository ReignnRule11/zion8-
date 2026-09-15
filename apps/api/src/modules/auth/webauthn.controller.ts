import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  webauthnAuthenticationOptionsRequestSchema,
  webauthnAuthenticationVerifySchema,
  webauthnRegistrationOptionsRequestSchema,
  webauthnRegistrationVerifySchema,
  type LoginResult,
  type MfaConfirmResponse,
  type WebAuthnAuthenticationOptionsRequest,
  type WebAuthnAuthenticationOptionsResponse,
  type WebAuthnAuthenticationVerifyRequest,
  type WebAuthnRegistrationOptionsRequest,
  type WebAuthnRegistrationOptionsResponse,
  type WebAuthnRegistrationVerifyRequest,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal, Public } from '../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../common/security/principal';
import { AuthService } from './auth.service';
import { requestMetadata } from './request-metadata';

@Controller('auth/webauthn')
export class WebAuthnController {
  constructor(private readonly auth: AuthService) {}

  @Post('registration/options')
  @HttpCode(HttpStatus.OK)
  async registrationOptions(
    @Body(new ZodValidationPipe(webauthnRegistrationOptionsRequestSchema))
    body: WebAuthnRegistrationOptionsRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<WebAuthnRegistrationOptionsResponse> {
    const result = await this.auth.startWebAuthnRegistration(principal.userId, body.name);
    return {
      challengeId: result.challengeId,
      factorId: result.factorId,
      options: result.options as unknown as Record<string, unknown>,
    };
  }

  @Post('registration/verify')
  @HttpCode(HttpStatus.CREATED)
  async registrationVerify(
    @Body(new ZodValidationPipe(webauthnRegistrationVerifySchema))
    body: WebAuthnRegistrationVerifyRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<MfaConfirmResponse> {
    const result = await this.auth.finishWebAuthnRegistration(
      principal.userId,
      {
        challengeId: body.challengeId,
        factorId: body.factorId,
        name: body.name,
        response: body.response as never,
      },
      requestMetadata(request),
    );
    const { factor } = result;
    return {
      factor: {
        id: factor.id,
        type: factor.type,
        status: factor.status,
        name: factor.name,
        confirmedAt: factor.confirmedAt ? factor.confirmedAt.toISOString() : null,
        lastUsedAt: factor.lastUsedAt ? factor.lastUsedAt.toISOString() : null,
        createdAt: factor.createdAt.toISOString(),
      },
      recoveryCodes: result.recoveryCodes,
    };
  }

  @Public()
  @Post('authentication/options')
  @HttpCode(HttpStatus.OK)
  async authenticationOptions(
    @Body(new ZodValidationPipe(webauthnAuthenticationOptionsRequestSchema))
    body: WebAuthnAuthenticationOptionsRequest,
  ): Promise<WebAuthnAuthenticationOptionsResponse> {
    const result = await this.auth.startWebAuthnAuthentication(body);
    return {
      challengeId: result.challengeId,
      options: result.options as unknown as Record<string, unknown>,
    };
  }

  @Public()
  @Post('authentication/verify')
  @HttpCode(HttpStatus.OK)
  authenticationVerify(
    @Body(new ZodValidationPipe(webauthnAuthenticationVerifySchema))
    body: WebAuthnAuthenticationVerifyRequest,
    @Req() request: Request,
  ): Promise<LoginResult> {
    return this.auth.loginWithWebAuthn(
      { challengeId: body.challengeId, response: body.response as never },
      requestMetadata(request),
    );
  }
}
