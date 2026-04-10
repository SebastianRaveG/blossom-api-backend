/**
 * @module errorHandler.middleware
 *
 * Global Express error handler — the LAST middleware registered in app.ts.
 *
 * Translates domain/application errors (which know nothing about HTTP) into
 * well-structured JSON responses with the correct status code.
 *
 * Response envelope on error:
 * {
 *   "error": {
 *     "code":    "VALIDATION_ERROR",
 *     "message": "...",
 *     "details": { ... }   // only present when relevant
 *   },
 *   "requestId": "uuid"
 * }
 */

import type { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../../../domain/errors/DomainError';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const requestId = req.requestId ?? 'unknown';

  // ── Known domain/application errors ──────────────────────────────────────
  if (err instanceof AppError) {
    const body: Record<string, unknown> = {
      error: {
        code:    err.code,
        message: err.message,
        ...(err instanceof ValidationError && err.details
          ? { details: err.details }
          : {}),
      },
      requestId,
    };

    res.status(err.statusCode).json(body);
    return;
  }

  // ── Unexpected errors — don't leak internals in production ────────────────
  const isDev = process.env.NODE_ENV === 'development';

  console.error(`[${requestId}] Unhandled error:`, err);

  res.status(500).json({
    error: {
      code:    'INTERNAL_SERVER_ERROR',
      message: isDev ? err.message : 'An unexpected error occurred.',
      ...(isDev ? { stack: err.stack } : {}),
    },
    requestId,
  });
}
