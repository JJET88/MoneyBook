import { AppError } from "./errors.js";

/**
 * Allow `max` attempts per `windowMs` for each key. The attempt is written
 * down before it is counted, so a burst of requests sent at the same moment
 * still sees itself and cannot slip through together. Refused attempts count
 * too: someone who keeps trying stays refused.
 *
 * The store keeps the attempts: memoryStore() for a single process and the
 * tests, attemptStore from lib/repos/attempts.js so every server process and
 * every restart shares one count.
 */
export function createLimiter(max, windowMs, { name = "", store = memoryStore(), now = Date.now } = {}) {
  return async function attempt(key) {
    const at = now();
    const bucket = `${name}:${key}`;
    await store.add(bucket, at, at - windowMs);
    if ((await store.count(bucket, at - windowMs)) > max) throw new AppError(429, "err.tooMany");
  };
}

export function memoryStore() {
  const attempts = new Map();
  return {
    async add(key, at, since) {
      attempts.set(key, [...(attempts.get(key) ?? []).filter((t) => t > since), at]);
      if (attempts.size > 10_000) attempts.clear();
    },
    async count(key, since) {
      return (attempts.get(key) ?? []).filter((t) => t > since).length;
    },
  };
}

/**
 * The address a request came from, for limits per network address.
 * Next.js passes on an X-Forwarded-For header the browser made up itself, so
 * only the entries added by proxies we run can be believed: with
 * `trustedProxies` proxies in front of the app (1: a load balancer or nginx;
 * Vercel also counts as 1), the address is the one the outermost proxy saw.
 */
export function addressFrom(forwardedFor, trustedProxies = 1) {
  const hops = String(forwardedFor ?? "").split(",").map((hop) => hop.trim()).filter(Boolean);
  return hops.at(-Math.max(1, trustedProxies)) ?? hops[0] ?? "unknown";
}
