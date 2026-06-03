// Unknown-address state (UX §3D): say what we honestly know, offer outbound links.
// CoinStats has a ~few-hour indexing lag (SPEC §9), so a brand-new token contract that
// isn't listed yet lands here — DexScreener usually has it before CoinStats does.
import type { Chain } from '@alphapeek/shared'
import { ExternalLink } from 'lucide-react'
import { dexScreenerUrl, explorerAddressUrl, explorerName } from '@/lib/chain'
import { truncateAddress } from '@/lib/format'

type Props = {
  addr: string
  chain: Chain
}

export function UnknownView({ addr, chain }: Props) {
  return (
    <div className="px-4 py-4">
      <div className="font-mono text-sm text-neutral-900 dark:text-neutral-50">
        {truncateAddress(addr)}
      </div>
      <p className="mt-2 text-sm text-neutral-500">
        No data yet. This could be a brand-new token that isn&apos;t indexed yet, a fresh or empty
        wallet, or an unsupported chain.
      </p>
      <div className="mt-3 flex items-center gap-4">
        <a
          href={dexScreenerUrl(chain, addr)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          DEXScreener
        </a>
        <a
          href={explorerAddressUrl(chain, addr)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          {explorerName(chain)}
        </a>
      </div>
    </div>
  )
}
