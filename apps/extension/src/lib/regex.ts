import { TICKERS } from './tickers.generated'

// Guards stop the 40-hex slice matching inside a longer hex string (e.g. a tx
// hash). Kept in sync with the copy in ROADMAP/SPEC.
export const EVM_ADDRESS = /(?<![a-fA-F0-9])0x[a-fA-F0-9]{40}(?![a-fA-F0-9])/g

export function findAddress(text: string): string | null {
  // Fresh regex each call so the /g flag's lastIndex doesn't leak across calls.
  const match = new RegExp(EVM_ADDRESS).exec(text)
  return match ? match[0] : null
}

export function isAddress(text: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(text.trim())
}

// $CASHTAG: a `$` not preceded by a word char or another `$` (so `US$`, `$$` don't
// match) + a letter-led 1–10 char symbol. For whitelisted symbols the TICKERS map is the
// false-positive filter; for the long-tail it's a length floor + the Worker's strict
// single-match guard (so `$100`, plain English, and stock tickers fall away).
export const TICKER = /(?<![A-Za-z0-9$])\$([A-Za-z][A-Za-z0-9]{0,9})\b/

// Long-tail $symbols shorter than this are mostly slang/noise ($ME, $GM); the Worker
// search would rarely find a single-match anyway. Whitelisted symbols bypass the floor.
const MIN_LONG_TAIL_LENGTH = 3

// Resolves a cashtag to either a whitelisted coin (instant, top-1000 → coinId) or a
// long-tail symbol (coinId null → the Worker resolves it under its single-match guard).
// Returns null for non-cashtags and sub-floor long-tail noise.
export function findCashtag(text: string): { symbol: string; coinId: string | null } | null {
  const match = new RegExp(TICKER).exec(text)
  if (!match) return null
  const symbol = (match[1] ?? '').toUpperCase()
  const coinId = TICKERS.get(symbol)
  if (coinId) return { symbol, coinId }
  return symbol.length >= MIN_LONG_TAIL_LENGTH ? { symbol, coinId: null } : null
}
