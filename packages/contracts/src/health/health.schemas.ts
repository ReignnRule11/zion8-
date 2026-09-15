import { z } from 'zod';

export const HealthStatus = {
  OK: 'ok',
  DEGRADED: 'degraded',
  DOWN: 'down',
} as const;

export type HealthStatus = (typeof HealthStatus)[keyof typeof HealthStatus];

export const dependencyHealthSchema = z.object({
  name: z.string(),
  status: z.enum(['up', 'down']),
  latencyMs: z.number().nonnegative().optional(),
  message: z.string().optional(),
});

export type DependencyHealth = z.infer<typeof dependencyHealthSchema>;

export const readinessSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.string().datetime(),
  dependencies: z.array(dependencyHealthSchema),
});

export type Readiness = z.infer<typeof readinessSchema>;

export const livenessSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  timestamp: z.string().datetime(),
});

export type Liveness = z.infer<typeof livenessSchema>;
