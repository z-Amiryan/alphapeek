import type { Chain, Health, LookupError, LookupResult } from '@alphapeek/shared'
import { DEFAULT_CHAIN, isChain } from '@alphapeek/shared'
import { Hono } from 'hono'
import { cached } from './cache'
import {
  UpstreamError,
  detectTokenCoinId,
  fetchChart,
  fetchFearGreed,
  fetchTokenDetail,
  fetchWallet,
} from './coinstats'
import { type Env, WORKER_VERSION } from './env'
import { withinDailyCap, withinIpLimit } from './ratelimit'

const ADDRESS_RE = /^0x[a-f0-9]{40}$/

// Kind-cache sentinel for addresses that are not token contracts.
const NOT_A_TOKEN = 'addr:'

const DAY = 60 * 60 * 24
const KIND_TTL = 30 * DAY
const TOKEN_TTL = 60
// The 7d sparkline is hourly data, so it can outlive the 60s price refresh; a longer
// TTL also cuts the ~3-credit chart call. Cached apart from the token so a chart hiccup
// degrades to "no chart this request" (retried next time), never a blank-for-TOKEN_TTL.
const CHART_TTL = 900
const WALLET_TTL = 300
const FEAR_GREED_TTL = 300

const app = new Hono<{ Bindings: Env }>()

// Only our own extension and localhost dev may call the proxy.
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false
  return (
    origin.startsWith('chrome-extension://') ||
    /^http:\/\/localhost(:\d+)?$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
  )
}

app.use('*', async (c, next) => {
  const origin = c.req.header('origin')
  if (isAllowedOrigin(origin) && origin) {
    c.header('Access-Control-Allow-Origin', origin)
    c.header('Vary', 'Origin')
    c.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
    c.header('Access-Control-Allow-Headers', 'Content-Type')
    c.header('Access-Control-Max-Age', '86400')
  }
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204)
  }
  await next()
})

// Mandatory gate for credit-spending routes (SPEC §4): origin allowlist, per-IP
// rate limit, then daily cap — all before any business logic. `/health` is
// intentionally exempt (no auth, no rate limit). This also covers /v1/fear-greed,
// which previously bypassed both limits.
app.use('/v1/*', async (c, next) => {
  // CORS blocks a malicious page from *reading* our response, but the browser
  // still sends the cross-origin GET and burns a credit. Reject present-and-
  // disallowed Origins up front. An absent Origin (the extension SW, curl,
  // server-side) is allowed — it's not a browser and the rate limits cover it.
  const origin = c.req.header('origin')
  if (origin && !isAllowedOrigin(origin)) {
    return c.json({ error: 'forbidden' }, 403)
  }

  // Prefer Cloudflare's trusted single-IP header; `x-forwarded-for` may be a
  // client-influenced comma-separated list, so take only its first hop.
  const ip =
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  if (!(await withinIpLimit(c.env, ip))) {
    return c.json<LookupError>({ error: 'rate_limited' }, 429)
  }
  if (!(await withinDailyCap(c.env))) {
    return c.json<LookupError>({ error: 'daily_cap_reached' }, 503)
  }
  await next()
})

app.get('/health', (c) => {
  const body: Health = { ok: true, version: WORKER_VERSION }
  return c.json(body)
})

app.get('/v1/lookup', async (c) => {
  const addr = (c.req.query('addr') ?? '').toLowerCase()
  if (!ADDRESS_RE.test(addr)) {
    return c.json<LookupError>({ error: 'invalid_address' }, 400)
  }

  const chainParam = c.req.query('chain') ?? DEFAULT_CHAIN
  const chain = isChain(chainParam) ? chainParam : DEFAULT_CHAIN

  // Origin, rate limit, and daily cap are enforced by the /v1/* middleware above.
  try {
    const result = await resolve(c.env, addr, chain)
    c.header('Cache-Control', 'public, max-age=60')
    return c.json<LookupResult>(result)
  } catch (err) {
    if (err instanceof UpstreamError) {
      return c.json<LookupError>({ error: 'upstream_error' }, 503)
    }
    throw err
  }
})

// Layered cache per SPEC §4: stable kind lookup gates the expensive wallet call.
async function resolve(env: Env, addr: string, chain: Chain): Promise<LookupResult> {
  const kind = await cached(env, `kind:${chain}:${addr}`, KIND_TTL, async () => {
    const coinId = await detectTokenCoinId(env, addr, chain)
    return coinId ?? NOT_A_TOKEN
  })

  if (kind && kind !== NOT_A_TOKEN) {
    const token = await cached(env, `token:${kind}`, TOKEN_TTL, () => fetchTokenDetail(env, kind))
    if (token) {
      const sparkline = await cached(env, `chart:${kind}`, CHART_TTL, () => fetchChart(env, kind))
      return { kind: 'token', data: { ...token, sparkline: sparkline ?? [] } }
    }
  }

  const wallet = await cached(env, `wallet:${chain}:${addr}`, WALLET_TTL, () =>
    fetchWallet(env, addr, chain),
  )
  if (wallet && wallet.holdings.length > 0 && wallet.totalUsd > 0) {
    return { kind: 'wallet', data: wallet }
  }

  return { kind: 'unknown' }
}

app.get('/v1/fear-greed', async (c) => {
  try {
    const data = await cached(c.env, 'feargreed:latest', FEAR_GREED_TTL, () =>
      fetchFearGreed(c.env),
    )
    if (!data) {
      return c.json<LookupError>({ error: 'upstream_error' }, 503)
    }
    c.header('Cache-Control', 'public, max-age=300')
    return c.json(data)
  } catch (err) {
    if (err instanceof UpstreamError) {
      return c.json<LookupError>({ error: 'upstream_error' }, 503)
    }
    throw err
  }
})

// Unknown route — not an address-validation failure, so don't reuse a
// LookupErrorCode that would mislead the client into a wrong error message.
app.notFound((c) => c.json({ error: 'not_found' }, 404))

export default app
