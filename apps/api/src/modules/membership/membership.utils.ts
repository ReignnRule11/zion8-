import type { PaginationQuery } from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';
import type { AuthenticatedPrincipal } from '../../common/security/principal';

/**
 * The tenant is never read from the request. It is taken from the authenticated
 * principal so that every membership read and write runs under the row-level
 * security policy of the caller's church, on both the REST and GraphQL surfaces.
 */
export function tenantOf(principal: AuthenticatedPrincipal): string {
  if (!principal.tenantId) throw DomainError.tenantRequired();
  return principal.tenantId;
}

/** Serialize a `DateTime` to an ISO instant, preserving null. */
export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/** Serialize a `DATE` column (`YYYY-MM-DD`) without dragging in a time zone. */
export function toDateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/**
 * Parse a date-only string into a UTC midnight `Date`. Storing a birthday or a
 * join date as an instant would let it drift across time zones; anchoring at
 * UTC midnight keeps the calendar day the user typed.
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(value);
}

export function requiredDate(value: string): Date {
  return new Date(value);
}

export function fullName(parts: {
  firstName: string;
  middleName?: string | null;
  lastName?: string | null;
}): string {
  return [parts.firstName, parts.middleName, parts.lastName]
    .filter((part): part is string => Boolean(part && part.trim().length > 0))
    .join(' ');
}

export function pageArgs(query: PaginationQuery): { skip: number; take: number } {
  return { skip: query.offset, take: query.limit };
}

/** Human-readable label for a member, preferring a chosen name when present. */
export function displayName(parts: {
  firstName: string;
  preferredName?: string | null;
  lastName: string;
}): string {
  const first = parts.preferredName?.trim() || parts.firstName;
  return `${first} ${parts.lastName}`.trim();
}
