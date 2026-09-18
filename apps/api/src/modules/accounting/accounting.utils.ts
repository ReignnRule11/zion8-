import { AccountType, type PaginationQuery } from '@zion8/contracts';
import { DomainError } from '../../common/errors/domain-error';

export { tenantOf } from '../../common/security/principal';

export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function toDateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function requiredDate(value: string): Date {
  const parsed = parseDateOnly(value);
  if (!parsed) throw DomainError.validation([{ path: 'date', message: 'A date is required' }]);
  return parsed;
}

export function pageArgs(query: PaginationQuery): { skip: number; take: number } {
  return { skip: query.offset, take: query.limit };
}

export function toMinor(value: bigint | number): number {
  const numeric = typeof value === 'bigint' ? Number(value) : value;
  if (!Number.isSafeInteger(numeric)) {
    throw DomainError.internal('A money amount exceeded the safe integer range');
  }
  return numeric;
}

export function toBigInt(value: number): bigint {
  return BigInt(value);
}

export function normalBalanceOf(type: AccountType): 'DEBIT' | 'CREDIT' {
  return type === AccountType.ASSET || type === AccountType.EXPENSE ? 'DEBIT' : 'CREDIT';
}

export function signedBalance(
  type: AccountType,
  debitMinor: number,
  creditMinor: number,
): number {
  return type === AccountType.ASSET || type === AccountType.EXPENSE
    ? debitMinor - creditMinor
    : creditMinor - debitMinor;
}

export function nextNumber(max: number | null | undefined): number {
  return (max ?? 0) + 1;
}
