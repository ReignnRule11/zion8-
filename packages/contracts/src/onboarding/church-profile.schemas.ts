import { z } from 'zod';
import { emailSchema, phoneSchema, personNameSchema } from '../common/primitives';

/**
 * Operational profile of the church workspace. The tenant row carries identity
 * (name, slug, timezone, locale); this carries the things a church fills in
 * during onboarding: where it is, how to reach it, and how it worships.
 */

export const dayOfWeekSchema = z.enum([
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]);

export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;

const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour HH:MM format');

export const serviceTimeSchema = z.object({
  day: dayOfWeekSchema,
  startTime: timeOfDaySchema,
  endTime: timeOfDaySchema.optional(),
  name: z.string().trim().min(1).max(80).default('Service'),
});

export type ServiceTime = z.infer<typeof serviceTimeSchema>;

export const churchProfileSchema = z.object({
  legalName: z.string().trim().min(2).max(160).optional(),
  contactEmail: emailSchema.optional(),
  contactPhone: phoneSchema.optional(),
  websiteUrl: z.string().trim().url().max(2048).optional(),
  addressLine1: z.string().trim().min(1).max(180).optional(),
  addressLine2: z.string().trim().max(180).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  region: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(32).optional(),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'Use a two-letter ISO country code')
    .transform((value) => value.toUpperCase())
    .optional(),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'Use a three-letter ISO currency code')
    .transform((value) => value.toUpperCase())
    .default('USD'),
  weekStart: dayOfWeekSchema.default('SUNDAY'),
  estimatedMembers: z.number().int().min(0).max(1_000_000).optional(),
  serviceTimes: z.array(serviceTimeSchema).max(20).default([]),
});

export type ChurchProfileInput = z.input<typeof churchProfileSchema>;
export type ChurchProfileRequest = z.output<typeof churchProfileSchema>;

export const churchProfileResponseSchema = churchProfileSchema.extend({
  tenantId: z.string().uuid(),
  completedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ChurchProfileResponse = z.infer<typeof churchProfileResponseSchema>;
