import { describe, expect, it } from 'vitest'
import {
  normalizeChart,
  normalizeFearGreed,
  normalizeToken,
  normalizeWallet,
  normalizeWalletPnl,
  pickSafetyTarget,
  pickSymbolMatch,
} from '../src/coinstats'
import { normalizeDexSolToken, normalizeDexToken } from '../src/dexscreener'
import { normalizeSafety, normalizeSolanaSafety } from '../src/goplus'

const ADDRESS_RE = /^0x[a-f0-9]{40}$/
// Mirrors SOL_MINT_RE in index.ts — kept local like ADDRESS_RE above.
const SOL_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

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
        { symbol: 'eth', name: 'Ethereum', amount: 10, coinId: 'ethereum', coin: { price: 2000 } }, // 20000
        { symbol: 'usdc', name: 'USD Coin', usd: 8000 }, // no coinId → stays undefined
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
    // coinId carries through for deep-linking; absent when upstream omits it.
    expect(w.holdings[0]?.coinId).toBe('ethereum')
    expect(w.holdings[1]?.coinId).toBeUndefined()
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

describe('normalizeSafety', () => {
  // GoPlus encodes booleans as "0"/"1" strings and taxes as decimal fractions.
  it('flags a honeypot as danger', () => {
    const s = normalizeSafety({ is_honeypot: '1', buy_tax: '0', sell_tax: '0' })
    expect(s.verdict).toBe('danger')
    expect(s.flags[0]).toBe('honeypot')
    expect(s.source).toBe('goplus')
  })

  it('treats cannot_sell_all as danger', () => {
    expect(normalizeSafety({ cannot_sell_all: '1' }).verdict).toBe('danger')
  })

  it('rates a clean, verified contract as safe with no flags or notes', () => {
    const s = normalizeSafety({
      is_honeypot: '0',
      buy_tax: '0',
      sell_tax: '0',
      is_open_source: '1',
      is_proxy: '0',
      is_mintable: '0',
    })
    expect(s.verdict).toBe('safe')
    expect(s.flags).toEqual([])
    expect(s.notes).toEqual([])
    expect(s.buyTaxPct).toBe(0)
  })

  it('converts tax fractions to percent and cautions above the threshold', () => {
    const s = normalizeSafety({ buy_tax: '0.03', sell_tax: '0.15', is_open_source: '1' })
    expect(s.sellTaxPct).toBe(15)
    expect(s.buyTaxPct).toBe(3)
    expect(s.verdict).toBe('caution')
    // High sell tax outranks high buy tax in severity order; 3% buy isn't flagged.
    expect(s.flags).toContain('high_sell_tax')
    expect(s.flags).not.toContain('high_buy_tax')
  })

  it('cautions on owner privileges and unverified source (verdict-driving)', () => {
    const s = normalizeSafety({ is_open_source: '0', can_take_back_ownership: '1' })
    expect(s.verdict).toBe('caution')
    expect(s.flags).toEqual(expect.arrayContaining(['owner_privileges', 'unverified_source']))
  })

  // Calibrated against live data: CAKE is mintable, AAVE is a proxy, PEPE has a
  // blacklist fn — all trusted. These must be informational notes, not cautions.
  it('keeps mintable/proxy/blacklist as informational notes (stays safe)', () => {
    const s = normalizeSafety({
      is_honeypot: '0',
      buy_tax: '0',
      sell_tax: '0',
      is_open_source: '1',
      is_mintable: '1',
      is_proxy: '1',
      is_blacklisted: '1',
    })
    expect(s.verdict).toBe('safe')
    expect(s.flags).toEqual([])
    expect(s.notes).toEqual(expect.arrayContaining(['mintable', 'proxy', 'blacklist']))
  })

  it('returns null taxes when the scan omits them', () => {
    const s = normalizeSafety({ is_open_source: '1' })
    expect(s.buyTaxPct).toBeNull()
    expect(s.sellTaxPct).toBeNull()
    expect(s.verdict).toBe('safe')
  })
})

