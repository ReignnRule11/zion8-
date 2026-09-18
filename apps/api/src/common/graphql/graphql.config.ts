import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import type { DomainError } from '../errors/domain-error';
import { isDomainError } from '../errors/domain-error';
import type { AppConfigService } from '../config/app-config.service';

/**
 * Apollo wraps a thrown error in its own `GraphQLError` and may nest it more than
 * once, and a workspace can resolve more than one copy of `graphql`, so the
 * wrapped error cannot be recognized with `instanceof`. Walking the
 * `originalError` chain finds the domain error regardless of how it was wrapped.
 */
function findDomainError(error: unknown): DomainError | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 6; depth += 1) {
    if (isDomainError(current)) return current;
    const next = (current as { originalError?: unknown } | null)?.originalError;
    if (!next || next === current) return undefined;
    current = next;
  }
  return undefined;
}

/**
 * GraphQL transport configuration.
 *
 * The API is code-first: the schema is derived from the decorated resolver
 * classes and their types, so the domain stays the single source of truth and
 * the schema cannot fall behind the code. Errors are normalized to the same
 * `code`/`details` shape the REST error envelope uses, so a client can handle a
 * failure identically whichever surface it called.
 */
export function graphqlModuleOptions(config: AppConfigService): ApolloDriverConfig {
  return {
    driver: ApolloDriver,
    path: '/graphql',
    autoSchemaFile: true,
    sortSchema: true,
    playground: false,
    introspection: !config.isProduction,
    // GraphQL must not be swallowed by the global `/api` prefix: clients expect
    // the conventional single endpoint.
    context: ({ req, res }: { req: unknown; res: unknown }) => ({ req, res }),
    formatError: (formatted, error) => {
      const domainError = findDomainError(error);
      if (!domainError) return formatted;
      return {
        ...formatted,
        extensions: {
          ...formatted.extensions,
          code: domainError.code,
          status: domainError.httpStatus,
          details: domainError.details,
        },
      };
    },
  };
}
