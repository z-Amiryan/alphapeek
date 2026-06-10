// Unknown-address state (UX §3D) in the Terminal pattern: a plain state bar that
// says what we honestly know, plus a block-explorer link. CoinStats has a
// few-hour indexing lag (SPEC §9), so a brand-new contract can land here too.
import type { Chain } from '@alphapeek/shared'
import { dexScreenerSearchUrl, explorerAddressUrl, explorerName } from '@/lib/chain'
import { truncateAddress } from '@/lib/format'
import { ArrowOut } from './icons'
import { BTN } from './ui'

type Props = {
  addr: string
  chain: Chain
}

export function UnknownView({ addr, chain }: Props) {
  // A cashtag lookup ($TICKER / long-tail) has no hovered address, so the address line and
  // the explorer/DexScreener links (which need one) would render empty/broken — omit them.
  const hasAddr = addr.length > 0
  return (
    <div>
      <div className="flex items-center gap-2 border-b-[1.5px] border-line px-[13px] py-[9px] text-dim">
        <span className="h-[13px] w-[13px] shrink-0 border-[1.5px] border-dim" />
        <span className="text-[11px] font-bold uppercase tracking-[0.1em]">No Data</span>
      </div>
      <div className="px-[13px] py-[14px]">
        {hasAddr ? (
          <div className="whitespace-nowrap text-[13px] font-bold tracking-[0.02em]">
            {truncateAddress(addr)}
          </div>
        ) : null}
        <p className={`text-[12px] leading-[1.5] text-dim${hasAddr ? ' mt-[10px]' : ''}`}>
          {hasAddr
            ? 'No data found for this address. It might be a fresh wallet, an unindexed token, or an unsupported chain.'
            : 'No market data found for this token right now. It might be too new or not yet indexed.'}
        </p>
      </div>
      {hasAddr ? (
        <div className="flex border-t-[1.5px] border-line">
          <a
            href={explorerAddressUrl(chain, addr)}
            target="_blank"
            rel="noopener noreferrer"
            className={BTN}
          >
            {explorerName(chain)} <ArrowOut />
          </a>
          {/* A fresh token too new even for DexScreener's free index can still surface here. */}
          <a
            href={dexScreenerSearchUrl(addr)}
            target="_blank"
            rel="noopener noreferrer"
            className={BTN}
          >
            DexScreener <ArrowOut />
          </a>
        </div>
      ) : null}
    </div>
  )
}
