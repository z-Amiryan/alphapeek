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
// match) + a letter-led 1–10 char symbol. Whitelist membership (TICKERS) is the real
// false-positive filter — `$100`, plain English, and stock tickers all fall away.
export const TICKER = /(?<![A-Za-z0-9$])\$([A-Za-z][A-Za-z0-9]{0,9})\b/

// Returns the canonical coinId for a whitelisted cashtag, or null. Only top-1000
// symbols resolve, so a random `$WORD` never triggers a lookup.
export function findTicker(text: string): { symbol: string; coinId: string } | null {
  const match = new RegExp(TICKER).exec(text)
  if (!match) return null
  const symbol = (match[1] ?? '').toUpperCase()
  const coinId = TICKERS.get(symbol)
  return coinId ? { symbol, coinId } : null
}
