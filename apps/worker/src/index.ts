import type { Chain, Health, LookupError, LookupResult } from '@alphapeek/shared'
import { DEFAULT_CHAIN, isChain } from '@alphapeek/shared'
import { Hono } from 'hono'
import { cached } from './cache'
import {
  type SafetyTarget,
  UpstreamError,
  detectSolanaTokenCoinId,
  detectTokenCoinId,
  fetchChart,
  fetchCoinDetailRaw,
  fetchFearGreed,
  fetchWallet,
  fetchWalletPnl,
  normalizeToken,
  pickSafetyTarget,
  resolveSymbolToCoinId,
} from './coinstats'
import { fetchDexSolToken, fetchDexToken } from './dexscreener'
import { type Env, WORKER_VERSION } from './env'
import { fetchSolanaTokenSafety, fetchTokenSafety } from './goplus'
import { withinDailyCap, withinIpLimit } from './ratelimit'

const ADDRESS_RE = /^0x[a-f0-9]{40}$/
// CoinStats coin-id (e.g. `pepe`, `pancakeswap-token`, or a case-sensitive
// `<base58>_solana` for non-EVM coins). The ticker path only sends ids from our top-1000
// whitelist, but validate defensively. Case is preserved — CoinStats ids are
// case-sensitive (lowercasing a Solana base58 id 404s it).
const COIN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/
// A bare cashtag SYMBOL (uppercased), letter-led. The extension only sends long-tail
// (non-whitelisted) symbols here; validate defensively against the resolution endpoint.
const SYMBOL_RE = /^[A-Z][A-Z0-9]{1,10}$/
// A Solana mint (base58, 32–44 chars — case-sensitive, so NOT lowercased). The extension
// pre-flights every base58 candidate here; validate defensively before any upstream call.
const SOL_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

// Kind-cache sentinel for addresses that are not token contracts.
const NOT_A_TOKEN = 'addr:'
// symid: cache sentinel for a cashtag SYMBOL with no confident single match — lets the
// negative result be cached (the cache layer never stores null) so a slang $WORD doesn't
// re-burn the ~5-credit symbol search on every hover.
const NO_SYMBOL_MATCH = '-'

const DAY = 60 * 60 * 24
// A real token contract's type is permanent → cache a positive coinId for a month. But a
// MISS is often just CoinStats' few-hour indexing lag (SPEC §9), so the NOT_A_TOKEN
// sentinel gets a short TTL: a freshly-indexed token then upgrades from the DexScreener
// fallback to the full CoinStats card (7d chart) within hours, not 30 days. The re-detect
// cost is negligible — every NOT_A_TOKEN path already does the 40cr wallet call (300s TTL),
// which dwarfs the 5cr re-detect.
const KIND_TTL = 30 * DAY
const NOT_A_TOKEN_TTL = 6 * 60 * 60
const TOKEN_TTL = 60
// The 7d sparkline is hourly data, so it can outlive the 60s price refresh; a longer
// TTL also cuts the ~3-credit chart call. Cached apart from the token so a chart hiccup
// degrades to "no chart this request" (retried next time), never a blank-for-TOKEN_TTL.
const CHART_TTL = 900
// Contract-safety properties change slowly, but an ownership renounce / blacklist
// flip should surface same-day, so 6h balances freshness against GoPlus load.
const SAFETY_TTL = 6 * 60 * 60
const WALLET_TTL = 300
const FEAR_GREED_TTL = 300
// Short — DexScreener-sourced tokens are fresh/long-tail and move fast; still long enough
// to collapse a viral burst on one address against DexScreener's per-IP rate limit.
const DEX_TTL = 60
// A symbol→coinId mapping is stable, and the search costs ~5 credits, so cache it (incl.
// the NO_SYMBOL_MATCH negative) for a day. This bounds the long-tail cashtag path to at
// most one symbol search per symbol per day — the price data still refreshes via the
// short token:/chart: TTLs inside buildToken.
const SYMBOL_ID_TTL = DAY

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

// v0.2 — $TICKER path. The extension resolves a cashtag to a coinId via its preloaded
// top-1000 whitelist and looks it up here. The safety chain is derived from the coin's
// contractAddresses (pickSafetyTarget), so no chain param is needed.
app.get('/v1/coin', async (c) => {
  const coinId = c.req.query('coinId') ?? ''
  if (!COIN_ID_RE.test(coinId)) {
    return c.json<LookupError>({ error: 'invalid_address' }, 400)
  }

  try {
    const result = (await buildToken(c.env, coinId, 'derive')) ?? { kind: 'unknown' }
    c.header('Cache-Control', 'public, max-age=60')
    return c.json<LookupResult>(result)
  } catch (err) {
    if (err instanceof UpstreamError) {
      return c.json<LookupError>({ error: 'upstream_error' }, 503)
    }
    throw err
  }
})

