// Token card (UX §3B).
import type { Chain, TokenFlag, TokenSummary } from '@alphapeek/shared'
import { AlertTriangle, ExternalLink, TrendingDown, TrendingUp } from 'lucide-react'
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

      {flags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {flags.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-warning dark:bg-surface-dark-100"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              {FLAG_LABELS[f]}
            </span>
          ))}
        </div>
      ) : null}

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
