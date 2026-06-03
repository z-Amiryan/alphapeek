import { describe, expect, it } from 'vitest'
import {
  normalizeChart,
  normalizeFearGreed,
  normalizeToken,
  normalizeWallet,
} from '../src/coinstats'

const ADDRESS_RE = /^0x[a-f0-9]{40}$/

describe('address validation', () => {
  it('accepts a lowercase 40-hex address', () => {
    expect(ADDRESS_RE.test('0xdac17f958d2ee523a2206206994597c13d831ec7')).toBe(true)
  })

  it('rejects wrong length and non-hex', () => {
    expect(ADDRESS_RE.test('0x123')).toBe(false)
    expect(ADDRESS_RE.test('0xZZZ7f958d2ee523a2206206994597c13d831ec7')).toBe(false)
    // Uppercase must be normalized to lowercase by the caller first.
    expect(ADDRESS_RE.test('0xDAC17F958D2EE523A2206206994597C13D831EC7')).toBe(false)
  })
})

describe('normalizeWallet', () => {
  it('computes totals, percentages, sorts desc and caps at 5', () => {
    const payload = {
      balances: [
        { symbol: 'eth', name: 'Ethereum', amount: 10, coin: { price: 2000 } }, // 20000
        { symbol: 'usdc', name: 'USD Coin', usd: 8000 },
        { symbol: 'link', name: 'Chainlink', balanceUSD: 4000 },
        { symbol: 'dai', name: 'Dai', valueUsd: 2000 },
        { symbol: 'aave', name: 'Aave', usd: 1000 },
        { symbol: 'dust', name: 'Dust', usd: 500 }, // should be dropped (6th)
        { symbol: 'zero', name: 'Zero', usd: 0 }, // dropped (no value)
      ],
    }
    const w = normalizeWallet('0xabc', 'ethereum', payload)
    expect(w.holdings).toHaveLength(5)
    expect(w.holdings[0]?.symbol).toBe('ETH')
    expect(w.totalUsd).toBe(35500)
    // ETH share = 20000 / 35500
    expect(Math.round(w.holdings[0]?.pct ?? 0)).toBe(56)
    // Stables (usdc 8000 + dai 2000) over the FULL list / total — incl. the sliced-off dust.
    expect(Math.round(w.stablecoinPct)).toBe(28)
  })

  it('reports 0 stablecoinPct for an all-volatile wallet, incl. bridged BSC-USD as stable', () => {
    const noStables = normalizeWallet('0xabc', 'ethereum', {
      balances: [{ symbol: 'pepe', usd: 1000 }],
    })
    expect(noStables.stablecoinPct).toBe(0)
    const bridged = normalizeWallet('0xabc', 'bsc', {
      balances: [
        { symbol: 'bnb', usd: 600 },
        { symbol: 'BSC-USD', usd: 400 },
      ],
    })
    expect(Math.round(bridged.stablecoinPct)).toBe(40)
  })

  it('returns empty holdings for an empty payload', () => {
    expect(normalizeWallet('0xabc', 'base', {}).holdings).toHaveLength(0)
    expect(normalizeWallet('0xabc', 'base', null).totalUsd).toBe(0)
  })
})

describe('normalizeToken', () => {
  it('reads varying field names (icon/imgUrl, priceChange1d)', () => {
    const t = normalizeToken(
      'tether',
      { name: 'Tether', symbol: 'usdt', icon: 'http://x/i.png', price: 1.0, priceChange1d: -0.2 },
      [1, 1.01, 0.99],
    )
    expect(t.symbol).toBe('USDT')
    expect(t.imgUrl).toBe('http://x/i.png')
    expect(t.pCh24h).toBe(-0.2)
    expect(t.sparkline).toEqual([1, 1.01, 0.99])
  })

  it('derives low_liquidity + high_volatility flags from market data', () => {
    const thin = normalizeToken('x', { symbol: 'x', volume: 10_000, priceChange1d: 30 }, [])
    expect(thin.flags).toEqual(['low_liquidity', 'high_volatility'])

    const healthy = normalizeToken('x', { symbol: 'x', volume: 5_000_000, priceChange1d: 4 }, [])
    expect(healthy.flags).toEqual([])

    // volume 0 means MISSING data, not a thin market — must not flag low_liquidity.
    const noVol = normalizeToken('x', { symbol: 'x', priceChange1d: -40 }, [])
    expect(noVol.flags).toEqual(['high_volatility'])
  })
})

describe('normalizeChart', () => {
  it('extracts the price column from [ts, price] tuples', () => {
    expect(
      normalizeChart([
        [1, 100],
        [2, 110],
        [3, 105],
      ]),
    ).toEqual([100, 110, 105])
  })
  it('tolerates wrapper objects and bad rows', () => {
    expect(normalizeChart({ chart: [[1, 5], ['bad'], [2, 6]] })).toEqual([5, 6])
  })
  it('drills into the wrapped /coins/charts shape [{ coinId, chart: [...] }]', () => {
    expect(
      normalizeChart([
        {
          coinId: 'bitcoin',
          chart: [
            [1, 100, 0, 0],
            [2, 110, 0, 0],
            [3, 105, 0, 0],
          ],
        },
      ]),
    ).toEqual([100, 110, 105])
  })
})

describe('normalizeFearGreed', () => {
  it('derives a label when none is provided', () => {
    expect(normalizeFearGreed({ value: 80 }).label).toBe('Extreme Greed')
    expect(normalizeFearGreed({ now: { value: 50 } }).label).toBe('Neutral')
    expect(normalizeFearGreed({ value: 10 }).label).toBe('Extreme Fear')
  })
  it('keeps an explicit classification', () => {
    expect(normalizeFearGreed({ value: 52, value_classification: 'Neutral' })).toEqual({
      value: 52,
      label: 'Neutral',
    })
  })
})
