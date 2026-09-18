import { Injectable } from '@nestjs/common';
import type { BrandThemeRequest, BrandThemeResponse } from '@zion8/contracts';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class BrandingService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string): Promise<BrandThemeResponse | null> {
    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.brandTheme.findUnique({ where: { tenantId } }),
    );
    return row ? toResponse(row) : null;
  }

  async save(tenantId: string, input: BrandThemeRequest): Promise<BrandThemeResponse> {
    const data = {
      displayName: input.displayName ?? null,
      tagline: input.tagline ?? null,
      logoUrl: input.logoUrl ?? null,
      faviconUrl: input.faviconUrl ?? null,
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      accentColor: input.accentColor,
      customDomain: input.customDomain ?? null,
      welcomeMessage: input.welcomeMessage ?? null,
    };

    const row = await this.prisma.withTenant(tenantId, (tx) =>
      tx.brandTheme.upsert({
        where: { tenantId },
        create: { tenantId, ...data },
        update: data,
      }),
    );

    return toResponse(row);
  }
}

interface BrandThemeRow {
  tenantId: string;
  displayName: string | null;
  tagline: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  customDomain: string | null;
  welcomeMessage: string | null;
  completedAt: Date;
  updatedAt: Date;
}

function toResponse(row: BrandThemeRow): BrandThemeResponse {
  return {
    tenantId: row.tenantId,
    displayName: row.displayName ?? undefined,
    tagline: row.tagline ?? undefined,
    logoUrl: row.logoUrl ?? undefined,
    faviconUrl: row.faviconUrl ?? undefined,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    accentColor: row.accentColor,
    customDomain: row.customDomain ?? undefined,
    welcomeMessage: row.welcomeMessage ?? undefined,
    completedAt: row.completedAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
