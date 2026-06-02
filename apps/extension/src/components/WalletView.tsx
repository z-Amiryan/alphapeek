// Wallet card (UX §3C). No PnL in v0.1 — extra credit cost, deliberate v0.2 call.
// Footer links the block explorer (always correct) rather than a guessed CoinStats
// per-address URL, which has no documented public format yet.
import type { WalletSummary } from '@alphapeek/shared'
import { CHAIN_LABELS } from '@alphapeek/shared'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { explorerAddressUrl, explorerName } from '@/lib/chain'
import { formatShare, formatUsd, truncateAddress } from '@/lib/format'
import { CoinIcon } from './CoinIcon'

type Props = {
  wallet: WalletSummary
}

const DIVIDER = 'my-3 border-t border-neutral-100 dark:border-surface-dark-100'

export function WalletView({ wallet }: Props) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(wallet.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard may be unavailable; failing silently is acceptable here.
    }
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm text-neutral-900 dark:text-neutral-50">
          {truncateAddress(wallet.address)}
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy address"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-neutral-500 hover:bg-neutral-100 dark:hover:bg-surface-dark-100"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div className="text-sm text-neutral-500">{CHAIN_LABELS[wallet.chain]}</div>

      <div className={DIVIDER} />

      <div className="text-xs uppercase tracking-wide text-neutral-500">Total Balance</div>
      <div className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
        {formatUsd(wallet.totalUsd)}
      </div>

      <div className={DIVIDER} />

      <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Top Holdings</div>
      {wallet.holdings.length === 0 ? (
        <p className="text-sm text-neutral-500">No significant holdings.</p>
      ) : (
        <ul className="space-y-1">
          {wallet.holdings.map((h, i) => (
            <li
              // Holdings are a stable, pre-sorted snapshot; index is a stable key
              // and avoids collisions when two holdings share a symbol.
              key={`${i}-${h.symbol}`}
              className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-neutral-100 dark:hover:bg-surface-dark-100"
            >
              <CoinIcon src={h.imgUrl} symbol={h.symbol} size="sm" />
              <span className="w-16 truncate text-sm font-medium text-neutral-900 dark:text-neutral-50">
                {h.symbol}
              </span>
              <span className="w-10 text-right text-xs text-neutral-500">{formatShare(h.pct)}</span>
              <span className="flex-1 text-right text-sm text-neutral-900 dark:text-neutral-50">
                {formatUsd(h.usd)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className={DIVIDER} />

      <a
        href={explorerAddressUrl(wallet.chain, wallet.address)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        View on {explorerName(wallet.chain)}
      </a>
    </div>
  )
}
