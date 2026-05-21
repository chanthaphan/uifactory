/**
 * A small in-memory sliding-window rate limiter (per process). Good enough for a single instance;
 * a multi-replica deployment would back this with Redis instead.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private readonly limit: number, private readonly windowMs: number) {}

  /** Returns true if the call is allowed (and records it), false if the key is over its limit. */
  check(key: string): boolean {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
