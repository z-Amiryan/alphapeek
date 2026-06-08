import type { Chain, SafetyFlag, TokenSafety } from '@alphapeek/shared'
import type { Env } from './env'

// GoPlus Token Security uses NUMERIC chain ids (not CoinStats' slug namespaces).
// Verified live: 1/56/137/8453 resolve; the rest follow the same canonical EVM
// chain-id convention. Chains absent here get no scan (safety stays undefined).
const GOPLUS_CHAIN_ID: Record<Chain, number> = {
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  avalanche: 43114,
}

// A tax above this reads as "caution" — high enough to eat a meaningful slice of a
// round-trip. Honeypots (can't sell at all) are handled separately as `danger`.
const HIGH_TAX_PCT = 10

// Cap the scan so a slow/hanging GoPlus can't push the token card past the SPEC §7
// cache-miss budget. It already runs in parallel with the chart call; on timeout we
// treat it as no-data (safety undefined), same as any other failure.
const SCAN_TIMEOUT_MS = 2500

// Mirrors the narrowing idiom in coinstats.ts (kept local — that one is private).
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

// GoPlus encodes booleans as the strings "0"/"1"; taxes as decimal-fraction strings
// (e.g. "0.05" = 5%). These narrow from unknown without trusting the shape.
function gpFlag(v: unknown): boolean {
  return v === '1' || v === 1 || v === true
}

function gpNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
  return null
}

// Fraction (0.05) → percent (5), rounded to 2dp. Null passes through.
function toTaxPct(fraction: number | null): number | null {
  return fraction === null ? null : Math.round(fraction * 100 * 100) / 100
}

/**
 * Maps a raw GoPlus `result[addr]` record to our normalized verdict. The partition
 * below is CALIBRATED against a live basket (SHIB/LINK/UNI/AAVE/PEPE/CAKE/BRETT):
 * `mintable` (CAKE), `proxy` (AAVE), and `blacklist` (PEPE) all fire on trusted
 * tokens, so they're `notes` (shown, never verdict-driving). Only high-precision
 * rug signals drive the verdict. `flags`/`notes` are each worst-first ordered.
 * Pure + exported for unit tests.
 */
export function normalizeSafety(raw: Record<string, unknown>): TokenSafety {
  const buyTaxPct = toTaxPct(gpNumber(raw.buy_tax))
  const sellTaxPct = toTaxPct(gpNumber(raw.sell_tax))

  // Owner can still mess with the contract post-launch (rug surface), via any of these.
  const ownerPrivileges =
    gpFlag(raw.can_take_back_ownership) ||
    gpFlag(raw.hidden_owner) ||
    gpFlag(raw.owner_change_balance) ||
    gpFlag(raw.selfdestruct)

  // Verdict-driving findings (high precision: rare on legit tokens).
  const flags: SafetyFlag[] = []
  if (gpFlag(raw.is_honeypot)) flags.push('honeypot')
  if (gpFlag(raw.cannot_sell_all)) flags.push('cant_sell_all')
  if (sellTaxPct !== null && sellTaxPct > HIGH_TAX_PCT) flags.push('high_sell_tax')
  if (buyTaxPct !== null && buyTaxPct > HIGH_TAX_PCT) flags.push('high_buy_tax')
  if (ownerPrivileges) flags.push('owner_privileges')
  if (gpFlag(raw.transfer_pausable)) flags.push('transfer_pausable')
  // is_open_source === "1" means verified; "0" means unverified (can't audit).
  if (raw.is_open_source !== undefined && !gpFlag(raw.is_open_source)) {
    flags.push('unverified_source')
  }

  // Informational capabilities (common on legit tokens) — surfaced, not scored.
  const notes: SafetyFlag[] = []
  if (gpFlag(raw.is_mintable)) notes.push('mintable')
  if (gpFlag(raw.is_proxy)) notes.push('proxy')
  if (gpFlag(raw.is_blacklisted)) notes.push('blacklist')

  const isDanger = flags.includes('honeypot') || flags.includes('cant_sell_all')
  const verdict = isDanger ? 'danger' : flags.length > 0 ? 'caution' : 'safe'

  return { verdict, buyTaxPct, sellTaxPct, flags, notes, source: 'goplus' }
}

/**
 * Best-effort token-safety scan. NEVER throws — a failure (network, non-2xx,
 * unsupported chain, or no row for the address) returns null so the caller leaves
 * `safety` undefined and the token card renders without it. Free + keyless: no
 * X-API-KEY, no CoinStats credit, no daily-cap impact.
 */
export async function fetchTokenSafety(
  env: Env,
  addr: string,
  chain: Chain,
): Promise<TokenSafety | null> {
  const chainId = GOPLUS_CHAIN_ID[chain]
  const url = new URL(`${env.GOPLUS_BASE_URL}/token_security/${chainId}`)
  url.searchParams.set('contract_addresses', addr)

  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
    })
    if (!res.ok) {
      console.warn(`goplus scan failed for ${addr} on ${chain}: HTTP ${res.status}`)
      return null
    }
    const payload = (await res.json()) as unknown
    const byAddr = asRecord(asRecord(payload)?.result)
    // GoPlus keys the result by the lowercased address.
    const row = asRecord(byAddr?.[addr.toLowerCase()])
    if (!row) return null
    return normalizeSafety(row)
  } catch (cause) {
    console.warn(`goplus scan errored for ${addr} on ${chain}: ${String(cause)}`)
    return null
  }
}
