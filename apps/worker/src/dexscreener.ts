import type { Chain, TokenSummary } from '@alphapeek/shared'
import { deriveTokenFlags } from './coinstats'
import type { Env } from './env'

// DexScreener uses its OWN chain-slug namespace (NOT CoinStats' COINS_CHAIN — e.g. `bsc`,
// not `binance_smart`; `polygon`, not `polygon-pos`). Verified live: `ethereum`, `bsc`.
// Only our 7 supported chains map; a pair on any other chain (linea, solana, …) is ignored,
// which both keeps the `Chain` type honest and bounds the scam surface.
const DEX_CHAIN: Record<string, Chain> = {
  ethereum: 'ethereum',
  bsc: 'bsc',
  polygon: 'polygon',
  base: 'base',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  avalanche: 'avalanche',
}

// Floor out dust/scam pairs: a confident card for a $50-liquidity honeypot is worse than
// the honest "no data" state. Above this we render and let the low_liquidity flag speak.
const MIN_LIQUIDITY_USD = 10_000

// Cap the call so a slow DexScreener can't push the lookup past the SPEC §7 cache-miss
// budget; on timeout we treat it as no-data (fall through to `unknown`), like any failure.
const FETCH_TIMEOUT_MS = 2500

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

// DexScreener encodes priceUsd as a string and the numeric fields as numbers; narrow either.
function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return 0
}

function str(rec: Record<string, unknown> | null, key: string): string {
  if (!rec) return ''
  const v = rec[key]
  return typeof v === 'string' ? v : ''
}

/**
 * Maps a raw DexScreener `/latest/dex/tokens/{addr}` payload to a token card, or null when
 * there's no usable pair. Selection: among pairs on a supported chain, pick the highest
 * `liquidity.usd`; below MIN_LIQUIDITY_USD → null. The chosen pair's `chainId` is the
 * AUTHORITATIVE chain (this is what rescues wrong-chain-inferred tokens). Pure + exported
 * for unit tests; `addr` is echoed into `coinId` (non-empty; the card links via `url`).
 */
export function normalizeDexToken(
  addr: string,
  payload: unknown,
): { token: TokenSummary; chain: Chain } | null {
  const pairsRaw = asRecord(payload)?.pairs
  if (!Array.isArray(pairsRaw)) return null

  let best: Record<string, unknown> | null = null
  let bestChain: Chain | null = null
  let bestLiq = 0
  for (const p of pairsRaw) {
    const pair = asRecord(p)
    if (!pair) continue
    const chain = DEX_CHAIN[str(pair, 'chainId')]
    if (!chain) continue
    const liq = num(asRecord(pair.liquidity)?.usd)
    if (liq > bestLiq) {
      bestLiq = liq
      best = pair
      bestChain = chain
    }
  }

  if (!best || !bestChain || bestLiq < MIN_LIQUIDITY_USD) return null

  // Prefer the side whose address is the queried token; fall back to baseToken.
  const base = asRecord(best.baseToken)
  const quote = asRecord(best.quoteToken)
  const lc = addr.toLowerCase()
  const tok =
    str(quote, 'address').toLowerCase() === lc && str(base, 'address').toLowerCase() !== lc
      ? quote
      : base

  const pCh24h = num(asRecord(best.priceChange)?.h24)
  const volume = num(asRecord(best.volume)?.h24)
  const marketCap = num(best.marketCap) || num(best.fdv)

  const token: TokenSummary = {
    coinId: addr,
    name: str(tok, 'name'),
    symbol: str(tok, 'symbol').toUpperCase(),
    imgUrl: str(asRecord(best.info), 'imageUrl'),
    price: num(best.priceUsd),
    pCh24h,
    marketCap,
    volume,
    // No free historical series on this endpoint; TokenView guards `length >= 2`, and a
    // fresh token has no 7d history anyway.
    sparkline: [],
    flags: deriveTokenFlags(volume, pCh24h),
    source: 'dexscreener',
    url: str(best, 'url'),
  }
  return { token, chain: bestChain }
}