describe('normalizeWalletPnl', () => {
  it('reads all-time profit + percent from summary (numeric buckets)', () => {
    const pnl = normalizeWalletPnl({
      summary: {
        profit: { allTime: 840210, hour24: 12, unrealized: 100, realized: 200 },
        profitPercent: { allTime: 53.2, hour24: 0.5 },
      },
    })
    expect(pnl).toEqual({ window: 'all_time', absUsd: 840210, pct: 53.2 })
  })

  it('reads the USD member when a bucket is a { USD, BTC, ETH } object', () => {
    const pnl = normalizeWalletPnl({
      summary: {
        profit: { allTime: { USD: -1500, BTC: -0.02 } },
        profitPercent: { allTime: -8.5 },
      },
    })
    expect(pnl?.absUsd).toBe(-1500)
    expect(pnl?.pct).toBe(-8.5)
  })

  it('returns null when summary or all-time figures are absent', () => {
    expect(normalizeWalletPnl({})).toBeNull()
    expect(normalizeWalletPnl({ summary: { profit: { hour24: 5 } } })).toBeNull()
    expect(normalizeWalletPnl(null)).toBeNull()
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

describe('normalizeToken source', () => {
  it('stamps source=coinstats on the CoinStats path', () => {
    expect(normalizeToken('pepe', { symbol: 'pepe' }, []).source).toBe('coinstats')
  })
})

describe('pickSafetyTarget', () => {
  // contractAddresses[].blockchain uses the /coins slug namespace (binance_smart, etc.).
  it('prefers the canonical singular contractAddress deployment (CAKE = BSC-native)', () => {
    const cake = {
      contractAddress: '0x0E09FABB73BD3Ade0a17ECC321fD13a19e81cE82', // mixed case → case-insensitive
      contractAddresses: [
        {
          blockchain: 'binance_smart',
          contractAddress: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
        },
        { blockchain: 'ethereum', contractAddress: '0x152649ea73beab28c5b49b26eb48f7ead6d4c898' },
        { blockchain: 'solana', contractAddress: '4qQeZ5LwSz6HuupUu8jCtgXyW1mYQcNbFAW1sWZp89HL' },
      ],
    }
    expect(pickSafetyTarget(cake)).toEqual({
      chain: 'bsc',
      contract: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
    })
  })

  it('falls back to ethereum when the singular address matches no listed deployment', () => {
    const t = pickSafetyTarget({
      contractAddress: '0xnot_in_the_list',
      contractAddresses: [
        { blockchain: 'binance_smart', contractAddress: '0xbsc' },
        { blockchain: 'ethereum', contractAddress: '0xeth' },
      ],
    })
    expect(t).toEqual({ chain: 'ethereum', contract: '0xeth' })
  })

  it('falls back to SUPPORTED_CHAINS order when neither canonical nor ethereum apply', () => {
    // polygon (index 2) outranks arbitrum (index 4); no singular contractAddress given.
    const t = pickSafetyTarget({
      contractAddresses: [
        { blockchain: 'arbitrum-one', contractAddress: '0xarb' },
        { blockchain: 'polygon-pos', contractAddress: '0xpoly' },
      ],
    })
    expect(t).toEqual({ chain: 'polygon', contract: '0xpoly' })
  })

  it('reads through a { coin } / { result } wrapper', () => {
    expect(
      pickSafetyTarget({
        coin: { contractAddresses: [{ blockchain: 'base', contractAddress: '0xb' }] },
      }),
    ).toEqual({ chain: 'base', contract: '0xb' })
  })

  it('falls back to a Solana mint when no supported-EVM deployment exists (v0.3)', () => {
    // EVM-first still holds (the CAKE case above), but a Solana-only coin now yields a
    // Solana safety target instead of null, so $GOAT-class cashtags can be scanned.
    expect(
      pickSafetyTarget({
        contractAddresses: [
          { blockchain: 'solana', contractAddress: 'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump' },
        ],
      }),
    ).toEqual({ network: 'solana', mint: 'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump' })
  })

  it('ignores a non-EVM, non-Solana deployment (e.g. Tron) — returns null', () => {
    expect(
      pickSafetyTarget({ contractAddresses: [{ blockchain: 'tron', contractAddress: 'Txyz' }] }),
    ).toBeNull()
  })

  it('returns null for missing / empty contractAddresses', () => {
    expect(pickSafetyTarget({})).toBeNull()
    expect(pickSafetyTarget({ contractAddresses: [] })).toBeNull()
    expect(pickSafetyTarget(null)).toBeNull()
  })
})

describe('pickSymbolMatch', () => {
  const evm = (id: string, marketCap: number, blockchain = 'ethereum') => ({
    id,
    symbol: 'FOO',
    marketCap,
    contractAddresses: [{ blockchain, contractAddress: '0xfoo' }],
  })

  it('resolves when exactly one supported-EVM coin clears the dust floor', () => {
    const payload = {
      result: [
        evm('foo-token', 5_000_000, 'base'),
        // dust below the floor → ignored, so the survivor is unique
        evm('foo-scam', 4_000),
      ],
    }
    expect(pickSymbolMatch(payload, 'FOO')).toBe('foo-token')
  })

  it('stays silent (null) when multiple real EVM coins share the ticker (the $MOON trap)', () => {
    const payload = {
      result: [evm('moon-a', 270_000, 'arbitrum-one'), evm('moon-b', 296_000, 'binance_smart')],
    }
    // Two contenders above the floor → never guess; the card stays silent.
    expect(pickSymbolMatch(payload, 'FOO')).toBeNull()
  })

  it('ignores deployments we can neither show nor scan (e.g. Tron); Solana now counts (v0.3)', () => {
    const tronOnly = {
      result: [
        {
          id: 'tron-foo',
          symbol: 'FOO',
          marketCap: 9_000_000,
          contractAddresses: [{ blockchain: 'tron', contractAddress: 'Tfoo' }],
        },
      ],
    }
    expect(pickSymbolMatch(tronOnly, 'FOO')).toBeNull()
  })

  it('matches the symbol case-insensitively and ignores fuzzy non-matches', () => {
    const payload = {
      result: [
        {
          id: 'foo-token',
          symbol: 'foo',
          marketCap: 5_000_000,
          contractAddresses: [{ blockchain: 'ethereum', contractAddress: '0xfoo' }],
        },
        // a different ticker the upstream returned alongside → must not count
        {
          id: 'foobar',
          symbol: 'FOOBAR',
          marketCap: 9_000_000,
          contractAddresses: [{ blockchain: 'base', contractAddress: '0xbar' }],
        },
      ],
    }
    expect(pickSymbolMatch(payload, 'FOO')).toBe('foo-token')
  })

  it('returns null when every match is below the floor or has no supported deployment', () => {
    expect(pickSymbolMatch({ result: [evm('foo-dust', 1_000)] }, 'FOO')).toBeNull()
    expect(pickSymbolMatch({ result: [] }, 'FOO')).toBeNull()
    expect(pickSymbolMatch(null, 'FOO')).toBeNull()
  })

  const sol = (id: string, marketCap: number) => ({
    id,
    symbol: 'FOO',
    marketCap,
    contractAddresses: [{ blockchain: 'solana', contractAddress: `${id}mint` }],
  })

  it('resolves a single Solana coin above the floor (v0.3 — widened past EVM-only)', () => {
    const payload = { result: [sol('foo-sol', 12_000_000), sol('foo-sol-scam', 4_000)] }
    expect(pickSymbolMatch(payload, 'FOO')).toBe('foo-sol')
  })

  it('stays silent on two Solana coins above the floor (the $GOAT contested-ticker trap)', () => {
    // Goatseus ($12.6M) + Sonic The Goat ($65k) both clear $50k → ambiguous → no card.
    const payload = { result: [sol('goatseus', 12_600_000), sol('sonic-the-goat', 65_000)] }
    expect(pickSymbolMatch(payload, 'FOO')).toBeNull()
  })

  it('stays silent when an EVM and a Solana coin both clear the floor (cross-chain trap)', () => {
    expect(
      pickSymbolMatch({ result: [evm('foo-eth', 5_000_000), sol('foo-sol', 9_000_000)] }, 'FOO'),
    ).toBeNull()
  })
})

describe('SOL_MINT_RE (base58 mint validation)', () => {
  it('accepts real base58 mints (32–44 chars)', () => {
    expect(SOL_MINT_RE.test('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263')).toBe(true) // BONK, 44
    expect(SOL_MINT_RE.test('CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump')).toBe(true) // GOAT mint
  })

  it('rejects junk: too short, too long, and base58-excluded chars (0 O I l)', () => {
    expect(SOL_MINT_RE.test('abc')).toBe(false)
    expect(SOL_MINT_RE.test('0OIl'.repeat(10))).toBe(false) // excluded chars
    expect(SOL_MINT_RE.test('0xdac17f958d2ee523a2206206994597c13d831ec7')).toBe(false) // EVM addr (0x, too short)
    expect(SOL_MINT_RE.test('z'.repeat(45))).toBe(false) // over 44
  })
})

describe('normalizeSolanaSafety', () => {
  // Calibrated against a live trusted basket: WIF/JUP/POPCAT have mint/freeze/balance status "0".
  const clean = {
    mintable: { authority: [], status: '0' },
    freezable: { authority: [], status: '0' },
    balance_mutable_authority: { authority: [], status: '0' },
    closable: { authority: [], status: '0' },
    non_transferable: '0',
    transfer_fee: {},
    transfer_hook: [],
    metadata_mutable: { metadata_upgrade_authority: [], status: '0' },
  }

  it('rates a fully-revoked SPL token as safe with no flags or notes (WIF/POPCAT profile)', () => {
    const s = normalizeSolanaSafety(clean)
    expect(s.verdict).toBe('safe')
    expect(s.flags).toEqual([])
    expect(s.notes).toEqual([])
    expect(s.source).toBe('goplus')
    // SPL transfer-fee shape is unverified → taxes reported as unknown, not a wrong number.
    expect(s.buyTaxPct).toBeNull()
    expect(s.sellTaxPct).toBeNull()
  })

  it('keeps mutable metadata as an informational note — stays safe (JUP profile)', () => {
    const s = normalizeSolanaSafety({
      ...clean,
      metadata_mutable: { metadata_upgrade_authority: [{ address: 'x' }], status: '1' },
    })
    expect(s.verdict).toBe('safe')
    expect(s.flags).toEqual([])
    expect(s.notes).toEqual(['mutable_metadata'])
  })

  it('flags a live mint authority as danger (un-revoked supply control)', () => {
    const s = normalizeSolanaSafety({ ...clean, mintable: { authority: ['x'], status: '1' } })
    expect(s.verdict).toBe('danger')
    expect(s.flags).toContain('mint_authority')
  })

  it('flags a live freeze authority as danger', () => {
    const s = normalizeSolanaSafety({ ...clean, freezable: { authority: ['x'], status: '1' } })
    expect(s.verdict).toBe('danger')
    expect(s.flags).toContain('freeze_authority')
  })

  it('treats a non-transferable token as a honeypot (danger)', () => {
    expect(normalizeSolanaSafety({ ...clean, non_transferable: '1' }).verdict).toBe('danger')
  })

  it('cautions on lesser owner privileges (balance-mutable or transfer hook)', () => {
    const balMut = normalizeSolanaSafety({
      ...clean,
      balance_mutable_authority: { authority: ['x'], status: '1' },
    })
    expect(balMut.verdict).toBe('caution')
    expect(balMut.flags).toEqual(['owner_privileges'])

    const hook = normalizeSolanaSafety({ ...clean, transfer_hook: [{ address: 'x' }] })
    expect(hook.verdict).toBe('caution')
    expect(hook.flags).toContain('owner_privileges')
  })
})

describe('normalizeDexSolToken', () => {
  const MINT = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'

  it('picks the highest-liquidity solana pair and stamps network + solMint', () => {
    const out = normalizeDexSolToken(MINT, {
      pairs: [
        {
          chainId: 'ethereum', // wrong chain → ignored even at higher liquidity
          baseToken: { address: MINT, name: 'Bonk', symbol: 'bonk' },
          priceUsd: '0.001',
          liquidity: { usd: 9_000_000 },
          volume: { h24: 1 },
        },
        {
          chainId: 'solana',
          url: 'https://dexscreener.com/solana/abc',
          baseToken: { address: MINT, name: 'Bonk', symbol: 'bonk' },
          quoteToken: { address: 'So11111111111111111111111111111111111111112', symbol: 'SOL' },
          priceUsd: '0.0000234',
          priceChange: { h24: 6 },
          liquidity: { usd: 1_500_000 },
          volume: { h24: 800_000 },
          marketCap: 1_700_000_000,
          info: { imageUrl: 'http://img/bonk.png' },
        },
      ],
    })
    expect(out?.network).toBe('solana')
    expect(out?.solMint).toBe(MINT)
    expect(out?.coinId).toBe(MINT)
    expect(out?.symbol).toBe('BONK')
    expect(out?.source).toBe('dexscreener')
    expect(out?.url).toBe('https://dexscreener.com/solana/abc')
    expect(out?.price).toBe(0.0000234)
    expect(out?.sparkline).toEqual([])
  })

  it('returns null below the dust-liquidity floor and for non-solana-only payloads', () => {
    expect(
      normalizeDexSolToken(MINT, {
        pairs: [
          {
            chainId: 'solana',
            baseToken: { address: MINT, symbol: 's' },
            priceUsd: '1',
            liquidity: { usd: 500 },
          },
        ],
      }),
    ).toBeNull()
    expect(
      normalizeDexSolToken(MINT, {
        pairs: [
          {
            chainId: 'base',
            baseToken: { address: MINT, symbol: 's' },
            priceUsd: '1',
            liquidity: { usd: 9_000_000 },
          },
        ],
      }),
    ).toBeNull()
    expect(normalizeDexSolToken(MINT, { pairs: [] })).toBeNull()
    expect(normalizeDexSolToken(MINT, null)).toBeNull()
  })
})

describe('normalizeDexToken', () => {
  const ADDR = '0xtoken00000000000000000000000000000000aa'

  // DexScreener: priceUsd is a string, the rest numbers; pairs span DEX/chain variants.
  it('picks the highest-liquidity supported-chain pair as authoritative', () => {
    const out = normalizeDexToken(ADDR, {
      pairs: [
        {
          chainId: 'ethereum', // higher price but LOWER liquidity → must not win
          url: 'https://dexscreener.com/ethereum/0xeth',
          baseToken: { address: ADDR, name: 'Brett', symbol: 'brett' },
          quoteToken: { address: '0xusdc', name: 'USD Coin', symbol: 'USDC' },
          priceUsd: '0.051',
          priceChange: { h24: 4 },
          liquidity: { usd: 20_000 },
          volume: { h24: 50_000 },
          marketCap: 0,
          info: { imageUrl: 'http://img/eth.png' },
        },
        {
          chainId: 'base', // highest liquidity → authoritative chain
          url: 'https://dexscreener.com/base/0xbase',
          baseToken: { address: ADDR, name: 'Brett', symbol: 'brett' },
          quoteToken: { address: '0xweth', name: 'WETH', symbol: 'WETH' },
          priceUsd: '0.05',
          priceChange: { h24: 30 }, // ≥25 → high_volatility
          liquidity: { usd: 800_000 },
          volume: { h24: 2_000_000 }, // healthy → no low_liquidity
          marketCap: 500_000_000,
          fdv: 600_000_000,
          info: { imageUrl: 'http://img/base.png' },
        },
      ],
    })
    expect(out?.chain).toBe('base')
    expect(out?.token.symbol).toBe('BRETT')
    expect(out?.token.price).toBe(0.05)
    expect(out?.token.marketCap).toBe(500_000_000)
    expect(out?.token.volume).toBe(2_000_000)
    expect(out?.token.source).toBe('dexscreener')
    expect(out?.token.url).toBe('https://dexscreener.com/base/0xbase')
    expect(out?.token.coinId).toBe(ADDR)
    expect(out?.token.sparkline).toEqual([])
    expect(out?.token.flags).toContain('high_volatility')
    expect(out?.token.flags).not.toContain('low_liquidity')
  })

  it('falls back to fdv when marketCap is absent', () => {
    const out = normalizeDexToken(ADDR, {
      pairs: [
        {
          chainId: 'bsc',
          url: 'u',
          baseToken: { address: ADDR, name: 'X', symbol: 'x' },
          priceUsd: '1',
          priceChange: { h24: 1 },
          liquidity: { usd: 50_000 },
          volume: { h24: 100_000 },
          fdv: 1_234,
          info: {},
        },
      ],
    })
    expect(out?.chain).toBe('bsc')
    expect(out?.token.marketCap).toBe(1_234)
  })

  it('returns null below the dust-liquidity floor', () => {
    expect(
      normalizeDexToken(ADDR, {
        pairs: [
          {
            chainId: 'base',
            baseToken: { address: ADDR, symbol: 'scam' },
            priceUsd: '0.00001',
            liquidity: { usd: 500 }, // < MIN_LIQUIDITY_USD
            volume: { h24: 9 },
          },
        ],
      }),
    ).toBeNull()
  })

  it('ignores pairs on unsupported chains', () => {
    expect(
      normalizeDexToken(ADDR, {
        pairs: [
          {
            chainId: 'solana', // not in DEX_CHAIN
            baseToken: { address: ADDR, symbol: 'sol' },
            priceUsd: '1',
            liquidity: { usd: 9_000_000 },
            volume: { h24: 1_000_000 },
          },
        ],
      }),
    ).toBeNull()
  })

  it('returns null for empty / malformed payloads', () => {
    expect(normalizeDexToken(ADDR, {})).toBeNull()
    expect(normalizeDexToken(ADDR, { pairs: [] })).toBeNull()
    expect(normalizeDexToken(ADDR, { pairs: null })).toBeNull()
    expect(normalizeDexToken(ADDR, null)).toBeNull()
  })
})
