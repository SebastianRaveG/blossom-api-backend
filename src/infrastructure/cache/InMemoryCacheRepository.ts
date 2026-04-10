/**
 * @module InMemoryCacheRepository
 *
 * A lightweight in-process cache with TTL support, implementing
 * {@link ICacheRepository}.
 *
 * Trade-offs:
 *  ✅ Zero external dependencies, zero config
 *  ✅ Sub-millisecond reads and writes
 *  ❌ Not shared across multiple Node processes / pods
 *  ❌ Lost on server restart
 *
 * For a production multi-instance deployment, swap this implementation
 * for a Redis adapter — the interface stays identical.
 */

import type { ICacheRepository } from '../../domain/ports/ICacheRepository';

interface CacheEntry<T> {
  value: T;
  /** Unix timestamp (ms) when this entry expires. 0 = never. */
  expiresAt: number;
}

export class InMemoryCacheRepository implements ICacheRepository {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  /** Optional: run an automatic sweep every `sweepIntervalMs` to free memory. */
  private sweepTimer?: NodeJS.Timeout;

  constructor(sweepIntervalMs = 60_000) {
    if (sweepIntervalMs > 0) {
      this.sweepTimer = setInterval(() => this.sweep(), sweepIntervalMs);
      // Allow the process to exit even if the timer is still running
      this.sweepTimer.unref?.();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set<T>(key: string, value: T, ttlSeconds = 0): Promise<void> {
    const expiresAt = ttlSeconds > 0
      ? Date.now() + ttlSeconds * 1_000
      : 0;

    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /** Returns the number of non-expired entries currently cached. */
  size(): number {
    this.sweep();
    return this.store.size;
  }

  /** Stop the background sweep timer (useful in tests). */
  destroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
    }
    this.store.clear();
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private isExpired(entry: CacheEntry<unknown>): boolean {
    return entry.expiresAt > 0 && Date.now() > entry.expiresAt;
  }

  /** Remove all expired entries to prevent unbounded memory growth. */
  private sweep(): void {
    for (const [key, entry] of this.store) {
      if (this.isExpired(entry)) {
        this.store.delete(key);
      }
    }
  }
}
