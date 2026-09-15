import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import pino, { type Logger } from 'pino';
import { requestContext } from '../context/request-context';

function normalizeContext(context?: unknown): Record<string, unknown> {
  if (context === undefined) return {};
  if (typeof context === 'string') return { context };
  if (context instanceof Error) return { err: context };
  if (typeof context === 'object') return context as Record<string, unknown>;
  return { context: String(context) };
}

@Injectable()
export class AppLogger implements NestLoggerService {
  private readonly logger: Logger;

  constructor(options: { level: string; service: string; enabled?: boolean }) {
    this.logger = pino({
      name: options.service,
      level: options.level,
      enabled: options.enabled ?? true,
      base: { service: options.service },
      formatters: {
        level: (label) => ({ level: label }),
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  private enrich(): Record<string, unknown> {
    const store = requestContext.getStore();
    if (!store) return {};
    return {
      requestId: store.requestId,
      tenantId: store.tenantId,
      userId: store.userId,
    };
  }

  log(message: unknown, context?: unknown): void {
    this.logger.info({ ...normalizeContext(context), ...this.enrich() }, String(message));
  }

  error(message: unknown, stack?: string, context?: unknown): void {
    this.logger.error({ ...normalizeContext(context), ...this.enrich(), stack }, String(message));
  }

  warn(message: unknown, context?: unknown): void {
    this.logger.warn({ ...normalizeContext(context), ...this.enrich() }, String(message));
  }

  debug(message: unknown, context?: unknown): void {
    this.logger.debug({ ...normalizeContext(context), ...this.enrich() }, String(message));
  }

  verbose(message: unknown, context?: unknown): void {
    this.logger.trace({ ...normalizeContext(context), ...this.enrich() }, String(message));
  }

  child(bindings: Record<string, unknown>): Logger {
    return this.logger.child(bindings);
  }
}
