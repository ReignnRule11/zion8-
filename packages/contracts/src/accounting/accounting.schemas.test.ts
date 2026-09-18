import { describe, expect, it } from 'vitest';
import { accountCreateSchema, DEFAULT_CHART_ACCOUNTS } from './account.schemas';
import { AccountType } from './enums';
import { contributionCreateSchema } from './giving.schemas';
import { journalCreateSchema } from './journal.schemas';
import { expenseCreateSchema, expenseDecisionSchema } from './procurement.schemas';
import { reportQuerySchema } from './report.schemas';

describe('chart of accounts contract', () => {
  it('ships a balanced default chart covering every account type', () => {
    const types = new Set(DEFAULT_CHART_ACCOUNTS.map((account) => account.type));
    expect(types).toEqual(
      new Set([
        AccountType.ASSET,
        AccountType.LIABILITY,
        AccountType.EQUITY,
        AccountType.REVENUE,
        AccountType.EXPENSE,
      ]),
    );
    expect(DEFAULT_CHART_ACCOUNTS.every((account) => account.code.length >= 3)).toBe(true);
  });

  it('rejects an empty account name', () => {
    expect(accountCreateSchema.safeParse({ code: '1000', name: ' ', type: 'ASSET' }).success).toBe(
      false,
    );
  });
});

describe('journal contract', () => {
  const accountA = '11111111-1111-4111-8111-111111111111';
  const accountB = '22222222-2222-4222-8222-222222222222';

  it('accepts a balanced two-line journal', () => {
    const parsed = journalCreateSchema.parse({
      memo: 'Sunday offering',
      occurredOn: '2026-09-14',
      lines: [
        { accountId: accountA, debitMinor: 5000, creditMinor: 0 },
        { accountId: accountB, debitMinor: 0, creditMinor: 5000 },
      ],
    });
    expect(parsed.source).toBe('MANUAL');
  });

  it('rejects an unbalanced journal', () => {
    expect(
      journalCreateSchema.safeParse({
        memo: 'Broken',
        occurredOn: '2026-09-14',
        lines: [
          { accountId: accountA, debitMinor: 5000, creditMinor: 0 },
          { accountId: accountB, debitMinor: 0, creditMinor: 4000 },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects a line that both debits and credits', () => {
    expect(
      journalCreateSchema.safeParse({
        memo: 'Broken',
        occurredOn: '2026-09-14',
        lines: [
          { accountId: accountA, debitMinor: 2500, creditMinor: 2500 },
          { accountId: accountB, debitMinor: 0, creditMinor: 0 },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('giving and expense contracts', () => {
  const fundId = '33333333-3333-4333-8333-333333333333';
  const accountId = '44444444-4444-4444-8444-444444444444';

  it('defaults contribution currency, method and tax flag', () => {
    const parsed = contributionCreateSchema.parse({
      fundId,
      amountMinor: 2500,
      receivedOn: '2026-09-14',
    });
    expect(parsed.currency).toBe('USD');
    expect(parsed.method).toBe('CASH');
    expect(parsed.taxDeductible).toBe(true);
  });

  it('rejects a zero contribution', () => {
    expect(
      contributionCreateSchema.safeParse({
        fundId,
        amountMinor: 0,
        receivedOn: '2026-09-14',
      }).success,
    ).toBe(false);
  });

  it('requires a memo on an expense', () => {
    expect(
      expenseCreateSchema.safeParse({
        incurredOn: '2026-09-14',
        amountMinor: 1200,
        expenseAccountId: accountId,
        memo: '',
      }).success,
    ).toBe(false);
  });

  it('accepts an approval decision', () => {
    const parsed = expenseDecisionSchema.parse({ decision: 'APPROVED' });
    expect(parsed.decision).toBe('APPROVED');
  });
});

describe('report query contract', () => {
  it('requires a known report kind', () => {
    expect(reportQuerySchema.safeParse({ kind: 'TRIAL_BALANCE' }).success).toBe(true);
    expect(reportQuerySchema.safeParse({ kind: 'UNKNOWN' }).success).toBe(false);
  });
});
