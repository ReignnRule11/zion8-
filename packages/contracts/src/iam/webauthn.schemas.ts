import { z } from 'zod';
import { emailSchema, phoneSchema, uuidSchema } from '../common/primitives';

const webauthnPayloadSchema = z.record(z.string(), z.unknown());

export const webauthnRegistrationOptionsRequestSchema = z.object({
  name: z.string().trim().min(1).max(120).default('Passkey'),
});

export type WebAuthnRegistrationOptionsRequest = z.infer<
  typeof webauthnRegistrationOptionsRequestSchema
>;

export const webauthnRegistrationOptionsResponseSchema = z.object({
  challengeId: uuidSchema,
  factorId: uuidSchema,
  options: webauthnPayloadSchema,
});

export type WebAuthnRegistrationOptionsResponse = z.infer<
  typeof webauthnRegistrationOptionsResponseSchema
>;

export const webauthnRegistrationVerifySchema = z.object({
  challengeId: uuidSchema,
  factorId: uuidSchema,
  name: z.string().trim().min(1).max(120).optional(),
  response: webauthnPayloadSchema,
});

export type WebAuthnRegistrationVerifyRequest = z.infer<
  typeof webauthnRegistrationVerifySchema
>;

const contactObjectSchema = z.object({
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
});

export const webauthnAuthenticationOptionsRequestSchema = contactObjectSchema.extend({
  tenantSlug: z.string().min(3).max(40).optional(),
});

export type WebAuthnAuthenticationOptionsRequest = z.infer<
  typeof webauthnAuthenticationOptionsRequestSchema
>;

export const webauthnAuthenticationOptionsResponseSchema = z.object({
  challengeId: uuidSchema,
  options: webauthnPayloadSchema,
});

export type WebAuthnAuthenticationOptionsResponse = z.infer<
  typeof webauthnAuthenticationOptionsResponseSchema
>;

export const webauthnAuthenticationVerifySchema = contactObjectSchema.extend({
  challengeId: uuidSchema,
  response: webauthnPayloadSchema,
  tenantSlug: z.string().min(3).max(40).optional(),
});

export type WebAuthnAuthenticationVerifyRequest = z.infer<
  typeof webauthnAuthenticationVerifySchema
>;

export const webauthnCredentialSummarySchema = z.object({
  id: uuidSchema,
  factorId: uuidSchema,
  deviceType: z.string().nullable(),
  backedUp: z.boolean(),
  transports: z.array(z.string()),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
});

export type WebAuthnCredentialSummary = z.infer<typeof webauthnCredentialSummarySchema>;
