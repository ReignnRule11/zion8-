import { MemberImportErrorCode } from '@zion8/contracts';
import { describe, expect, it } from 'vitest';
import { rawRowsFromCsv, rawRowsFromObjects, validateMemberRows } from './member-import.parser';

describe('rawRowsFromCsv', () => {
  it('maps known columns and warns about unknown ones', () => {
    const { raw, warnings } = rawRowsFromCsv(
      'First Name,Last Name,Email,Nickname\nGrace,Owner,grace@example.org,Gracie\n',
    );

    expect(raw).toHaveLength(1);
    expect(raw[0]?.rowNumber).toBe(2);
    expect(raw[0]?.values).toMatchObject({
      first_name: 'Grace',
      last_name: 'Owner',
      email: 'grace@example.org',
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      field: 'nickname',
      code: MemberImportErrorCode.UNKNOWN_COLUMN,
      severity: 'WARNING',
    });
  });

  it('returns nothing for an empty document', () => {
    expect(rawRowsFromCsv('')).toEqual({ raw: [], warnings: [] });
  });
});

describe('rawRowsFromObjects', () => {
  it('normalizes keys and stringifies values', () => {
    const { raw } = rawRowsFromObjects([{ First_Name: 'Ada', 'last-name': 'Lovelace', age: 36 }]);
    expect(raw[0]?.rowNumber).toBe(1);
    expect(raw[0]?.values).toEqual({ first_name: 'Ada', last_name: 'Lovelace' });
  });
});

describe('validateMemberRows', () => {
  function row(rowNumber: number, values: Record<string, string>) {
    return { rowNumber, values };
  }

  it('accepts a fully valid row and defaults the role to MEMBER', () => {
    const result = validateMemberRows([row(2, { first_name: 'Grace', last_name: 'Owner' })]);
    expect(result.counts).toEqual({ total: 1, valid: 1, invalid: 0 });
    expect(result.rows[0]).toMatchObject({
      firstName: 'Grace',
      lastName: 'Owner',
      role: 'MEMBER',
    });
  });

  it('reports each invalid field on a row with a specific code', () => {
    const result = validateMemberRows([
      row(2, { first_name: '', last_name: 'Owner', email: 'not-an-email' }),
    ]);
    expect(result.counts).toEqual({ total: 1, valid: 0, invalid: 1 });
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain(MemberImportErrorCode.INVALID_EMAIL);
    expect(result.issues.every((issue) => issue.severity === 'ERROR')).toBe(true);
  });

  it('rejects a duplicate email within the same file', () => {
    const result = validateMemberRows([
      row(2, { first_name: 'A', last_name: 'One', email: 'dup@example.org' }),
      row(3, { first_name: 'B', last_name: 'Two', email: 'DUP@example.org' }),
    ]);
    expect(result.counts.valid).toBe(1);
    expect(result.issues[0]?.code).toBe(MemberImportErrorCode.DUPLICATE_IN_FILE);
  });

  it('warns when an email already belongs to a member instead of failing', () => {
    const result = validateMemberRows(
      [row(2, { first_name: 'A', last_name: 'One', email: 'known@example.org' })],
      { existingEmails: new Set(['known@example.org']) },
    );
    expect(result.counts.valid).toBe(1);
    expect(result.issues[0]).toMatchObject({
      code: MemberImportErrorCode.ALREADY_MEMBER,
      severity: 'WARNING',
    });
  });

  it('rejects a role that cannot be imported', () => {
    const result = validateMemberRows([
      row(2, { first_name: 'A', last_name: 'One', role: 'CHURCH_OWNER' }),
    ]);
    expect(result.counts.valid).toBe(0);
    expect(result.issues[0]).toMatchObject({
      field: 'role',
      code: MemberImportErrorCode.INVALID_ROLE,
      severity: 'ERROR',
    });
  });

  it('keeps importing valid rows when other rows are invalid', () => {
    const result = validateMemberRows([
      row(2, { first_name: 'Good', last_name: 'Row' }),
      row(3, { first_name: '', last_name: '' }),
      row(4, { first_name: 'Another', last_name: 'Good' }),
    ]);
    expect(result.counts).toEqual({ total: 3, valid: 2, invalid: 1 });
  });

  it('parses date-only join dates into ISO instants', () => {
    const result = validateMemberRows([
      row(2, { first_name: 'A', last_name: 'One', joined_at: '2024-03-01' }),
    ]);
    expect(result.rows[0]?.joinedAt).toBe('2024-03-01T00:00:00.000Z');
  });
});
