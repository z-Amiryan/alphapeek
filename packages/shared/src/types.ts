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

/**
 * Heuristic, market-data-derived hints — NOT a security verdict. Surfaced as soft
 * badges on the token card. Token-risk scoring (honeypot/ownership) is deferred (ROADMAP).
 */
export type TokenFlag = 'low_liquidity' | 'high_volatility'

/**
 * Worker-computed safety verdict from a third-party contract scan (GoPlus). Unlike
 * `TokenFlag` (our own market-data heuristic), this reflects on-chain contract
 * properties — honeypot, taxes, mint/owner privileges. Still a third-party signal,
 * NOT a guarantee: surface it with a "not financial advice" disclaimer.
 */
export type SafetyVerdict = 'safe' | 'caution' | 'danger' | 'unknown'

export type SafetyFlag =
  | 'honeypot'
  | 'cant_sell_all'
  | 'high_buy_tax'
  | 'high_sell_tax'
  | 'mintable'
  | 'owner_privileges'
  | 'proxy'
  | 'unverified_source'
  | 'blacklist'
  | 'transfer_pausable'

export type TokenSafety = {
  verdict: SafetyVerdict
  /** Buy/sell tax as a percentage (e.g. 5 = 5%). Null when the scan didn't report it. */
  buyTaxPct: number | null
  sellTaxPct: number | null
  /** Verdict-driving risk findings, severity-ranked (most-severe first). */
  flags: SafetyFlag[]
  /**
   * Informational capabilities (mintable supply, proxy/upgradeable, blacklist
   * function) — common on legitimate tokens (e.g. CAKE is mintable, AAVE is a
   * proxy), so they're surfaced for diligence but NEVER raise the verdict.
   */
  notes: SafetyFlag[]
  /** Attribution for the UI disclaimer; only source in v0.2. */
  source: 'goplus'
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
  /** Derived market-data hints (low_liquidity, high_volatility). Never a safety guarantee. */
  flags: TokenFlag[]
  /**
   * Third-party contract-safety scan. Optional/best-effort: absent when the scan
   * is unavailable, rate-limited, or the chain is unsupported by the provider —
   * the card renders fully without it.
   */
  safety?: TokenSafety
}

export type Holding = {
  /**
   * CoinStats coin id / slug (e.g. "ethereum", "pepe"), used to deep-link the
   * holding to `coinstats.app/coins/{coinId}`. Optional: absent for un-indexed
   * tokens, in which case the row is rendered non-clickable.
   */
  coinId?: string
  symbol: string
  name: string
  imgUrl: string
  usd: number
  /** Share of total wallet value, 0-100. */
  pct: number
}

/**
 * Wallet performance. "Is this wallet actually winning?" — the smart-money read
 * for KOL/whale addresses. From CoinStats `/wallet/pl` (no extra external API),
 * extra credit cost → a deliberate v0.2 addition. CoinStats exposes fixed buckets
 * (allTime, 24h, unrealized, realized) — NOT a 30-day window — so v0.2 surfaces
 * all-time PnL, the strongest "ever been profitable" signal.
 */
export type WalletPnl = {
  window: 'all_time'
  /** Absolute profit/loss in USD (may be negative). */
  absUsd: number
  /** Profit/loss as a percentage (may be negative). */
  pct: number
}

export type WalletSummary = {
  address: string
  chain: Chain
  totalUsd: number
  /** Sorted by USD value descending, top holdings only. */
  holdings: Holding[]
  /**
   * Share of total wallet value held in USD stablecoins, 0-100. Computed over the
   * FULL holdings list before the top-N slice, so it's accurate even when stables
   * fall outside the displayed holdings. "Risk-on vs parked in stables" signal.
   */
  stablecoinPct: number
  /**
   * 30-day PnL. Optional/best-effort: absent when CoinStats doesn't return it for
   * the address — the card renders fully without it.
   */
  pnl?: WalletPnl
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
