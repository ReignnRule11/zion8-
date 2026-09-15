import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../../common/config/app-config.service';
import { AppLogger } from '../../common/logger/app-logger.service';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;

  constructor(
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {
    this.client = new Redis(this.config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
    });
  }

  get connection(): Redis {
    return this.client;
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    this.client.on('error', (error) => this.logger.error(error.message, undefined, 'Redis'));
    this.logger.log('Redis connection established', 'RedisService');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async ping(): Promise<number> {
    const startedAt = Date.now();
    await this.client.ping();
    return Date.now() - startedAt;
  }

  async incrementWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const results = await this.client.multi().incr(key).expire(key, ttlSeconds).exec();
    const increment = results?.[0]?.[1];
    return typeof increment === 'number' ? increment : Number(increment ?? 1);
  }

  async getNumber(key: string): Promise<number | null> {
    const value = await this.client.get(key);
    return value === null ? null : Number(value);
  }

  async setIfAbsent(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }
}
