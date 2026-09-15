import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  mfaConfirmTotpSchema,
  mfaDisableSchema,
  mfaRegenerateRecoveryCodesSchema,
  totpEnrollmentRequestSchema,
  type MfaConfirmResponse,
  type MfaConfirmTotpRequest,
  type MfaDisableRequest,
  type MfaFactorListResponse,
  type MfaRecoveryCodesResponse,
  type MfaRegenerateRecoveryCodesRequest,
  type TotpEnrollmentRequest,
  type TotpEnrollmentResponse,
} from '@zion8/contracts';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentPrincipal } from '../../common/security/decorators';
import type { AuthenticatedPrincipal } from '../../common/security/principal';
import { AuthService } from './auth.service';
import { requestMetadata } from './request-metadata';

@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly auth: AuthService) {}

  @Get('factors')
  async list(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<MfaFactorListResponse> {
    const { factors, recoveryCodesRemaining } = await this.auth.listFactors(principal.userId);
    return {
      factors: factors.map((factor) => ({
        id: factor.id,
        type: factor.type,
        status: factor.status,
        name: factor.name,
        confirmedAt: factor.confirmedAt ? factor.confirmedAt.toISOString() : null,
        lastUsedAt: factor.lastUsedAt ? factor.lastUsedAt.toISOString() : null,
        createdAt: factor.createdAt.toISOString(),
      })),
      recoveryCodesRemaining,
    };
  }

  @Post('totp')
  @HttpCode(HttpStatus.CREATED)
  enrollTotp(
    @Body(new ZodValidationPipe(totpEnrollmentRequestSchema)) body: TotpEnrollmentRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<TotpEnrollmentResponse> {
    return this.auth
      .enrollTotp(principal.userId, body.name)
      .then((enrollment) => ({ type: 'TOTP' as const, ...enrollment }));
  }

  @Post('totp/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmTotp(
    @Body(new ZodValidationPipe(mfaConfirmTotpSchema)) body: MfaConfirmTotpRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<MfaConfirmResponse> {
    const result = await this.auth.confirmTotp(
      principal.userId,
      body.factorId,
      body.code,
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

  @Post('recovery-codes')
  @HttpCode(HttpStatus.OK)
  async regenerateRecoveryCodes(
    @Body(new ZodValidationPipe(mfaRegenerateRecoveryCodesSchema))
    body: MfaRegenerateRecoveryCodesRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<MfaRecoveryCodesResponse> {
    const recoveryCodes = await this.auth.regenerateRecoveryCodes(
      principal.userId,
      body.password,
      requestMetadata(request),
    );
    return { recoveryCodes };
  }

  @Delete('factors/:factorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disable(
    @Param(new ZodValidationPipe(mfaDisableSchema)) params: MfaDisableRequest,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Req() request: Request,
  ): Promise<void> {
    await this.auth.disableMfaFactor(principal.userId, params.factorId, requestMetadata(request));
  }
}
