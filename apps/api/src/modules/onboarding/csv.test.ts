import { describe, expect, it } from 'vitest';
import { CsvParseError, normalizeHeader, parseCsv } from './csv';

describe('parseCsv', () => {
  it('parses a simple document into normalized headers and rows', () => {
    const parsed = parseCsv('First Name,Last Email\nGrace,grace@example.org\n');
    expect(parsed.headers).toEqual(['first_name', 'last_email']);
    expect(parsed.rows).toEqual([['Grace', 'grace@example.org']]);
  });

  it('supports quoted fields containing commas and escaped quotes', () => {
    const parsed = parseCsv('name,note\n"Doe, Jane","She said ""hello"""');
    expect(parsed.rows).toEqual([['Doe, Jane', 'She said "hello"']]);
  });

  it('handles CRLF endings and a trailing record without a newline', () => {
    const parsed = parseCsv('a,b\r\n1,2\r\n3,4');
    expect(parsed.headers).toEqual(['a', 'b']);
    expect(parsed.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('strips a UTF-8 BOM from the first header', () => {
    const parsed = parseCsv('\uFEFFemail,name\nx@y.z,X');
    expect(parsed.headers).toEqual(['email', 'name']);
  });

  it('skips blank lines and pads short rows', () => {
    const parsed = parseCsv('a,b,c\n1,2\n\n3,4,5\n');
    expect(parsed.rows).toEqual([
      ['1', '2', ''],
      ['3', '4', '5'],
    ]);
  });

  it('preserves newlines inside quoted fields', () => {
    const parsed = parseCsv('note\n"line one\nline two"');
    expect(parsed.rows).toEqual([['line one\nline two']]);
  });

  it('returns empty headers and rows for blank input', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] });
    expect(parseCsv('\n\n')).toEqual({ headers: [], rows: [] });
  });

  it('rejects an unterminated quoted field', () => {
    expect(() => parseCsv('a\n"unterminated')).toThrow(CsvParseError);
  });

  it('rejects a quote in the middle of an unquoted field', () => {
    expect(() => parseCsv('a\nab"cd')).toThrow(CsvParseError);
  });
});

describe('normalizeHeader', () => {
  it('lowercases, trims, and turns spaces or dashes into underscores', () => {
    expect(normalizeHeader('  First Name ')).toBe('first_name');
    expect(normalizeHeader('Joined-At')).toBe('joined_at');
    expect(normalizeHeader('\uFEFFEmail')).toBe('email');
  });
});
