/**
 * @module queryParams.validator
 *
 * Zod schemas for validating the `metadata` and `config` query parameters.
 *
 * Both parameters arrive as JSON strings (per the API contract) and are
 * parsed + validated here before reaching the use case.
 */

import { z } from 'zod';
import { ValidationError } from '../../../domain/errors/DomainError';

// ─── Schemas ─────────────────────────────────────────────────────────────────

/**
 * `metadata` — identifies the character to look up.
 * Exactly one of `name` or `id` must be present.
 */
export const metadataSchema = z
  .object({
    name: z.string().min(1).optional(),
    id:   z.number().int().positive().optional(),
  })
  .refine(
    (d) => d.name !== undefined || d.id !== undefined,
    { message: 'metadata must contain either "name" or "id"' }
  );

/**
 * `config` — caller-supplied API configuration.
 */
export const configSchema = z.object({
  baseUrl: z.string().url({ message: 'config.baseUrl must be a valid URL' }),
  apiKey:  z.string().optional(),
  headers: z.record(z.string()).optional(),
});

export type MetadataInput = z.infer<typeof metadataSchema>;
export type ConfigInput   = z.infer<typeof configSchema>;

// ─── Parser ───────────────────────────────────────────────────────────────────

export interface ParsedQueryParams {
  metadata: MetadataInput;
  config:   ConfigInput;
}

/**
 * Parse and validate both query parameters from a raw Express query object.
 *
 * @throws {@link ValidationError} with details if validation fails.
 */
export function parseQueryParams(query: Record<string, unknown>): ParsedQueryParams {
  // ── metadata ──────────────────────────────────────────────────────────────
  if (!query.metadata) {
    throw new ValidationError('Query parameter "metadata" is required.');
  }

  let rawMetadata: unknown;
  try {
    rawMetadata = typeof query.metadata === 'string'
      ? JSON.parse(query.metadata)
      : query.metadata;
  } catch {
    throw new ValidationError(
      'Query parameter "metadata" must be valid JSON.',
      { received: query.metadata }
    );
  }

  const metaResult = metadataSchema.safeParse(rawMetadata);
  if (!metaResult.success) {
    throw new ValidationError(
      'Invalid "metadata" parameter.',
      metaResult.error.format()
    );
  }

  // ── config ────────────────────────────────────────────────────────────────
  if (!query.config) {
    throw new ValidationError('Query parameter "config" is required.');
  }

  let rawConfig: unknown;
  try {
    rawConfig = typeof query.config === 'string'
      ? JSON.parse(query.config)
      : query.config;
  } catch {
    throw new ValidationError(
      'Query parameter "config" must be valid JSON.',
      { received: query.config }
    );
  }

  const configResult = configSchema.safeParse(rawConfig);
  if (!configResult.success) {
    throw new ValidationError(
      'Invalid "config" parameter.',
      configResult.error.format()
    );
  }

  return {
    metadata: metaResult.data,
    config:   configResult.data,
  };
}
