// Unknown-address state (UX §3D) in the Terminal pattern: a plain state bar that
// says what we honestly know, plus a block-explorer link. CoinStats has a
// few-hour indexing lag (SPEC §9), so a brand-new contract can land here too.
import type { Chain } from '@alphapeek/shared'
import { explorerAddressUrl, explorerName } from '@/lib/chain'
import { truncateAddress } from '@/lib/format'
import { ArrowOut } from './icons'
import { BTN } from './ui'

type Props = {
  addr: string
  chain: Chain
}

export function UnknownView({ addr, chain }: Props) {
  return (
    <div>
      <div className="flex items-center gap-2 border-b-[1.5px] border-line px-[13px] py-[9px] text-dim">
        <span className="h-[13px] w-[13px] shrink-0 border-[1.5px] border-dim" />
        <span className="text-[11px] font-bold uppercase tracking-[0.1em]">No Data</span>
      </div>
      <div className="px-[13px] py-[14px]">
        <div className="whitespace-nowrap text-[13px] font-bold tracking-[0.02em]">
          {truncateAddress(addr)}
        </div>
        <p className="mt-[10px] text-[12px] leading-[1.5] text-dim">
          No data found for this address. It might be a fresh wallet, an unindexed token, or an
          unsupported chain.
        </p>
      </div>
      <div className="flex border-t-[1.5px] border-line">
        <a
          href={explorerAddressUrl(chain, addr)}
          target="_blank"
          rel="noopener noreferrer"
          className={BTN}
        >
          Check on {explorerName(chain)} <ArrowOut />
        </a>
      </div>
    </div>
  )
}
