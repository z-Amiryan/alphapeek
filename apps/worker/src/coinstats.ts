import type { Chain, Holding, TokenSummary, WalletSummary } from '@alphapeek/shared'
import type { Env } from './env'

// Mapped to a 503 by the router so the extension shows a graceful error card.
export class UpstreamError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UpstreamError'
  }
}

// Our chain ids -> CoinStats blockchain slugs. Validate against
// `GET /wallet/blockchains` before production; the ones that differ (e.g. bsc) are risky.
const CS_CHAIN: Record<Chain, string> = {
  ethereum: 'ethereum',
  bsc: 'binance-smart-chain',
  polygon: 'polygon',
  base: 'base',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  avalanche: 'avalanche',
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
    blockchains: CS_CHAIN[chain],
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
  return {
    coinId,
    name: pickString(coin, 'name'),
    symbol: pickString(coin, 'symbol').toUpperCase(),
    imgUrl: pickString(coin, 'imgUrl', 'icon', 'image'),
    price: pickNumber(coin, 'price', 'priceUsd'),
    pCh24h: pickNumber(coin, 'priceChange1d', 'pCh24h', 'priceChange24h'),
    marketCap: pickNumber(coin, 'marketCap', 'marketCapUsd'),
    volume: pickNumber(coin, 'volume', 'volume24h', 'totalVolume'),
    sparkline: chartPoints,
  }
}

/** CoinStats charts come back as arrays of [timestamp, price, ...] tuples. */
export function normalizeChart(payload: unknown): number[] {
  const rows = pickArray(payload, 'chart', 'data')
  const out: number[] = []
  for (const row of rows) {
    if (Array.isArray(row) && typeof row[1] === 'number' && Number.isFinite(row[1])) {
      out.push(row[1])
    }
  }
  return out
}

export async function fetchToken(env: Env, coinId: string): Promise<TokenSummary> {
  const [details, chart] = await Promise.all([
    cs(env, `/coins/${encodeURIComponent(coinId)}`, {}),
    cs(env, `/coins/${encodeURIComponent(coinId)}/charts`, { period: '1w' }).catch(() => null),
  ])
  return normalizeToken(coinId, details, normalizeChart(chart))
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
    holdings.push({
      symbol: pickString(meta, 'symbol').toUpperCase(),
      name: pickString(meta, 'name'),
      imgUrl: pickString(meta, 'imgUrl', 'icon', 'image'),
      usd,
      pct: 0,
    })
  }

  const totalUsd = holdings.reduce((sum, h) => sum + h.usd, 0)
  for (const h of holdings) {
    h.pct = totalUsd > 0 ? (h.usd / totalUsd) * 100 : 0
  }
  holdings.sort((a, b) => b.usd - a.usd)

  return { address: addr, chain, totalUsd, holdings: holdings.slice(0, 5) }
}

export async function fetchWallet(env: Env, addr: string, chain: Chain): Promise<WalletSummary> {
  const payload = await cs(env, '/wallet/balance', {
    address: addr,
    blockchain: CS_CHAIN[chain],
  })
  return normalizeWallet(addr, chain, payload)
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
