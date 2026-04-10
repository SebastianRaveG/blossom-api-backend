/**
 * @module env
 *
 * Centralized, validated environment configuration using Zod.
 * Importing this module early (in main.ts) ensures we fail fast with a
 * descriptive error if a required env var is missing or has the wrong type.
 */

import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  PORT: z.coerce.number().int().positive().default(3000),

  DB_PATH: z.string().default('./data/blossom.db'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),   // 15 min
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

  // Cache
  CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().default(300),       // 5 min
  CACHE_ENABLED: z
    .string()
    .transform((v) => v !== 'false')
    .default('true'),

  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
