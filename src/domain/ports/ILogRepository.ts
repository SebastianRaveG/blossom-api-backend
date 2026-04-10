/**
 * @module ILogRepository
 *
 * Port for persisting and retrieving API request logs.
 * The use case only depends on this interface; the SQLite implementation
 * lives in the infrastructure layer and is injected at startup.
 */

import type { FranchiseName } from '../entities/FranchiseCharacter';

export type LogStatus = 'success' | 'error';

export interface LogEntry {
  id?: number;
  requestId: string;
  franchise: FranchiseName;
  version: string;
  metadata: string;         // JSON-serialized CharacterQuery
  timestamp: string;        // ISO-8601
  status: LogStatus;
  responseTimeMs: number;
  errorMessage?: string;
}

export interface ILogRepository {
  /** Persist a single request log entry. */
  save(entry: LogEntry): Promise<void>;

  /** Retrieve all log entries, most recent first. */
  findAll(limit?: number): Promise<LogEntry[]>;

  /** Retrieve logs filtered by franchise. */
  findByFranchise(franchise: FranchiseName, limit?: number): Promise<LogEntry[]>;

  /** Retrieve a single log entry by requestId. */
  findByRequestId(requestId: string): Promise<LogEntry | null>;

  /** Delete all log entries (useful for testing). */
  clear(): Promise<void>;
}
