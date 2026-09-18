import { z } from 'zod';
import { paginatedSchema, paginationQuerySchema } from '../common/pagination';
import { uuidSchema } from '../common/primitives';

/**
 * Money on the accounting surface is integer minor units (cents, kobo, pence).
 * The currency travels beside the amount so a church can keep books in NGN
 * without the API inventing a floating-point representation.
 */
export const moneyMinorSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const signedMoneyMinorSchema = z
  .number()
  .int()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);

export const currencySchema = z
  .string()
  .trim()
  .length(3, 'Currency must be a 3-letter ISO 4217 code')
  .toUpperCase()
  .regex(/^[A-Z]{3}$/, 'Currency must be a 3-letter ISO 4217 code');

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date such as 2024-03-17');

export const accountCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(16)
  .regex(/^[A-Za-z0-9][A-Za-z0-9.-]*$/, 'Account codes may use letters, numbers, dots and hyphens');

export { paginatedSchema, paginationQuerySchema, uuidSchema };
