import type { Env } from './env'

/**
 * Best-effort per-IP rate limit + global daily cap, backed by KV. KV is
 * eventually consistent with no atomic increment, so counters can undercount
 * under bursty load — acceptable for v0.1 (abuse protection + credit kill-switch,
 * not exact metering). Migrate to a Durable Object if precise limits are needed.
 */

export const PER_IP_LIMIT = 60
export const PER_IP_WINDOW_SECONDS = 60

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

// Returns true and records the hit if within the per-IP limit.
export async function withinIpLimit(
  env: Env,
  ip: string,
  now: Date = new Date(),
): Promise<boolean> {
  const window = Math.floor(now.getTime() / 1000 / PER_IP_WINDOW_SECONDS)
  const key = `rl:${ip}:${window}`
  const current = Number((await env.RATELIMIT.get(key)) ?? '0')

  if (current >= PER_IP_LIMIT) {
    return false
  }

  await env.RATELIMIT.put(key, String(current + 1), {
    // Keep slightly longer than the window so the counter survives the full minute.
    expirationTtl: PER_IP_WINDOW_SECONDS + 10,
  })
  return true
}

// Returns true and records the hit if the global daily cap is not yet reached.
export async function withinDailyCap(env: Env, now: Date = new Date()): Promise<boolean> {
  const cap = Number(env.DAILY_CAP) || 50_000
  const key = `cap:${dayKey(now)}`
  const current = Number((await env.RATELIMIT.get(key)) ?? '0')

  if (current >= cap) {
    return false
  }

  await env.RATELIMIT.put(key, String(current + 1), {
    // Expire ~36h after the day starts so counters auto-clean (privacy: no long retention).
    expirationTtl: 36 * 60 * 60,
  })
  return true
}
