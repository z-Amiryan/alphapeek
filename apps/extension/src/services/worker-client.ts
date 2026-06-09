// Typed client for the Worker proxy; ONLY the background SW calls it (SPEC §1).
// The CoinStats key never touches this path — the Worker holds it. Errors come
// back as discriminated values, never thrown across the message boundary.
import type {
  Chain,
  FearGreed,
  LookupErrorCode,
  LookupResult,
  RuntimeResponse,
} from '@alphapeek/shared'
import { debugError } from '@/lib/debug'

// Injected at build time from `apps/extension/.env` (see vite-env.d.ts).
const WORKER_URL = (import.meta.env.VITE_WORKER_URL ?? '').replace(/\/+$/, '')

export async function lookup(addr: string, chain: Chain): Promise<RuntimeResponse<LookupResult>> {
  const qs = `addr=${encodeURIComponent(addr)}&chain=${encodeURIComponent(chain)}`
  return request<LookupResult>(`/v1/lookup?${qs}`)
}

export async function coinLookup(coinId: string): Promise<RuntimeResponse<LookupResult>> {
  return request<LookupResult>(`/v1/coin?coinId=${encodeURIComponent(coinId)}`)
}

export async function symbolLookup(symbol: string): Promise<RuntimeResponse<LookupResult>> {
  return request<LookupResult>(`/v1/symbol?symbol=${encodeURIComponent(symbol)}`)
}

export async function fearGreed(): Promise<RuntimeResponse<FearGreed>> {
  return request<FearGreed>('/v1/fear-greed')
}

async function request<T>(path: string): Promise<RuntimeResponse<T>> {
  if (!WORKER_URL) {
    debugError('VITE_WORKER_URL is not set — cannot reach the Worker')
    return { ok: false, error: 'upstream_error' }
  }

  let res: Response
  try {
    res = await fetch(`${WORKER_URL}${path}`, { headers: { accept: 'application/json' } })
  } catch (err) {
    debugError('worker fetch failed', err)
    return { ok: false, error: 'upstream_error' }
  }

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (res.ok) {
    return { ok: true, data: body as T }
  }
  return { ok: false, error: errorCodeFrom(res.status, body) }
}

function errorCodeFrom(status: number, body: unknown): LookupErrorCode {
  return readErrorCode(body) ?? statusToError(status)
}

function statusToError(status: number): LookupErrorCode {
  if (status === 400) return 'invalid_address'
  if (status === 429) return 'rate_limited'
  return 'upstream_error'
}

function readErrorCode(body: unknown): LookupErrorCode | null {
  if (typeof body !== 'object' || body === null || !('error' in body)) return null
  const code = (body as { error: unknown }).error
  if (
    code === 'invalid_address' ||
    code === 'rate_limited' ||
    code === 'daily_cap_reached' ||
    code === 'upstream_error'
  ) {
    return code
  }
  return null
}
