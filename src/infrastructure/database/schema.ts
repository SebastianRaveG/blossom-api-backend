/**
 * @module schema
 *
 * SQLite schema definition.
 * Using a plain string here keeps the dependency on `better-sqlite3` isolated
 * to the database module — the domain and application layers never see it.
 */

export const CREATE_LOGS_TABLE = `
  CREATE TABLE IF NOT EXISTS request_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id      TEXT    NOT NULL UNIQUE,
    franchise       TEXT    NOT NULL,
    version         TEXT    NOT NULL,
    metadata        TEXT    NOT NULL,
    timestamp       TEXT    NOT NULL,
    status          TEXT    NOT NULL CHECK(status IN ('success', 'error')),
    response_time_ms INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT
  );
`;

export const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_logs_franchise  ON request_logs (franchise);
  CREATE INDEX IF NOT EXISTS idx_logs_timestamp  ON request_logs (timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_logs_request_id ON request_logs (request_id);
`;
