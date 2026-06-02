// Token card (UX §3B).
import type { Chain, TokenSummary } from '@alphapeek/shared'
import { ExternalLink, TrendingDown, TrendingUp } from 'lucide-react'
import { coinStatsCoinUrl, dexScreenerUrl } from '@/lib/chain'
import { formatCompact, formatPct, formatPrice } from '@/lib/format'
import { CoinIcon } from './CoinIcon'
import { Sparkline } from './Sparkline'

type Props = {
  token: TokenSummary
  chain: Chain
  addr: string
}

const DIVIDER = 'my-3 border-t border-neutral-100 dark:border-surface-dark-100'

export function TokenView({ token, chain, addr }: Props) {
  const up = token.pCh24h >= 0

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <CoinIcon src={token.imgUrl} symbol={token.symbol} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-lg font-semibold text-neutral-900 dark:text-neutral-50">
              {token.symbol}
            </span>
            <span className="shrink-0 text-xl font-bold text-neutral-900 dark:text-neutral-50">
              {formatPrice(token.price)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm text-neutral-500">{token.name}</span>
            <span
              className={`inline-flex shrink-0 items-center gap-0.5 text-sm font-medium ${
                up ? 'text-success' : 'text-danger'
              }`}
            >
              {up ? (
                <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {formatPct(token.pCh24h)}
            </span>
          </div>
        </div>
      </div>

      <div className={DIVIDER} />

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-neutral-500">Mcap</dt>
        <dd className="text-right text-neutral-900 dark:text-neutral-50">
          {formatCompact(token.marketCap)}
        </dd>
        <dt className="text-neutral-500">Vol</dt>
        <dd className="text-right text-neutral-900 dark:text-neutral-50">
          {formatCompact(token.volume)}
        </dd>
      </dl>

      {token.sparkline.length >= 2 ? (
        <>
          <div className={DIVIDER} />
          <Sparkline data={token.sparkline} className="h-[60px] w-full text-neutral-500" />
        </>
      ) : null}

      <div className={DIVIDER} />

      <div className="flex items-center gap-4">
        <a
          href={coinStatsCoinUrl(token.coinId)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          CoinStats
        </a>
        <a
          href={dexScreenerUrl(chain, addr)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          DEXScreener
        </a>
      </div>
    </div>
  )
}
