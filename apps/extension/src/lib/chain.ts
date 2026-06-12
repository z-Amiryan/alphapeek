// X has no URL context, so the chain is inferred from keywords near the address,
// falling back to the user's default. Best-effort for v0.1 (may guess wrong).
import type { Chain } from '@alphapeek/shared'

// Keyword → chain, priority order. Bare "eth" is omitted: Ethereum is the fallback
// anyway and it yields too many false positives. Keep aliases conservative — a
// wrong guess shows the wrong chain's data.
const CHAIN_KEYWORDS: ReadonlyArray<readonly [RegExp, Chain]> = [
  [/\bbase\b/i, 'base'],
  [/\b(?:arbitrum|arb)\b/i, 'arbitrum'],
  [/\b(?:polygon|matic)\b/i, 'polygon'],
  [/\b(?:bsc|bnb|binance)\b/i, 'bsc'],
  [/\b(?:optimism|op)\b/i, 'optimism'],
  [/\b(?:avalanche|avax)\b/i, 'avalanche'],
]

export function inferChain(context: string, fallback: Chain): Chain {
  for (const [re, chain] of CHAIN_KEYWORDS) {
    if (re.test(context)) return chain
  }
  return fallback
}

// Scans only the ±radius characters around the address so a keyword elsewhere in
// a long tweet doesn't bleed in.
export function inferChainForAddress(
  text: string,
  addr: string,
  fallback: Chain,
  radius = 200,
): Chain {
  const idx = text.toLowerCase().indexOf(addr.toLowerCase())
  if (idx < 0) return inferChain(text, fallback)
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + addr.length + radius)
  return inferChain(text.slice(start, end), fallback)
}

const EXPLORERS: Record<Chain, { name: string; base: string }> = {
  ethereum: { name: 'Etherscan', base: 'https://etherscan.io' },
  bsc: { name: 'BscScan', base: 'https://bscscan.com' },
  polygon: { name: 'PolygonScan', base: 'https://polygonscan.com' },
  base: { name: 'BaseScan', base: 'https://basescan.org' },
  arbitrum: { name: 'Arbiscan', base: 'https://arbiscan.io' },
  optimism: { name: 'Optimistic Etherscan', base: 'https://optimistic.etherscan.io' },
  avalanche: { name: 'Snowtrace', base: 'https://snowtrace.io' },
}

export function explorerName(chain: Chain): string {
  return EXPLORERS[chain].name
}

export function explorerAddressUrl(chain: Chain, addr: string): string {
  return `${EXPLORERS[chain].base}/address/${addr}`
}

// DEXScreener slugs happen to match our identifiers for all v0.1 chains.
const DEXSCREENER_SLUG: Record<Chain, string> = {
  ethereum: 'ethereum',
  bsc: 'bsc',
  polygon: 'polygon',
  base: 'base',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  avalanche: 'avalanche',
}

export function dexScreenerUrl(chain: Chain, addr: string): string {
  return `https://dexscreener.com/${DEXSCREENER_SLUG[chain]}/${addr}`
}

// Chain-agnostic search — for the unknown state, where we don't trust the inferred chain
// (the address may be a brand-new token on any chain, or not a token at all).
export function dexScreenerSearchUrl(addr: string): string {
  return `https://dexscreener.com/?q=${encodeURIComponent(addr)}`
}

export function coinStatsCoinUrl(coinId: string): string {
  return `https://coinstats.app/coins/${encodeURIComponent(coinId)}`
}

// Solana token (mint) page on Solscan — the Solana analogue of an EVM block explorer.
// Solana base58 mints are case-sensitive, so the mint is passed through verbatim.
export function solscanTokenUrl(mint: string): string {
  return `https://solscan.io/token/${encodeURIComponent(mint)}`
}

// DexScreener's Solana token page (its `solana` chain slug). Used as the Solana DEX link
// when there's no DexScreener pair URL to defer to.
export function dexScreenerSolanaUrl(mint: string): string {
  return `https://dexscreener.com/solana/${encodeURIComponent(mint)}`
}
