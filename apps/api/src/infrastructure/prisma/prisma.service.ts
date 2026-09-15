import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { AppConfigService } from '../../common/config/app-config.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { requestContext } from '../../common/context/request-context';

export interface TenantScope {
  tenantId?: string | null;
  userId?: string | null;
  isPlatformAdmin?: boolean;
  timeoutMs?: number;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {
    super({
      datasources: { db: { url: config.databaseUrl } },
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    this.$on('warn' as never, (event: Prisma.LogEvent) =>
      this.logger.warn(event.message, 'Prisma'),
    );
    this.$on('error' as never, (event: Prisma.LogEvent) =>
      this.logger.error(event.message, undefined, 'Prisma'),
    );
    await this.$connect();
    this.logger.log('Prisma connection established', 'PrismaService');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async ping(): Promise<number> {
    const startedAt = Date.now();
    await this.$queryRaw`SELECT 1`;
    return Date.now() - startedAt;
  }

  async withScope<T>(
    scope: TenantScope,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const context = requestContext.getStore();
    const tenantId = scope.tenantId ?? context?.tenantId ?? null;
    const userId = scope.userId ?? context?.userId ?? null;
    const isPlatformAdmin = scope.isPlatformAdmin ?? false;

    return this.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId ?? ''}, true)`;
        await tx.$executeRaw`SELECT set_config('app.current_user', ${userId ?? ''}, true)`;
        await tx.$executeRaw`SELECT set_config('app.is_platform_admin', ${isPlatformAdmin ? 'true' : 'false'}, true)`;
        return operation(tx);
      },
      { timeout: scope.timeoutMs ?? 15000 },
    );
  }

  async withTenant<T>(
    tenantId: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.withScope({ tenantId, isPlatformAdmin: false }, operation);
  }

  async withoutScope<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.withScope({ tenantId: null, isPlatformAdmin: true }, operation);
  }
}
