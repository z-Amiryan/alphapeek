import type {
  Chain,
  Holding,
  TokenFlag,
  TokenSummary,
  WalletPnl,
  WalletSummary,
} from '@alphapeek/shared'
import type { Env } from './env'

// USD stablecoins (uppercased symbols incl. common bridged variants, e.g. Binance-Peg
// USDT shows as BSC-USD). Used to compute a wallet's risk-on-vs-parked ratio.
const STABLECOINS: ReadonlySet<string> = new Set([
  'USDT',
  'USDC',
  'DAI',
  'BUSD',
  'TUSD',
  'USDD',
  'FRAX',
  'USDP',
  'GUSD',
  'FDUSD',
  'USDE',
  'PYUSD',
  'LUSD',
  'SUSD',
  'USDC.E',
  'BSC-USD',
  'USDBC',
  'USDB',
  'CRVUSD',
  'GHO',
  'USDX',
  'USR',
])

// Heuristic token-flag thresholds — soft hints, NOT a security verdict (token-risk is v0.2).
const LOW_LIQUIDITY_VOLUME_USD = 50_000
const HIGH_VOLATILITY_ABS_PCT = 25

export function deriveTokenFlags(volume: number, pCh24h: number): TokenFlag[] {
  const flags: TokenFlag[] = []
  // Thin 24h volume → hard to exit without slippage. volume === 0 means missing data, not zero.
  if (volume > 0 && volume < LOW_LIQUIDITY_VOLUME_USD) flags.push('low_liquidity')
  if (Math.abs(pCh24h) >= HIGH_VOLATILITY_ABS_PCT) flags.push('high_volatility')
  return flags
}

// Mapped to a 503 by the router so the extension shows a graceful error card.
export class UpstreamError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UpstreamError'
  }
}

// CoinStats uses DIFFERENT network identifiers per endpoint (verified live 2026-06-02):
// `/coins?blockchains=` takes CoinStats' internal "chain" slugs (the `chain` field from
// `GET /wallet/blockchains`), NOT the doc's examples (the doc's `binance-smart-chain` returns
// 0 results). `/wallet/balance` keys off `connectionId` instead (see WALLET_CHAIN below) — it
// is NOT a `blockchain=` param. bsc diverges most: `binance_smart` for coins vs
// `binancesmartchain` for wallet — using the coins slug on the wallet call 503s every BSC
// fallthrough. Verified live 2026-06-02: ethereum, base, bsc (`binance_smart`), polygon-pos,
// arbitrum-one all resolve. optimism/avalanche follow the same convention but are UNVERIFIED.
const COINS_CHAIN: Record<Chain, string> = {
  ethereum: 'ethereum',
  bsc: 'binance_smart',
  polygon: 'polygon-pos',
  base: 'base',
  arbitrum: 'arbitrum-one',
  optimism: 'optimistic-ethereum',
  avalanche: 'avalanche',
}

// `/wallet/balance` keys off `connectionId` (from `GET /wallet/blockchains`), NOT a plain
// `blockchain` name — and the connectionIds carry a `-wallet` suffix (except ethereum/bsc).
// Passing the plain name 400s for every non-ethereum chain. Verified live 2026-06-02.
const WALLET_CHAIN: Record<Chain, string> = {
  ethereum: 'ethereum',
  bsc: 'binancesmartchain',
  polygon: 'polygon-wallet',
  base: 'base-wallet',
  arbitrum: 'arbitrum-wallet',
  optimism: 'optimism-wallet',
  avalanche: 'avalanche-wallet',
}

// The ONLY place X-API-KEY is attached. Never leak the key past this boundary.
async function cs(env: Env, path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(path, env.COINSTATS_BASE_URL)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        'X-API-KEY': env.COINSTATS_API_KEY,
        accept: 'application/json',
      },
    })
  } catch (cause) {
    throw new UpstreamError(`network error calling CoinStats: ${String(cause)}`)
  }

  if (!res.ok) {
    // Do NOT include response body or headers — could leak quota/account hints.
    throw new UpstreamError(`CoinStats responded ${res.status}`)
  }

  return (await res.json()) as unknown
}

// CoinStats field names vary across endpoints (id vs coinId, imgUrl vs icon),
// so these accessors try several candidate keys and narrow from `unknown`.
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function pickString(rec: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = rec[key]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return ''
}

function pickNumber(rec: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const v = rec[key]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  }
  return 0
}

/** Extracts the first array found either at the top level or under common wrapper keys. */
function pickArray(value: unknown, ...wrapperKeys: string[]): unknown[] {
  if (Array.isArray(value)) return value
  const rec = asRecord(value)
  if (rec) {
    for (const key of wrapperKeys) {
      if (Array.isArray(rec[key])) return rec[key] as unknown[]
    }
  }
  return []
}

