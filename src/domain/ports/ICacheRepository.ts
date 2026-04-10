/**
 * @module ICacheRepository
 *
 * Port for a generic key-value cache with TTL support.
 * Decoupled from any specific cache technology (in-memory, Redis, etc.).
 */

export interface ICacheRepository {
  /**
   * Retrieve a cached value by key.
   * Returns null when the key doesn't exist or has expired.
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Store a value with an optional TTL.
   * @param key        - Cache key
   * @param value      - Value to store
   * @param ttlSeconds - Time-to-live in seconds (0 = never expires)
   */
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  /** Remove a specific key from the cache. */
  delete(key: string): Promise<void>;

  /** Flush all cache entries. */
  clear(): Promise<void>;

  /** Returns true if the key exists and has not expired. */
  has(key: string): Promise<boolean>;
}
