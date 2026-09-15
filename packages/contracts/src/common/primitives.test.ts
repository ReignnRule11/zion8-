import { describe, expect, it } from 'vitest';
import { emailSchema, passwordSchema, personNameSchema, slugSchema } from './primitives';

describe('primitives', () => {
  it('normalizes email casing and whitespace', () => {
    expect(emailSchema.parse('  Pastor.John@Example.COM ')).toBe('pastor.john@example.com');
  });

  it('rejects malformed email addresses', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    expect(emailSchema.safeParse('a@b').success).toBe(false);
  });

  it('enforces password length and composition', () => {
    expect(passwordSchema.safeParse('short1').success).toBe(false);
    expect(passwordSchema.safeParse('alllettersonly').success).toBe(false);
    expect(passwordSchema.safeParse('1234567890123').success).toBe(false);
    expect(passwordSchema.safeParse('faithful8church').success).toBe(true);
  });

  it('accepts only url-safe slugs', () => {
    expect(slugSchema.parse('grace-chapel-2026')).toBe('grace-chapel-2026');
    expect(slugSchema.safeParse('Grace-Chapel').success).toBe(false);
    expect(slugSchema.safeParse('-grace').success).toBe(false);
    expect(slugSchema.safeParse('grace-').success).toBe(false);
    expect(slugSchema.safeParse('ab').success).toBe(false);
  });

  it('trims person names and rejects blanks', () => {
    expect(personNameSchema.parse('  Mary  ')).toBe('Mary');
    expect(personNameSchema.safeParse('   ').success).toBe(false);
  });
});
