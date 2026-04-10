/**
 * @module requestId.middleware
 *
 * Assigns a unique UUID (v4) to every incoming request and exposes it via:
 *  - `req.requestId`      — for downstream handlers
 *  - `X-Request-ID` header — for the response (useful for client-side tracing)
 *
 * If the caller already sent an `X-Request-ID` header, we reuse it
 * (useful when an upstream gateway injects correlation IDs).
 */

import { v4 as uuidv4 } from 'uuid';
import type { Request, Response, NextFunction } from 'express';

// Augment Express's Request type so TypeScript knows about `requestId`
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const existingId = req.headers['x-request-id'];
  req.requestId = typeof existingId === 'string' && existingId.length > 0
    ? existingId
    : uuidv4();

  res.setHeader('X-Request-ID', req.requestId);
  next();
}