export async function detectTokenCoinId(
  env: Env,
  addr: string,
  chain: Chain,
): Promise<string | null> {
  // Must be `contractAddresses` (plural): the singular form is ignored and the
  // API returns the chain's top-ranked coin, misdetecting every address as a token.
  const payload = await cs(env, '/coins', {
    blockchains: COINS_CHAIN[chain],
    contractAddresses: addr,
    limit: '1',
  })
  const coins = pickArray(payload, 'result', 'coins')
  const first = asRecord(coins[0])
  if (!first) return null
  const coinId = pickString(first, 'id', 'coinId')
  return coinId.length > 0 ? coinId : null
}

export function normalizeToken(
  coinId: string,
  details: unknown,
  chartPoints: number[],
): TokenSummary {
  const rec = asRecord(details) ?? {}
  const coin = asRecord(rec.coin) ?? asRecord(rec.result) ?? rec
  const pCh24h = pickNumber(coin, 'priceChange1d', 'pCh24h', 'priceChange24h')
  const volume = pickNumber(coin, 'volume', 'volume24h', 'totalVolume')
  return {
    coinId,
    name: pickString(coin, 'name'),
    symbol: pickString(coin, 'symbol').toUpperCase(),
    imgUrl: pickString(coin, 'imgUrl', 'icon', 'image'),
    price: pickNumber(coin, 'price', 'priceUsd'),
    pCh24h,
    marketCap: pickNumber(coin, 'marketCap', 'marketCapUsd'),
    volume,
    sparkline: chartPoints,
    flags: deriveTokenFlags(volume, pCh24h),
    source: 'coinstats',
  }
}

// `/coins/charts` returns `[{ coinId, chart: [[ts, usd, btc, eth], …] }]`; drill into the
// first coin's `chart`. Also tolerates a bare tuple array in case the shape changes back.
export function normalizeChart(payload: unknown): number[] {
  let rows = pickArray(payload, 'chart', 'data')
  const firstRec = asRecord(rows[0])
  if (firstRec && Array.isArray(firstRec.chart)) {
    rows = firstRec.chart as unknown[]
  }
  const out: number[] = []
  for (const row of rows) {
    if (Array.isArray(row) && typeof row[1] === 'number' && Number.isFinite(row[1])) {
      out.push(row[1])
    }
  }
  return out
}

// Token detail WITHOUT the chart — the sparkline is fetched and cached separately
// (see fetchChart + index.ts) so a flaky chart call can't pin an empty sparkline on
// the whole token entry for the token TTL.
export async function fetchTokenDetail(env: Env, coinId: string): Promise<TokenSummary> {
  const details = await cs(env, `/coins/${encodeURIComponent(coinId)}`, {})
  return normalizeToken(coinId, details, [])
}

// Best-effort 7-day sparkline. Returns `null` on failure OR an empty result so the
// cache layer (which never stores `null`) retries on the next request instead of
// caching a blank chart — while a real chart gets cached on its own longer TTL.
// Correct endpoint is `/coins/charts?coinIds=…` (plural); the per-coin
// `/coins/{id}/charts` path 404s.
export async function fetchChart(env: Env, coinId: string): Promise<number[] | null> {
  // Log before swallowing so a credit storm / expired key (401) / 429 is visible in
  // Workers observability — degradation is intentional, silence is not. console.warn
  // (not .log) is allowed by Biome and is the Workers-runtime way to reach logs.
  const payload = await cs(env, '/coins/charts', { coinIds: coinId, period: '1w' }).catch(
    (err: unknown) => {
      console.warn(`chart fetch failed for ${coinId}: ${String(err)}`)
      return null
    },
  )
  if (payload === null) return null
  const points = normalizeChart(payload)
  return points.length > 0 ? points : null
}

