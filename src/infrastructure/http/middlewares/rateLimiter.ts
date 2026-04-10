/**
 * @module rateLimiter
 *
 * Rate-limiting middleware powered by `express-rate-limit`.
 * Default: 100 requests per IP per 15-minute window.
 * All values are configurable via environment variables.
 */

import rateLimit from 'express-rate-limit';
import { env } from '../../../config/env';

export const rateLimiter = rateLimit({
  windowMs:         env.RATE_LIMIT_WINDOW_MS,
  max:              env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders:  true,   // Return `RateLimit-*` headers (RFC 6585)
  legacyHeaders:    false,  // Disable the `X-RateLimit-*` headers
  message: {
    error: {
      code:    'RATE_LIMIT_EXCEEDED',
      message: `Too many requests. Limit: ${env.RATE_LIMIT_MAX_REQUESTS} requests per ${env.RATE_LIMIT_WINDOW_MS / 60_000} minutes.`,
    },
  },
  // Skip rate limiting in test environment
  skip: () => env.NODE_ENV === 'test',
});
