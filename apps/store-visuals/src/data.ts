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
}

export const WALLET: WalletSummary = {
  address: '0xce370d3e1b7e7f7d2f1d6e8b9a4c2f0e8d7c6b3a7d93',
  chain: 'base',
  totalUsd: 48_237_512,
  stablecoinPct: 18,
  holdings: [
    { symbol: 'ETH', name: 'Ethereum', imgUrl: '', usd: 20_259_755, pct: 42 },
    { symbol: 'USDC', name: 'USD Coin', imgUrl: '', usd: 8_682_752, pct: 18 },
    { symbol: 'PEPE', name: 'Pepe', imgUrl: '', usd: 5_306_126, pct: 11 },
    { symbol: 'LINK', name: 'Chainlink', imgUrl: '', usd: 3_858_801, pct: 8 },
    { symbol: 'AAVE', name: 'Aave', imgUrl: '', usd: 2_411_876, pct: 5 },
  ],
}
