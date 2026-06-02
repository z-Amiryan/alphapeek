// Single source of truth for the Worker <-> extension contract. Keep it free of
// runtime dependencies — types and small const tables only — so any environment
// can import it.

export type Chain = 'ethereum' | 'bsc' | 'polygon' | 'base' | 'arbitrum' | 'optimism' | 'avalanche'

// v0.1 chains, in display order.
export const SUPPORTED_CHAINS: readonly Chain[] = [
  'ethereum',
  'bsc',
  'polygon',
  'base',
  'arbitrum',
  'optimism',
  'avalanche',
] as const

export const DEFAULT_CHAIN: Chain = 'ethereum'

export const CHAIN_LABELS: Record<Chain, string> = {
  ethereum: 'Ethereum',
  bsc: 'BNB Chain',
  polygon: 'Polygon',
  base: 'Base',
  arbitrum: 'Arbitrum',
  optimism: 'Optimism',
  avalanche: 'Avalanche',
}

export function isChain(value: string): value is Chain {
  return (SUPPORTED_CHAINS as readonly string[]).includes(value)
}

export type TokenSummary = {
  coinId: string
  name: string
  symbol: string
  imgUrl: string
  price: number
  pCh24h: number
  marketCap: number
  volume: number
  /** 7d price series, ~168 hourly points. May be empty if charts are unavailable. */
  sparkline: number[]
}

export type Holding = {
  symbol: string
  name: string
  imgUrl: string
  usd: number
  /** Share of total wallet value, 0-100. */
  pct: number
}

export type WalletSummary = {
  address: string
  chain: Chain
  totalUsd: number
  /** Sorted by USD value descending, top holdings only. */
  holdings: Holding[]
}

export type LookupResult =
  | { kind: 'token'; data: TokenSummary }
  | { kind: 'wallet'; data: WalletSummary }
  | { kind: 'unknown' }

export type LookupErrorCode =
  | 'invalid_address'
  | 'rate_limited'
  | 'daily_cap_reached'
  | 'upstream_error'

export type LookupError = { error: LookupErrorCode }

export type FearGreed = {
  value: number
  /** e.g. "Neutral", "Greed", "Extreme Fear". */
  label: string
}

export type Health = { ok: true; version: string }

// Extension <-> background service worker message protocol.

export type LookupRequest = {
  type: 'LOOKUP'
  addr: string
  chain: Chain
}

export type FearGreedRequest = {
  type: 'FEAR_GREED'
}

export type RuntimeRequest = LookupRequest | FearGreedRequest

// Discriminated envelope: errors surface as `{ ok: false }` rather than throwing
// across the message boundary, so callers branch on `ok` before touching `data`.
export type RuntimeResponse<T> = { ok: true; data: T } | { ok: false; error: LookupErrorCode }

export type LookupResponse = RuntimeResponse<LookupResult>
export type FearGreedResponse = RuntimeResponse<FearGreed>
