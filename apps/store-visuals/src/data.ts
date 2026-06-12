import type { TokenSummary, WalletSummary } from '@alphapeek/shared'

// A gently rising 7d series so the stepped sparkline reads as an uptrend.
const SPARK = [
  0.0000021, 0.0000021, 0.0000022, 0.0000022, 0.0000023, 0.0000022, 0.0000024, 0.0000023, 0.0000025,
  0.0000024, 0.0000026, 0.0000025, 0.0000027, 0.0000026, 0.0000028, 0.0000027, 0.0000029, 0.0000028,
  0.000003, 0.0000031,
]

export const TOKEN: TokenSummary = {
  coinId: 'pepe',
  name: 'Pepe',
  symbol: 'PEPE',
  imgUrl: '',
  price: 0.0000031,
  pCh24h: 12.4,
  marketCap: 2_100_000_000,
  volume: 480_000_000,
  sparkline: SPARK,
  flags: [],
  source: 'coinstats',
  // v0.2 headline: a free contract-safety verdict on every token card (GoPlus).
  // A clean, legit token reads "Safe · No critical risks" with 0% taxes.
  safety: {
    verdict: 'safe',
    buyTaxPct: 0,
    sellTaxPct: 0,
    flags: [],
    notes: [],
    source: 'goplus',
  },
}

// v0.3 — a Solana (SPL) token card: GoPlus-Solana verdict + a Solscan link. WIF reads
// "Safe" with a single informational `mutable_metadata` note (its mint+freeze authority are
// revoked — the legit-Solana profile), exactly matching the live API.
const SOL_SPARK = [
  0.118, 0.121, 0.119, 0.124, 0.127, 0.123, 0.131, 0.129, 0.134, 0.132, 0.138, 0.136, 0.142, 0.139,
  0.145, 0.143, 0.148, 0.146, 0.151, 0.15,
]

export const SOL_TOKEN: TokenSummary = {
  coinId: 'dogwifcoin',
  name: 'dogwifhat',
  symbol: 'WIF',
  imgUrl: '',
  price: 0.15,
  pCh24h: 8.2,
  marketCap: 149_600_000,
  volume: 44_300_000,
  sparkline: SOL_SPARK,
  flags: [],
  source: 'coinstats',
  network: 'solana',
  solMint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  safety: {
    verdict: 'safe',
    buyTaxPct: null,
    sellTaxPct: null,
    flags: [],
    notes: ['mutable_metadata'],
    source: 'goplus',
  },
}

export const WALLET: WalletSummary = {
  address: '0xce370d3e1b7e7f7d2f1d6e8b9a4c2f0e8d7c7d93',
  chain: 'base',
  totalUsd: 48_237_512,
  stablecoinPct: 18,
  // v0.2: all-time PnL — the smart-money "is this wallet actually winning?" read.
  pnl: { window: 'all_time', absUsd: 12_400_000, pct: 38.5 },
  holdings: [
    { symbol: 'ETH', name: 'Ethereum', imgUrl: '', usd: 20_259_755, pct: 42 },
    { symbol: 'USDC', name: 'USD Coin', imgUrl: '', usd: 8_682_752, pct: 18 },
    { symbol: 'PEPE', name: 'Pepe', imgUrl: '', usd: 5_306_126, pct: 11 },
    { symbol: 'LINK', name: 'Chainlink', imgUrl: '', usd: 3_858_801, pct: 8 },
    { symbol: 'AAVE', name: 'Aave', imgUrl: '', usd: 2_411_876, pct: 5 },
  ],
}
