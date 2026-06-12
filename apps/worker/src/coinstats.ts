import {
  type Chain,
  type Holding,
  SUPPORTED_CHAINS,
  type TokenFlag,
  type TokenSummary,
  type WalletPnl,
  type WalletSummary,
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

// Inverse of COINS_CHAIN. A coin's contractAddresses[].blockchain uses the SAME slug
// namespace as `/coins?blockchains=` (verified live 2026-06-09), so each slug maps
// straight back to one of our Chains. Derived from COINS_CHAIN so the two can't drift.
const CHAIN_BY_COINS_SLUG: Record<string, Chain> = Object.fromEntries(
  SUPPORTED_CHAINS.map((c): [string, Chain] => [COINS_CHAIN[c], c]),
)

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

// Resolves a contract/mint to its canonical CoinStats coinId via the `/coins` filter, or
// null. Must be `contractAddresses` (plural): the singular form is ignored and the API
// returns the chain's top-ranked coin, misdetecting every address as a token.
async function detectCoinIdByContract(
  env: Env,
  coinsSlug: string,
  addr: string,
): Promise<string | null> {
  const payload = await cs(env, '/coins', {
    blockchains: coinsSlug,
    contractAddresses: addr,
    limit: '1',
  })
  const coins = pickArray(payload, 'result', 'coins')
  const first = asRecord(coins[0])
  if (!first) return null
  const coinId = pickString(first, 'id', 'coinId')
  return coinId.length > 0 ? coinId : null
}

export async function detectTokenCoinId(
  env: Env,
  addr: string,
  chain: Chain,
): Promise<string | null> {
  return detectCoinIdByContract(env, COINS_CHAIN[chain], addr)
}

// v0.3 — Solana mint → canonical coinId. We must SEARCH for the id, never construct
// `<mint>_solana`: for a canonical mega-cap that 404s (BONK's id is `bonk`, verified live),
// whereas a long-tail coin's id genuinely is `<mint>_solana`. The search returns whichever.
export async function detectSolanaTokenCoinId(env: Env, mint: string): Promise<string | null> {
  return detectCoinIdByContract(env, 'solana', mint)
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

// Raw `/coins/{id}` payload, returned un-normalized so a single fetch feeds BOTH
// normalizeToken and pickSafetyTarget — the ticker path needs contractAddresses to
// derive a GoPlus scan target without a second call. The chart is fetched + cached
// separately (see fetchChart + buildToken) so a flaky chart can't pin a blank sparkline.
export async function fetchCoinDetailRaw(env: Env, coinId: string): Promise<unknown> {
  return cs(env, `/coins/${encodeURIComponent(coinId)}`, {})
}

// A GoPlus scan target: an EVM (chain, contract) — scanned by the chain-id GoPlus-EVM
// endpoint — or a Solana mint — scanned by the GoPlus-Solana endpoint (v0.3). Discriminated
// by the presence of `network`. Shared by the address/mint paths (explicit) and the ticker
// path ('derive').
export type SafetyTarget = { chain: Chain; contract: string } | { network: 'solana'; mint: string }

// Derives the GoPlus scan target from a coin's contractAddresses — the ticker path has no
// hovered address. EVM is preferred (GoPlus-EVM is calibrated there and a multichain coin's
// EVM deployment is the safer scan): prefers the canonical singular `contractAddress`
// deployment (verified: CAKE's single is its BSC-native entry, not the ETH bridge), then
// ethereum, then SUPPORTED_CHAINS order. Falls back to a Solana mint when the coin has NO
// supported-EVM deployment (v0.3 — e.g. a Solana-native coin like $GOAT). Null when neither.
export function pickSafetyTarget(detail: unknown): SafetyTarget | null {
  const rec = asRecord(detail)
  const coin = asRecord(rec?.coin) ?? asRecord(rec?.result) ?? rec
  if (!coin) return null
  const entries = Array.isArray(coin.contractAddresses) ? coin.contractAddresses : []
  const candidates: { chain: Chain; contract: string }[] = []
  let solMint = ''
  for (const entry of entries) {
    const er = asRecord(entry)
    if (!er) continue
    const slug = pickString(er, 'blockchain')
    const contract = pickString(er, 'contractAddress')
    const chain = CHAIN_BY_COINS_SLUG[slug]
    if (chain && contract) candidates.push({ chain, contract })
    else if (slug === 'solana' && contract && !solMint) solMint = contract
  }
  const canonical = pickString(coin, 'contractAddress').toLowerCase()
  // Canonical-first across BOTH ecosystems. CoinStats sets the top-level `contractAddress`
  // to the coin's canonical deployment (verified live: dogwifcoin's is its Solana mint). So a
  // Solana-canonical coin scans Solana even when it ALSO has an EVM bridge — its `$cashtag`
  // verdict then matches its mint-hover verdict, and a bridge contract's admin keys can't raise
  // a false "Caution" on a legit Solana coin. Otherwise EVM-first (GoPlus-EVM is calibrated, and
  // a multichain coin's EVM deployment is the safer scan), then any Solana deployment.
  if (solMint && canonical && solMint.toLowerCase() === canonical) {
    return { network: 'solana', mint: solMint }
  }
  const evm =
    candidates.find((c) => c.contract.toLowerCase() === canonical) ??
    candidates.find((c) => c.chain === 'ethereum') ??
    [...candidates].sort(
      (a, b) => SUPPORTED_CHAINS.indexOf(a.chain) - SUPPORTED_CHAINS.indexOf(b.chain),
    )[0]
  if (evm) return evm
  return solMint ? { network: 'solana', mint: solMint } : null
}

// Long-tail cashtag resolution. A $SYMBOL outside our top-1000 whitelist is genuinely
// ambiguous — many coins reuse a ticker (e.g. ~19 distinct "MOON"s). Resolving to the
// highest-cap match would routinely surface a confident WRONG token, which for a trust
// tool is worse than no card. So this floor + single-match guard is the precision filter.
const MIN_SYMBOL_MARKET_CAP_USD = 50_000

// A coin we can both show and safety-scan: a supported-EVM deployment, or (v0.3) a Solana
// one (GoPlus-Solana scans it; solscan links it). Other chains stay out — we can't scan them.
function hasShowableDeployment(coin: Record<string, unknown>): boolean {
  const entries = Array.isArray(coin.contractAddresses) ? coin.contractAddresses : []
  for (const entry of entries) {
    const er = asRecord(entry)
    if (!er) continue
    const slug = pickString(er, 'blockchain')
    if (CHAIN_BY_COINS_SLUG[slug] || slug === 'solana') return true
  }
  return false
}

// Picks the single canonical coinId for a bare cashtag SYMBOL from a `/coins?symbol=`
// payload, or null. A candidate must (a) match the symbol exactly, (b) have a showable
// deployment (supported-EVM or Solana), and (c) clear the dust floor. Resolves ONLY when
// exactly one candidate survives — multiple contenders (the reused-ticker trap) return null
// so the card stays silent rather than guess wrong. Note: this means a contested Solana
// ticker with two real coins above the floor (e.g. $GOAT — Goatseus + Sonic The Goat) stays
// silent by design; precision over coverage on the long tail (whitelisted coins are exempt).
export function pickSymbolMatch(payload: unknown, symbol: string): string | null {
  const coins = pickArray(payload, 'result', 'coins')
  const want = symbol.toUpperCase()
  const matches: string[] = []
  for (const coin of coins) {
    const rec = asRecord(coin)
    if (!rec) continue
    if (pickString(rec, 'symbol').toUpperCase() !== want) continue
    if (pickNumber(rec, 'marketCap', 'marketCapUsd') < MIN_SYMBOL_MARKET_CAP_USD) continue
    if (!hasShowableDeployment(rec)) continue
    const id = pickString(rec, 'id', 'coinId')
    if (id) matches.push(id)
    if (matches.length > 1) return null // ambiguous — bail before reading the rest
  }
  return matches.length === 1 ? (matches[0] ?? null) : null
}

// Resolves a long-tail cashtag to a canonical coinId via `/coins?symbol=`, or null.
// Sorted by rank asc (sortBy=marketCap is broken — pulls deep-rank coins forward), with
// a generous page so the single-match guard sees every same-symbol contender. ~5 credits,
// so the caller caches the result (incl. the negative) on a long TTL (see index.ts).
export async function resolveSymbolToCoinId(env: Env, symbol: string): Promise<string | null> {
  const payload = await cs(env, '/coins', {
    symbol,
    limit: '100',
    sortBy: 'rank',
    sortDir: 'asc',
  })
  return pickSymbolMatch(payload, symbol)
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
