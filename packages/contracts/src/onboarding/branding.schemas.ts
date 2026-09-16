import { z } from 'zod';
import { uuidSchema } from '../common/primitives';

/**
 * Brand customization for the church workspace. Colours are constrained to
 * six-digit hex so that generated CSS, the web theme, and the Flutter theme all
 * receive a value they can consume without a parser on the client.
 */

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex colour such as #4f46e5')
  .transform((value) => value.toLowerCase());

const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
    'Enter a valid domain such as gracechapel.org',
  );

export const brandThemeSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  tagline: z.string().trim().max(160).optional(),
  logoUrl: z.string().trim().url().max(2048).optional(),
  faviconUrl: z.string().trim().url().max(2048).optional(),
  primaryColor: hexColorSchema.default('#4f46e5'),
  secondaryColor: hexColorSchema.default('#0f172a'),
  accentColor: hexColorSchema.default('#38bdf8'),
  customDomain: hostnameSchema.optional(),
  welcomeMessage: z.string().trim().max(600).optional(),
});

export type BrandThemeInput = z.input<typeof brandThemeSchema>;
export type BrandThemeRequest = z.output<typeof brandThemeSchema>;

export const brandThemeResponseSchema = brandThemeSchema.extend({
  tenantId: uuidSchema,
  completedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BrandThemeResponse = z.infer<typeof brandThemeResponseSchema>;

/** Default palette derived from the workspace when the owner customizes nothing. */
export const DEFAULT_BRAND_THEME = {
  primaryColor: '#4f46e5',
  secondaryColor: '#0f172a',
  accentColor: '#38bdf8',
} as const;