/**
 * Best-effort, zero-credit token-coverage fallback. Used ONLY when CoinStats returned no
 * data for the address (see resolve() in index.ts) — never replaces a working CoinStats
 * path. NEVER throws: a failure, timeout, rate-limit, or empty result returns null so the
 * caller falls through to `unknown`. Free + keyless: no X-API-KEY, no CoinStats credit.
 */
export async function fetchDexToken(
  env: Env,
  addr: string,
): Promise<{ token: TokenSummary; chain: Chain } | null> {
  const url = `${env.DEXSCREENER_BASE_URL}/latest/dex/tokens/${encodeURIComponent(addr)}`
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) {
      // Visible in Workers observability without leaking anything; degradation is intentional.
      console.warn(`dexscreener fetch failed for ${addr}: HTTP ${res.status}`)
      return null
    }
    return normalizeDexToken(addr, (await res.json()) as unknown)
  } catch (cause) {
    console.warn(`dexscreener fetch errored for ${addr}: ${String(cause)}`)
    return null
  }
}

/**
 * v0.3 — Solana variant of normalizeDexToken. Among pairs whose `chainId` is `solana`, picks
 * the highest `liquidity.usd`; below MIN_LIQUIDITY_USD → null. Stamps `network:'solana'` +
 * `solMint` so the card links to a Solana explorer. Pure + exported for unit tests.
 */
export function normalizeDexSolToken(mint: string, payload: unknown): TokenSummary | null {
  const pairsRaw = asRecord(payload)?.pairs
  if (!Array.isArray(pairsRaw)) return null

  let best: Record<string, unknown> | null = null
  let bestLiq = 0
  for (const p of pairsRaw) {
    const pair = asRecord(p)
    if (!pair) continue
    if (str(pair, 'chainId') !== 'solana') continue
    const liq = num(asRecord(pair.liquidity)?.usd)
    if (liq > bestLiq) {
      bestLiq = liq
      best = pair
    }
  }

  if (!best || bestLiq < MIN_LIQUIDITY_USD) return null

  // Prefer the side whose address is the queried mint; fall back to baseToken. Solana base58
  // is case-sensitive, so match verbatim (no lowercasing, unlike the EVM path).
  const base = asRecord(best.baseToken)
  const quote = asRecord(best.quoteToken)
  const tok = str(quote, 'address') === mint && str(base, 'address') !== mint ? quote : base

  const pCh24h = num(asRecord(best.priceChange)?.h24)
  const volume = num(asRecord(best.volume)?.h24)
  const marketCap = num(best.marketCap) || num(best.fdv)

  return {
    coinId: mint,
    name: str(tok, 'name'),
    symbol: str(tok, 'symbol').toUpperCase(),
    imgUrl: str(asRecord(best.info), 'imageUrl'),
    price: num(best.priceUsd),
    pCh24h,
    marketCap,
    volume,
    sparkline: [],
    flags: deriveTokenFlags(volume, pCh24h),
    source: 'dexscreener',
    url: str(best, 'url'),
    network: 'solana',
    solMint: mint,
  }
}

/**
 * Best-effort, zero-credit Solana token fallback (v0.3) — same contract as fetchDexToken:
 * NEVER throws, returns null on any failure so the caller falls through to `unknown`.
 */
export async function fetchDexSolToken(env: Env, mint: string): Promise<TokenSummary | null> {
  const url = `${env.DEXSCREENER_BASE_URL}/latest/dex/tokens/${encodeURIComponent(mint)}`
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn(`dexscreener solana fetch failed for ${mint}: HTTP ${res.status}`)
      return null
    }
    return normalizeDexSolToken(mint, (await res.json()) as unknown)
  } catch (cause) {
    console.warn(`dexscreener solana fetch errored for ${mint}: ${String(cause)}`)
    return null
  }
}
