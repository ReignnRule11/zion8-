import { Controller, Get } from '@nestjs/common';
import type { DependencyHealth, Liveness, Readiness } from '@zion8/contracts';
import { Public } from '../../common/security/decorators';
import { AppConfigService } from '../../common/config/app-config.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
  ) {}

  @Public()
  @Get('live')
  live(): Liveness {
    return {
      status: 'ok',
      version: this.version,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('ready')
  async ready(): Promise<Readiness> {
    const dependencies: DependencyHealth[] = [];

    try {
      const latencyMs = await this.prisma.ping();
      dependencies.push({ name: 'postgres', status: 'up', latencyMs });
    } catch (error) {
      dependencies.push({
        name: 'postgres',
        status: 'down',
        message: error instanceof Error ? error.message : 'unreachable',
      });
    }

    try {
      const latencyMs = await this.redis.ping();
      dependencies.push({ name: 'redis', status: 'up', latencyMs });
    } catch (error) {
      dependencies.push({
        name: 'redis',
        status: 'down',
        message: error instanceof Error ? error.message : 'unreachable',
      });
    }

    const postgresDown = dependencies.some(
      (dependency) => dependency.name === 'postgres' && dependency.status === 'down',
    );
    const redisDown = dependencies.some(
      (dependency) => dependency.name === 'redis' && dependency.status === 'down',
    );

    const status: Readiness['status'] = postgresDown ? 'down' : redisDown ? 'degraded' : 'ok';

    return {
      status,
      version: this.version,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      dependencies,
    };
  }

  private get version(): string {
    return process.env.npm_package_version ?? '0.0.0';
  }
}
