// Token card (UX §3B) in the Terminal pattern: mono header, hero price + change
// pill, stepped sparkline, split-cell stats, hairline footer links.
import type { Chain, TokenFlag, TokenSummary } from '@alphapeek/shared'
import { coinStatsCoinUrl, dexScreenerUrl } from '@/lib/chain'
import { formatCompact, formatPct, formatPrice } from '@/lib/format'
import { ArrowOut } from './icons'
import { Sparkline } from './Sparkline'
import { BTN } from './ui'

type Props = {
  token: TokenSummary
  chain: Chain
  addr: string
}

// Soft, market-data-derived hints — NOT a safety verdict (token-risk scoring is v0.2).
const FLAG_LABELS: Record<TokenFlag, string> = {
  low_liquidity: 'Low liquidity',
  high_volatility: 'High volatility',
}

export function TokenView({ token, chain, addr }: Props) {
  const up = token.pCh24h >= 0
  // Cached payloads from before flags shipped (IndexedDB + Worker KV) may omit it.
  const flags = token.flags ?? []

  return (
    <div>
      <div className="flex items-center gap-2 border-b-[1.5px] border-line px-[13px] py-[10px]">
        <span className="h-[13px] w-[13px] shrink-0 bg-acc" />
        <span className="truncate text-[13px] font-bold tracking-[0.04em]">
          {token.symbol} / USD
        </span>
        <span className="ml-auto shrink-0 bg-acc px-1.5 py-0.5 text-[9px] font-bold tracking-[0.14em] text-acc-ink">
          LIVE
        </span>
      </div>

      <div className="px-[13px] py-[14px]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[28px] font-bold leading-none tracking-[-0.02em] tabular-nums">
            {formatPrice(token.price)}
          </span>
          <span
            className={`shrink-0 whitespace-nowrap border-[1.5px] px-[7px] py-[3px] text-[12px] font-bold tabular-nums ${
              up ? 'border-up bg-up text-up-ink' : 'border-down bg-down text-down-ink'
            }`}
          >
            {formatPct(token.pCh24h)}
          </span>
        </div>

        {token.sparkline.length >= 2 ? (
          <Sparkline
            data={token.sparkline}
            className={`mt-[14px] block h-[44px] w-full ${up ? 'text-acc' : 'text-down'}`}
          />
        ) : null}

        {flags.length > 0 ? (
          <div className="mt-[12px] flex flex-wrap gap-1.5">
            {flags.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-[5px] whitespace-nowrap border-[1.5px] border-warn px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-warn"
              >
                ⚠ {FLAG_LABELS[f]}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 border-t-[1.5px] border-line">
        <div className="px-[13px] py-[10px]">
          <div className="whitespace-nowrap text-[9px] uppercase tracking-[0.12em] text-dim">
            Mcap
          </div>
          <div className="mt-1 text-[16px] font-bold tabular-nums">
            {formatCompact(token.marketCap)}
          </div>
        </div>
        <div className="border-l-[1.5px] border-line px-[13px] py-[10px]">
          <div className="whitespace-nowrap text-[9px] uppercase tracking-[0.12em] text-dim">
            Vol 24h
          </div>
          <div className="mt-1 text-[16px] font-bold tabular-nums">
            {formatCompact(token.volume)}
          </div>
        </div>
      </div>

      <div className="flex border-t-[1.5px] border-line">
        <a
          href={coinStatsCoinUrl(token.coinId)}
          target="_blank"
          rel="noopener noreferrer"
          className={BTN}
        >
          CoinStats <ArrowOut />
        </a>
        <a
          href={dexScreenerUrl(chain, addr)}
          target="_blank"
          rel="noopener noreferrer"
          className={BTN}
        >
          DEX <ArrowOut />
        </a>
      </div>
    </div>
  )
}
