import type { Env } from './env'

/**
 * Read-through KV cache; every cacheable Worker read goes through here.
 * A `null` from `fn` is returned but NOT cached, so transient upstream failures
 * aren't pinned for the TTL. TTL is clamped to KV's 60s minimum.
 */
export async function cached<T>(
  env: Env,
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T | null>,
): Promise<T | null> {
  const hit = await env.CACHE.get(key, 'json')
  if (hit !== null) {
    return hit as T
  }

  const fresh = await fn()
  if (fresh !== null) {
    await env.CACHE.put(key, JSON.stringify(fresh), {
      expirationTtl: Math.max(60, Math.floor(ttlSeconds)),
    })
  }
  return fresh
}
