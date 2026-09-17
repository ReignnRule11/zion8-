/**
 * A small, strict CSV reader sufficient for the member import.
 *
 * It follows RFC 4180 closely enough to be predictable: comma separated,
 * double-quote quoting, `""` for a literal quote, and CRLF or LF line endings.
 * A BOM is stripped. Rather than smuggling in a dependency with its own
 * opinions about edge cases, the parser is deliberately narrow and unit tested,
 * so the behaviour the import depends on is the behaviour we wrote.
 */

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

export class CsvParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
    this.name = 'CsvParseError';
  }
}

export function parseCsv(input: string): ParsedCsv {
  const text = input.replace(/^\uFEFF/u, '');
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let quoteStartLine = 1;
  let index = 0;

  const pushField = (): void => {
    record.push(field);
    field = '';
  };

  const pushRecord = (): void => {
    pushField();
    records.push(record);
    record = [];
  };

  while (index < text.length) {
    const char = text[index] as string;

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      if (char === '\n') line += 1;
      field += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      if (field.length > 0) {
        throw new CsvParseError('Unexpected quote inside an unquoted field', line);
      }
      inQuotes = true;
      quoteStartLine = line;
      index += 1;
      continue;
    }

    if (char === ',') {
      pushField();
      index += 1;
      continue;
    }

    if (char === '\r' || char === '\n') {
      pushRecord();
      line += 1;
      index += char === '\r' && text[index + 1] === '\n' ? 2 : 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (inQuotes) {
    throw new CsvParseError('Unterminated quoted field', quoteStartLine);
  }

  if (field.length > 0 || record.length > 0) {
    pushRecord();
  }

  const nonEmpty = records.filter((row) => row.some((value) => value.trim() !== ''));
  const [headerRow, ...dataRows] = nonEmpty;
  if (!headerRow) return { headers: [], rows: [] };

  const headers = headerRow.map((header) => normalizeHeader(header));

  return {
    headers,
    rows: dataRows.map((row) => headers.map((_, column) => row[column] ?? '')),
  };
}

export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/u, '')
    .replace(/[\s-]+/gu, '_');
}
