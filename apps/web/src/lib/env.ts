import { z } from 'zod';

const serverEnvSchema = z.object({
  API_INTERNAL_URL: z.string().url(),
  API_VERSION: z.string().min(1).max(16),
});

export const serverEnv = serverEnvSchema.parse({
  API_INTERNAL_URL: process.env.API_INTERNAL_URL ?? 'http://localhost:4000',
  API_VERSION: process.env.API_VERSION ?? '1',
});

export const apiBaseUrl = `${serverEnv.API_INTERNAL_URL}/api/v${serverEnv.API_VERSION}`;
