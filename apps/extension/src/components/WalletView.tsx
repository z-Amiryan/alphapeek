// Wallet card (UX §3C) in the Terminal pattern. All-time PnL (v0.2) reads the
// smart-money signal — CoinStats has no 30d bucket, so all-time is the surfaced
// window. Footer links the block explorer (always correct) rather than a guessed
// CoinStats per-address URL with no documented format.
import type { Holding, WalletSummary } from '@alphapeek/shared'
import { CHAIN_LABELS } from '@alphapeek/shared'
import { useState } from 'react'
import { coinStatsCoinUrl, explorerAddressUrl, explorerName } from '@/lib/chain'
import { formatCompact, formatPct, formatShare, formatUsd, truncateAddress } from '@/lib/format'
import { ArrowOut } from './icons'
import { BTN } from './ui'

type Props = {
  wallet: WalletSummary
}

// Allocation-bar segment ramp (largest → smallest holding); the uncovered track
// remainder reads as "other". Index-mapped so JIT sees the literal class names.
const SEG = ['bg-seg-1', 'bg-seg-2', 'bg-seg-3', 'bg-seg-4', 'bg-seg-5'] as const

const ROW =
  'group flex items-center gap-[10px] px-[13px] py-[7px] transition-colors duration-tm [&+&]:border-t [&+&]:border-line hover:bg-bg'

// A holding deep-links to its CoinStats coin page when we have its id; otherwise it
// stays a plain row. The external-link affordance is hover-only so the card's resting
// state (and the store screenshots) are unchanged.
function HoldingRow({ holding }: { holding: Holding }) {
  const inner = (
    <>
      <span className="w-14 text-[13px] font-bold">{holding.symbol}</span>
      <span className="text-[12px] tabular-nums text-dim">{formatShare(holding.pct)}</span>
      <span className="ml-auto text-[13px] font-bold tabular-nums">{formatUsd(holding.usd)}</span>
      {holding.coinId ? (
        <span className="shrink-0 text-dim opacity-0 transition-opacity duration-tm group-hover:opacity-100">
          <ArrowOut />
        </span>
      ) : null}
    </>
  )

  if (!holding.coinId) return <div className={ROW}>{inner}</div>

  return (
    <a
      href={coinStatsCoinUrl(holding.coinId)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View ${holding.symbol} on CoinStats`}
      className={`${ROW} cursor-pointer text-fg no-underline`}
    >
      {inner}
    </a>
  )
}

export function WalletView({ wallet }: Props) {
  const [copied, setCopied] = useState(false)
  const has = wallet.holdings.length > 0

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
    <div>
      <div className="flex items-center gap-2 border-b-[1.5px] border-line px-[13px] py-[10px]">
        <span className="h-[13px] w-[13px] shrink-0 bg-acc" />
        <span className="text-[13px] font-bold tracking-[0.04em]">WALLET</span>
        <span className="ml-auto shrink-0 border-[1.5px] border-line px-1.5 py-0.5 text-[9px] font-bold tracking-[0.14em] text-dim">
          {CHAIN_LABELS[wallet.chain].toUpperCase()}
        </span>
      </div>

      <div className="px-[13px] py-[14px]">
        <div className="flex items-center justify-between gap-2">
          <span className="whitespace-nowrap text-[15px] font-bold tracking-[0.02em]">
            {truncateAddress(wallet.address)}
          </span>
          <button
            type="button"
            onClick={copy}
            aria-label="Copy address"
            className={`shrink-0 cursor-pointer border-[1.5px] px-[7px] py-[3px] text-[10px] font-bold uppercase tracking-[0.08em] transition-colors duration-tm ${
              copied
                ? 'border-acc bg-acc text-acc-ink'
                : 'border-line text-fg hover:border-acc hover:bg-acc hover:text-acc-ink'
            }`}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="mt-[14px] text-[9px] uppercase tracking-[0.14em] text-dim">
          Total Balance
        </div>
        <div className="mt-1 text-[30px] font-bold tracking-[-0.02em] tabular-nums">
          {formatUsd(wallet.totalUsd)}
        </div>

        {wallet.pnl ? (
          <div className="mt-[6px] flex items-baseline gap-2">
            <span className="text-[9px] uppercase tracking-[0.14em] text-dim">PnL · All-time</span>
            <span
              className={`text-[13px] font-bold tabular-nums ${
                wallet.pnl.pct >= 0 ? 'text-up' : 'text-down'
              }`}
            >
              {wallet.pnl.absUsd >= 0 ? '+' : ''}
              {formatCompact(wallet.pnl.absUsd)} · {formatPct(wallet.pnl.pct)}
            </span>
          </div>
        ) : null}

        {has ? (
          <>
            <div
              className="mt-[12px] flex h-[10px] gap-0.5 overflow-hidden border-[1.5px] border-line"
              role="img"
              aria-label={`Stablecoins ${formatShare(wallet.stablecoinPct)}`}
            >
              {wallet.holdings.map((h, i) => (
                <div
                  key={`${i}-${h.symbol}`}
                  className={`shrink-0 ${SEG[i % SEG.length]}`}
                  // Dynamic segment width — the one sanctioned inline-style case (CLAUDE.md).
                  style={{ width: `${h.pct}%` }}
                  title={`${h.symbol} ${formatShare(h.pct)}`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.06em] text-dim">
              <span>Allocation</span>
              <span>Stablecoins {formatShare(wallet.stablecoinPct)}</span>
            </div>
          </>
        ) : null}
      </div>

      <div className="mt-[12px] px-[13px] text-[9px] uppercase tracking-[0.14em] text-dim">
        Top Holdings
      </div>
      {has ? (
        <div className="pb-1">
          {wallet.holdings.map((h, i) => (
            // Holdings are a stable, pre-sorted snapshot; the index keeps keys
            // unique when two holdings share a symbol.
            <HoldingRow key={`${i}-${h.symbol}`} holding={h} />
          ))}
        </div>
      ) : (
        <p className="px-[13px] pb-0.5 pt-[6px] text-[12px] text-dim">No significant holdings.</p>
      )}

      <div className={`flex border-t-[1.5px] border-line ${has ? '' : 'mt-3'}`}>
        <a
          href={explorerAddressUrl(wallet.chain, wallet.address)}
          target="_blank"
          rel="noopener noreferrer"
          className={BTN}
        >
          View on {explorerName(wallet.chain)} <ArrowOut />
        </a>
      </div>
    </div>
  )
}
