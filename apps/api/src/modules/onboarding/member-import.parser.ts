import {
  MEMBER_IMPORT_COLUMNS,
  MemberImportErrorCode,
  memberImportRoleSchema,
  memberImportRowSchema,
  type MemberImportIssue,
  type MemberImportRow,
} from '@zion8/contracts';
import { parseCsv } from './csv';

/**
 * Turns a CSV document (or an array of already-structured rows) into validated,
 * importable members plus a precise list of the problems found.
 *
 * Validation is deliberately total: every row is reported on, and a problem in
 * one row never prevents the others from importing. Callers get back both the
 * importable rows and the issues, so the UI can show a review table before
 * anything is written.
 */

export interface RawMemberRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface ValidatedImport {
  rows: MemberImportRow[];
  issues: MemberImportIssue[];
  counts: { total: number; valid: number; invalid: number };
}

const KNOWN_COLUMNS = new Set<string>(MEMBER_IMPORT_COLUMNS);

export function rawRowsFromCsv(csv: string): { raw: RawMemberRow[]; warnings: MemberImportIssue[] } {
  const parsed = parseCsv(csv);
  if (parsed.headers.length === 0) return { raw: [], warnings: [] };

  const warnings: MemberImportIssue[] = [];
  for (const header of parsed.headers) {
    if (header !== '' && !KNOWN_COLUMNS.has(header)) {
      warnings.push({
        row: 1,
        field: header,
        code: MemberImportErrorCode.UNKNOWN_COLUMN,
        message: `Column "${header}" is not recognised and will be ignored.`,
        severity: 'WARNING',
      });
    }
  }

  const raw = parsed.rows.map((values, index) => {
    const record: Record<string, string> = {};
    parsed.headers.forEach((header, column) => {
      if (KNOWN_COLUMNS.has(header)) record[header] = values[column] ?? '';
    });
    return { rowNumber: index + 2, values: record };
  });

  return { raw, warnings };
}

export function rawRowsFromObjects(rows: unknown[]): { raw: RawMemberRow[]; warnings: MemberImportIssue[] } {
  const raw = rows.map((row, index) => {
    const values: Record<string, string> = {};
    if (typeof row === 'object' && row !== null) {
      for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
        const normalized = key
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/gu, '_');
        if (KNOWN_COLUMNS.has(normalized)) {
          values[normalized] = value === null || value === undefined ? '' : String(value);
        }
      }
    }
    return { rowNumber: index + 1, values };
  });

  return { raw, warnings: [] };
}

export function validateMemberRows(
  raw: RawMemberRow[],
  options: { existingEmails: ReadonlySet<string> } = { existingEmails: new Set() },
): ValidatedImport {
  const rows: MemberImportRow[] = [];
  const issues: MemberImportIssue[] = [];
  const seenEmails = new Set<string>();
  let invalid = 0;

  for (const entry of raw) {
    const candidate = {
      firstName: value(entry, 'first_name'),
      lastName: value(entry, 'last_name'),
      email: optional(value(entry, 'email'))?.toLowerCase(),
      phone: optional(value(entry, 'phone')),
      role: optional(value(entry, 'role'))?.toUpperCase() ?? 'MEMBER',
      joinedAt: parseJoinedAt(optional(value(entry, 'joined_at'))),
    };

    const roleIssue = validateRole(candidate.role);
    const parsed = memberImportRowSchema.safeParse(candidate);

    if (roleIssue) {
      invalid += 1;
      issues.push({ row: entry.rowNumber, field: 'role', severity: 'ERROR', ...roleIssue });
      continue;
    }

    if (!parsed.success) {
      invalid += 1;
      for (const issue of parsed.error.issues) {
        const field = issue.path.length > 0 ? issue.path.join('.') : null;
        issues.push({
          row: entry.rowNumber,
          field,
          code: codeForField(field),
          message: messageForField(field, issue.message),
          severity: 'ERROR',
        });
      }
      continue;
    }

    const member = parsed.data;
    if (member.email) {
      if (seenEmails.has(member.email)) {
        invalid += 1;
        issues.push({
          row: entry.rowNumber,
          field: 'email',
          code: MemberImportErrorCode.DUPLICATE_IN_FILE,
          message: `${member.email} appears more than once in this file.`,
          severity: 'ERROR',
        });
        continue;
      }
      seenEmails.add(member.email);

      if (options.existingEmails.has(member.email)) {
        issues.push({
          row: entry.rowNumber,
          field: 'email',
          code: MemberImportErrorCode.ALREADY_MEMBER,
          message: `${member.email} already has an account and will be linked instead of created.`,
          severity: 'WARNING',
        });
      }
    }

    rows.push(member);
  }

  return {
    rows,
    issues,
    counts: { total: raw.length, valid: rows.length, invalid },
  };
}

function value(entry: RawMemberRow, key: string): string | undefined {
  const raw = entry.values[key];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

function optional(input: string | undefined): string | undefined {
  return input === undefined || input === '' ? undefined : input;
}

function validateRole(role: string): { code: MemberImportErrorCode; message: string } | null {
  const parsed = memberImportRoleSchema.safeParse(role);
  if (parsed.success) return null;
  return {
    code: MemberImportErrorCode.INVALID_ROLE,
    message: `"${role}" is not a recognised role.`,
  };
}

function parseJoinedAt(input: string | undefined): string | undefined {
  if (!input) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/u.test(input)) {
    const date = new Date(`${input}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? input : date.toISOString();
  }
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? input : date.toISOString();
}

function codeForField(field: string | null): MemberImportErrorCode {
  switch (field) {
    case 'email':
      return MemberImportErrorCode.INVALID_EMAIL;
    case 'phone':
      return MemberImportErrorCode.INVALID_PHONE;
    case 'joinedAt':
      return MemberImportErrorCode.INVALID_DATE;
    case 'role':
      return MemberImportErrorCode.INVALID_ROLE;
    default:
      return MemberImportErrorCode.MISSING_FIELD;
  }
}

function messageForField(field: string | null, fallback: string): string {
  switch (field) {
    case 'firstName':
      return 'First name is required.';
    case 'lastName':
      return 'Last name is required.';
    case 'email':
      return 'Email address is not valid.';
    case 'phone':
      return 'Phone number must be in E.164 format, e.g. +14155552671.';
    case 'joinedAt':
      return 'Join date is not a valid date.';
    default:
      return fallback;
  }
}
