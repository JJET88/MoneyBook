import { AppError } from "./errors.js";

/**
 * Allow `max` attempts per `windowMs` for each key. Kept in memory, so the
 * count is per server process; enough to make password guessing slow.
 */
export function createLimiter(max, windowMs, now = Date.now) {
  const attempts = new Map();
  return function check(key) {
    const recent = (attempts.get(key) ?? []).filter((t) => now() - t < windowMs);
    if (recent.length >= max) throw new AppError(429, "err.tooMany");
    recent.push(now());
    attempts.set(key, recent);
    if (attempts.size > 10_000) attempts.clear();
  };
}