// v0.2 — long-tail cashtag path. A $SYMBOL the extension couldn't resolve from its
// top-1000 whitelist. We resolve it to a single canonical coin via `/coins?symbol=`
// (single-match + market-cap guard — silent on the reused-ticker trap) and then reuse
// the ticker card path. Coverage is EVM-only and CoinStats-indexed; fresh micro-caps
// (largely Solana) stay `unknown` by design (see ROADMAP / SPEC §9).
app.get('/v1/symbol', async (c) => {
  const symbol = (c.req.query('symbol') ?? '').toUpperCase()
  if (!SYMBOL_RE.test(symbol)) {
    return c.json<LookupError>({ error: 'invalid_address' }, 400)
  }

  try {
    const resolved = await cached(
      c.env,
      `symid:${symbol}`,
      SYMBOL_ID_TTL,
      async () => (await resolveSymbolToCoinId(c.env, symbol)) ?? NO_SYMBOL_MATCH,
    )
    const result: LookupResult =
      resolved && resolved !== NO_SYMBOL_MATCH
        ? ((await buildToken(c.env, resolved, 'derive')) ?? { kind: 'unknown' })
        : { kind: 'unknown' }
    c.header('Cache-Control', 'public, max-age=60')
    return c.json<LookupResult>(result)
  } catch (err) {
    if (err instanceof UpstreamError) {
      return c.json<LookupError>({ error: 'upstream_error' }, 503)
    }
    throw err
  }
})

// v0.3 — Solana token (mint) path. A base58 mint detected on X (or pasted). The extension
// pre-flights every candidate here and mounts only on a `token` result, so a base58 false
// positive costs a cached probe, never a wrong card. EVM-only `/v1/lookup` can't serve these
// (a mint fails its 0x…40hex guard), hence a dedicated route + Solana-native resolution.
app.get('/v1/sol', async (c) => {
  const mint = c.req.query('mint') ?? ''
  if (!SOL_MINT_RE.test(mint)) {
    return c.json<LookupError>({ error: 'invalid_address' }, 400)
  }

  try {
    const result = await resolveSolana(c.env, mint)
    c.header('Cache-Control', 'public, max-age=60')
    return c.json<LookupResult>(result)
  } catch (err) {
    if (err instanceof UpstreamError) {
      return c.json<LookupError>({ error: 'upstream_error' }, 503)
    }
    throw err
  }
})

// Assembles a token card from a coinId: cached raw detail (so we can also derive the
// safety target) + parallel cached chart + cached GoPlus safety. Shared by the address
// path (explicit target = the hovered contract+chain), the Solana mint path (explicit
// Solana target), and the ticker path ('derive' = target read from contractAddresses,
// EVM-first then Solana). Returns null if the detail is empty.
async function buildToken(
  env: Env,
  coinId: string,
  safety: SafetyTarget | 'derive',
): Promise<LookupResult | null> {
  const detail = await cached(env, `token:${coinId}`, TOKEN_TTL, () =>
    fetchCoinDetailRaw(env, coinId),
  )
  if (!detail) return null
  const token = normalizeToken(coinId, detail, [])
  const target = safety === 'derive' ? pickSafetyTarget(detail) : safety
  const isSol = target !== null && 'network' in target
  // Chart and safety are independent, best-effort, each on its own TTL — fan out in
  // parallel so neither stacks onto the detail latency. The safety call routes to the
  // GoPlus-EVM or GoPlus-Solana endpoint by the target's shape.
  const [sparkline, safetyResult] = await Promise.all([
    cached(env, `chart:${coinId}`, CHART_TTL, () => fetchChart(env, coinId)),
    target === null
      ? Promise.resolve(null)
      : isSol
        ? cached(env, `safety:solana:${target.mint}`, SAFETY_TTL, () =>
            fetchSolanaTokenSafety(env, target.mint),
          )
        : cached(env, `safety:${target.chain}:${target.contract}`, SAFETY_TTL, () =>
            fetchTokenSafety(env, target.contract, target.chain),
          ),
  ])
  return {
    kind: 'token',
    data: {
      ...token,
      sparkline: sparkline ?? [],
      ...(safetyResult ? { safety: safetyResult } : {}),
      // A Solana coin's coinId may be a canonical slug (`bonk`), not the mint, so carry the
      // mint from the derived/explicit target for the card's solscan link.
      ...(isSol ? { network: 'solana' as const, solMint: target.mint } : {}),
    },
  }
}

