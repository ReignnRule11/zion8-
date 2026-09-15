import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const slugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(40, 'Slug must be at most 40 characters')
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    'Slug may only contain lowercase letters, numbers, and inner hyphens',
  );

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('A valid email address is required')
  .max(320, 'Email must be at most 320 characters');

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, 'Phone number must be in E.164 format, e.g. +14155552671');

export const personNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(120, 'Name must be at most 120 characters');

export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export type Uuid = z.infer<typeof uuidSchema>;
export type Slug = z.infer<typeof slugSchema>;
export type Email = z.infer<typeof emailSchema>;
export type Phone = z.infer<typeof phoneSchema>;
