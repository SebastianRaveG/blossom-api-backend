/**
 * @module SQLiteLogRepository
 *
 * Concrete implementation of {@link ILogRepository} using Node.js's built-in
 * `node:sqlite` module (available since Node.js 22.5 — no npm package needed).
 *
 * All DB operations are synchronous at the SQLite level but wrapped in
 * async methods to satisfy the port interface (future Redis or Postgres
 * implementations will be fully async).
 *
 * NOTE: node:sqlite is experimental. To suppress the warning in production,
 * run Node with: --no-experimental-require-module or set NODE_NO_WARNINGS=1
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// node:sqlite is built into Node.js 22+ (no npm package needed).
// @types/node ≤ 20 doesn't ship sqlite types yet, so we load it dynamically.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => any };
import fs   from 'fs';
import path from 'path';
import type { ILogRepository, LogEntry, LogStatus } from '../../domain/ports/ILogRepository';
import type { FranchiseName }                       from '../../domain/entities/FranchiseCharacter';
import { CREATE_LOGS_TABLE, CREATE_INDEXES }         from './schema';

interface LogRow {
  id: number;
  request_id: string;
  franchise: string;
  version: string;
  metadata: string;
  timestamp: string;
  status: string;
  response_time_ms: number;
  error_message: string | null;
}

export class SQLiteLogRepository implements ILogRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly db: any;

  constructor(dbPath: string) {
    // Ensure the parent directory exists
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(dbPath);

    // Run schema migrations on startup
    this.db.exec(CREATE_LOGS_TABLE);
    this.db.exec(CREATE_INDEXES);
  }

  async save(entry: LogEntry): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO request_logs
        (request_id, franchise, version, metadata, timestamp, status, response_time_ms, error_message)
      VALUES
        (:request_id, :franchise, :version, :metadata, :timestamp, :status, :response_time_ms, :error_message)
    `);

    stmt.run({
      ':request_id':       entry.requestId,
      ':franchise':        entry.franchise,
      ':version':          entry.version,
      ':metadata':         entry.metadata,
      ':timestamp':        entry.timestamp,
      ':status':           entry.status,
      ':response_time_ms': entry.responseTimeMs,
      ':error_message':    entry.errorMessage ?? null,
    });
  }

  async findAll(limit = 100): Promise<LogEntry[]> {
    // node:sqlite requires named params ({ key: val }) — positional ? args behave unexpectedly
    const rows = this.db
      .prepare('SELECT * FROM request_logs ORDER BY timestamp DESC LIMIT :limit')
      .all({ ':limit': limit }) as LogRow[];

    return rows.map(this.rowToEntry);
  }

  async findByFranchise(franchise: FranchiseName, limit = 100): Promise<LogEntry[]> {
    const rows = this.db
      .prepare(
        'SELECT * FROM request_logs WHERE franchise = :franchise ORDER BY timestamp DESC LIMIT :limit'
      )
      .all({ ':franchise': franchise, ':limit': limit }) as LogRow[];

    return rows.map(this.rowToEntry);
  }

  async findByRequestId(requestId: string): Promise<LogEntry | null> {
    const row = this.db
      .prepare('SELECT * FROM request_logs WHERE request_id = :request_id')
      .get({ ':request_id': requestId }) as LogRow | undefined;

    return row ? this.rowToEntry(row) : null;
  }

  async clear(): Promise<void> {
    this.db.prepare('DELETE FROM request_logs').run({});
  }

  /** Close the database connection gracefully (useful for tests / shutdown). */
  close(): void {
    this.db.close();
  }

  private rowToEntry(row: LogRow): LogEntry {
    return {
      id:              row.id,
      requestId:       row.request_id,
      franchise:       row.franchise as FranchiseName,
      version:         row.version,
      metadata:        row.metadata,
      timestamp:       row.timestamp,
      status:          row.status as LogStatus,
      responseTimeMs:  row.response_time_ms,
      errorMessage:    row.error_message ?? undefined,
    };
  }
}
