/**
 * @module DomainError
 *
 * Typed error hierarchy for the application.
 * Using named error classes (instead of generic Error) allows middleware
 * to map errors to the correct HTTP status codes without coupling the
 * domain layer to HTTP concerns.
 */

/** Base class for all application errors. */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Maintains proper prototype chain for `instanceof` checks in TypeScript
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Domain errors (400–404) ──────────────────────────────────────────────────

/** Thrown when a client supplies a franchise name we don't support. */
export class InvalidFranchiseError extends AppError {
  readonly statusCode = 400;
  readonly code = 'INVALID_FRANCHISE';

  constructor(franchise: string) {
    super(
      `Franchise "${franchise}" is not supported. ` +
      `Supported franchises: pokemon, digimon.`
    );
  }
}

/** Thrown when the external API returns no character for the given query. */
export class CharacterNotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'CHARACTER_NOT_FOUND';

  constructor(query: string, franchise: string) {
    super(`Character "${query}" not found in ${franchise} franchise.`);
  }
}

// ─── Validation errors (400) ─────────────────────────────────────────────────

/** Thrown when a request parameter fails schema validation. */
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
  readonly details: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.details = details;
  }
}

// ─── External API errors (502) ───────────────────────────────────────────────

/** Thrown when the external franchise API returns an unexpected error. */
export class ExternalApiError extends AppError {
  readonly statusCode = 502;
  readonly code = 'EXTERNAL_API_ERROR';

  constructor(franchise: string, cause: string) {
    super(`External API error for franchise "${franchise}": ${cause}`);
  }
}

// ─── Rate limit error (429) ──────────────────────────────────────────────────

/** Thrown / used by the rate-limiter middleware. */
export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMIT_EXCEEDED';

  constructor() {
    super('Too many requests. Please try again later.');
  }
}
