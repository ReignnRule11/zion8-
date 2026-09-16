import { describe, expect, it } from 'vitest';
import { GraphQLError } from 'graphql';
import { ErrorCode } from '@zion8/contracts';
import { DomainError } from '../errors/domain-error';
import { graphqlModuleOptions } from './graphql.config';
import type { AppConfigService } from '../config/app-config.service';

const options = graphqlModuleOptions({ isProduction: false } as AppConfigService);

function format(error: unknown): {
  extensions?: Record<string, unknown>;
} {
  const formatted = { message: 'boom', path: ['field'] };
  return options.formatError!(formatted, error) as { extensions?: Record<string, unknown> };
}

describe('graphql error formatting', () => {
  it('maps a domain error wrapped in a GraphQL error to the shared error envelope', () => {
    const domain = new DomainError(ErrorCode.MEMBER_NOT_FOUND, 'That member could not be found');
    const wrapped = new GraphQLError('That member could not be found', { originalError: domain });
    expect(format(wrapped).extensions).toMatchObject({
      code: ErrorCode.MEMBER_NOT_FOUND,
      status: 404,
    });
  });

  it('maps a nested wrapper around a domain error', () => {
    const domain = new DomainError(ErrorCode.VALIDATION_FAILED, 'Request validation failed');
    const inner = new GraphQLError('inner', { originalError: domain });
    const outer = new GraphQLError('outer', { originalError: inner });
    expect(format(outer).extensions?.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('leaves an unexpected error untouched', () => {
    expect(format(new Error('database exploded')).extensions).toBeUndefined();
  });
});
