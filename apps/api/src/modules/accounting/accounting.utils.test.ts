import { describe, expect, it } from 'vitest';
import { AccountType } from '@zion8/contracts';
import { nextNumber, normalBalanceOf, signedBalance, toMinor } from './accounting.utils';

describe('accounting utils', () => {
  it('assigns debit normal balance to assets and expenses', () => {
    expect(normalBalanceOf(AccountType.ASSET)).toBe('DEBIT');
    expect(normalBalanceOf(AccountType.EXPENSE)).toBe('DEBIT');
    expect(normalBalanceOf(AccountType.LIABILITY)).toBe('CREDIT');
    expect(normalBalanceOf(AccountType.EQUITY)).toBe('CREDIT');
    expect(normalBalanceOf(AccountType.REVENUE)).toBe('CREDIT');
  });

  it('signs balances toward the account type', () => {
    expect(signedBalance(AccountType.ASSET, 5000, 1000)).toBe(4000);
    expect(signedBalance(AccountType.REVENUE, 1000, 5000)).toBe(4000);
  });

  it('increments journal numbers from a missing max', () => {
    expect(nextNumber(undefined)).toBe(1);
    expect(nextNumber(41)).toBe(42);
  });

  it('rejects money that is not a safe integer', () => {
    expect(() => toMinor(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(toMinor(12n)).toBe(12);
  });
});