export function normalizeWallet(addr: string, chain: Chain, payload: unknown): WalletSummary {
  const items = pickArray(payload, 'balances', 'result', 'data')
  const holdings: Holding[] = []
  for (const item of items) {
    const rec = asRecord(item)
    if (!rec) continue
    // Coin metadata may be flat on the item or nested under `coin`; nested wins.
    const nested = asRecord(rec.coin)
    const meta: Record<string, unknown> = nested ? { ...rec, ...nested } : rec
    const amount = pickNumber(meta, 'amount', 'balance')
    const price = pickNumber(meta, 'price', 'priceUsd')
    const usd = pickNumber(meta, 'usd', 'balanceUSD', 'valueUsd') || amount * price
    if (usd <= 0) continue
    const coinId = pickString(meta, 'coinId', 'id')
    holdings.push({
      // Omit when absent so the client can branch on its presence (`coinId?`).
      ...(coinId ? { coinId } : {}),
      symbol: pickString(meta, 'symbol').toUpperCase(),
      name: pickString(meta, 'name'),
      imgUrl: pickString(meta, 'imgUrl', 'icon', 'image'),
      usd,
      pct: 0,
    })
  }

  const totalUsd = holdings.reduce((sum, h) => sum + h.usd, 0)
  // Sum stables over the FULL list, before the top-5 slice, so the ratio stays accurate
  // even when stablecoins fall outside the displayed holdings.
  const stableUsd = holdings.reduce((sum, h) => (STABLECOINS.has(h.symbol) ? sum + h.usd : sum), 0)
  for (const h of holdings) {
    h.pct = totalUsd > 0 ? (h.usd / totalUsd) * 100 : 0
  }
  holdings.sort((a, b) => b.usd - a.usd)

  return {
    address: addr,
    chain,
    totalUsd,
    holdings: holdings.slice(0, 5),
    stablecoinPct: totalUsd > 0 ? (stableUsd / totalUsd) * 100 : 0,
  }
}

export async function fetchWallet(env: Env, addr: string, chain: Chain): Promise<WalletSummary> {
  const payload = await cs(env, '/wallet/balance', {
    address: addr,
    connectionId: WALLET_CHAIN[chain],
  })
  return normalizeWallet(addr, chain, payload)
}

// CoinStats `/wallet/pl` profit buckets are sometimes a plain number (USD / percent)
// and sometimes a `{ USD, BTC, ETH }` object — read either. Returns null (not 0) when
// the bucket is absent so a real $0 PnL isn't conflated with "no data".
function readPnlBucket(rec: Record<string, unknown>, bucket: string): number | null {
  const v = rec[bucket]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  const obj = asRecord(v)
  if (obj) {
    const usd = obj.USD ?? obj.usd
    if (typeof usd === 'number' && Number.isFinite(usd)) return usd
    if (typeof usd === 'string' && usd.trim() !== '' && Number.isFinite(Number(usd))) {
      return Number(usd)
    }
  }
  return null
}

// CoinStats has no 30-day bucket; we surface all-time PnL from `summary` (see
// WalletPnl). Returns null when neither the absolute nor the percent all-time
// figure is present, so the wallet card simply omits the PnL line.
export function normalizeWalletPnl(payload: unknown): WalletPnl | null {
  const root = asRecord(payload) ?? {}
  const summary = asRecord(root.summary)
  if (!summary) return null
  const profit = asRecord(summary.profit)
  const profitPercent = asRecord(summary.profitPercent)
  const absUsd = profit ? readPnlBucket(profit, 'allTime') : null
  const pct = profitPercent ? readPnlBucket(profitPercent, 'allTime') : null
  if (absUsd === null && pct === null) return null
  return { window: 'all_time', absUsd: absUsd ?? 0, pct: pct ?? 0 }
}

// Best-effort: a PnL failure (e.g. a 429 on the extra call) must NOT 503 the whole
// wallet lookup, so swallow to null and let the card render without the PnL line.
// 25 credits — only call this once a wallet is confirmed (see resolve() in index.ts).
export async function fetchWalletPnl(
  env: Env,
  addr: string,
  chain: Chain,
): Promise<WalletPnl | null> {
  const payload = await cs(env, '/wallet/pl', {
    address: addr,
    connectionId: WALLET_CHAIN[chain],
  }).catch((err: unknown) => {
    console.warn(`wallet pnl fetch failed for ${addr}: ${String(err)}`)
    return null
  })
  if (payload === null) return null
  return normalizeWalletPnl(payload)
}

export function normalizeFearGreed(payload: unknown): { value: number; label: string } {
  const rec = asRecord(payload) ?? {}
  const inner = asRecord(rec.now) ?? asRecord(rec.data) ?? rec
  const value = pickNumber(inner, 'value', 'now', 'index')
  let label = pickString(inner, 'value_classification', 'classification', 'label')
  if (label.length === 0) {
    label =
      value >= 75
        ? 'Extreme Greed'
        : value >= 55
          ? 'Greed'
          : value >= 45
            ? 'Neutral'
            : value >= 25
              ? 'Fear'
              : 'Extreme Fear'
  }
  return { value, label }
}

export async function fetchFearGreed(env: Env): Promise<{ value: number; label: string }> {
  const payload = await cs(env, '/insights/fear-and-greed', {})
  return normalizeFearGreed(payload)
}