// Layered cache per SPEC §4: stable kind lookup gates the expensive wallet call. This is a
// hand-rolled read-through (not `cached`) because the TTL depends on the result — a positive
// coinId is permanent (KIND_TTL), a miss is short-lived (NOT_A_TOKEN_TTL, see above).
async function resolve(env: Env, addr: string, chain: Chain): Promise<LookupResult> {
  const kindKey = `kind:${chain}:${addr}`
  // JSON-encoded to stay wire-compatible with entries written by `cached()` before this
  // read-through existed (a plain-string read would mis-parse those across the deploy).
  const hit = await env.CACHE.get(kindKey, 'json')
  let kind = typeof hit === 'string' ? hit : null
  if (kind === null) {
    const coinId = await detectTokenCoinId(env, addr, chain)
    kind = coinId ?? NOT_A_TOKEN
    await env.CACHE.put(kindKey, JSON.stringify(kind), {
      expirationTtl: coinId ? KIND_TTL : NOT_A_TOKEN_TTL,
    })
  }

  if (kind !== NOT_A_TOKEN) {
    // Safety target is the hovered contract on the inferred chain (no derivation needed).
    const result = await buildToken(env, kind, { chain, contract: addr })
    if (result) return result
  }

  const wallet = await cached(env, `wallet:${chain}:${addr}`, WALLET_TTL, () =>
    fetchWallet(env, addr, chain),
  )
  if (wallet && wallet.holdings.length > 0 && wallet.totalUsd > 0) {
    // Only spend the extra 25-credit PnL call once the address is a confirmed
    // wallet — never on token/unknown fallthroughs. Best-effort + cached.
    const pnl = await cached(env, `pnl:${chain}:${addr}`, WALLET_TTL, () =>
      fetchWalletPnl(env, addr, chain),
    )
    return { kind: 'wallet', data: { ...wallet, ...(pnl ? { pnl } : {}) } }
  }

  // CoinStats had nothing (not a token, not a wallet). Try the free, zero-credit DexScreener
  // fallback before giving up — it covers fresh / long-tail / wrong-chain-inferred tokens
  // CoinStats hasn't indexed. CoinStats-first is preserved: this only runs on a miss. The
  // pair's chain is authoritative, so a wrong `chain` guess no longer hides an indexed token.
  const dex = await cached(env, `dex:${addr}`, DEX_TTL, () => fetchDexToken(env, addr))
  if (dex) {
    const safety = await cached(env, `safety:${dex.chain}:${addr}`, SAFETY_TTL, () =>
      fetchTokenSafety(env, addr, dex.chain),
    )
    return { kind: 'token', data: { ...dex.token, ...(safety ? { safety } : {}) } }
  }

  return { kind: 'unknown' }
}

// v0.3 — Solana mint resolution. Mirrors resolve()'s CoinStats-first shape: a stable
// `solkind:` cache (canonical coinId for a month / NOT_A_TOKEN miss for hours) gates the
// search, then CoinStats serves the card (with derived Solana safety), else the free
// DexScreener-Solana fallback, else `unknown`. The NOT_A_TOKEN sentinel negative-caches
// base58 false positives so detection noise doesn't re-burn the request cap.
async function resolveSolana(env: Env, mint: string): Promise<LookupResult> {
  const kindKey = `solkind:${mint}`
  const hit = await env.CACHE.get(kindKey, 'json')
  let kind = typeof hit === 'string' ? hit : null
  if (kind === null) {
    const coinId = await detectSolanaTokenCoinId(env, mint)
    kind = coinId ?? NOT_A_TOKEN
    await env.CACHE.put(kindKey, JSON.stringify(kind), {
      expirationTtl: coinId ? KIND_TTL : NOT_A_TOKEN_TTL,
    })
  }

  if (kind !== NOT_A_TOKEN) {
    // Safety target is the hovered mint (explicit), so buildToken scans GoPlus-Solana directly.
    const result = await buildToken(env, kind, { network: 'solana', mint })
    if (result) return result
  }

  // CoinStats hasn't indexed this mint — try the free, zero-credit DexScreener-Solana
  // fallback (fresh / unindexed pump.fun mints) before giving up.
  const dex = await cached(env, `dex:${mint}`, DEX_TTL, () => fetchDexSolToken(env, mint))
  if (dex) {
    const safety = await cached(env, `safety:solana:${mint}`, SAFETY_TTL, () =>
      fetchSolanaTokenSafety(env, mint),
    )
    return { kind: 'token', data: { ...dex, ...(safety ? { safety } : {}) } }
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
