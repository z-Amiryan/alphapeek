// Unknown-address state (UX §3D): say what we know, offer a block-explorer link.
import type { Chain } from '@alphapeek/shared'
import { ExternalLink } from 'lucide-react'
import { explorerAddressUrl, explorerName } from '@/lib/chain'
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
        No data found for this address. It might be a fresh wallet or an unsupported chain.
      </p>
      <a
        href={explorerAddressUrl(chain, addr)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        Check on {explorerName(chain)}
      </a>
    </div>
  )
}
