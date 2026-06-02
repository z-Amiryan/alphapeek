// Popup "Recent lookups" (UX §7). Bumping `reloadToken` forces a re-fetch after a
// manual lookup writes a new entry.
import { useEffect, useState } from 'react'
import { formatCompact, formatPrice, truncateAddress } from '@/lib/format'
import { type CacheEntry, recentLookups } from '@/services/cache'

type Props = {
  reloadToken: number
}

function describe(entry: CacheEntry): { label: string; value: string } {
  const { result } = entry
  if (result.kind === 'token') {
    return { label: result.data.symbol, value: formatPrice(result.data.price) }
  }
  if (result.kind === 'wallet') {
    return { label: 'Wallet', value: formatCompact(result.data.totalUsd) }
  }
  return { label: 'Unknown', value: '' }
}

export function RecentLookups({ reloadToken }: Props) {
  const [entries, setEntries] = useState<CacheEntry[]>([])

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloadToken is an intentional re-fetch trigger, not read in the body
  useEffect(() => {
    let active = true
    recentLookups(5).then((rows) => {
      if (active) setEntries(rows)
    })
    return () => {
      active = false
    }
  }, [reloadToken])

  if (entries.length === 0) {
    return <p className="text-[12px] text-dim">No recent lookups yet.</p>
  }

  return (
    <div className="-mx-[13px]">
      {entries.map((entry) => {
        const { label, value } = describe(entry)
        return (
          <div
            key={entry.key}
            className="flex cursor-pointer items-center gap-[10px] border-t border-line px-[13px] py-[9px] transition-colors duration-tm hover:bg-bg"
          >
            <span className="text-[12px] font-bold tracking-[0.02em]">
              {truncateAddress(entry.addr)}
            </span>
            <span className="flex-1 truncate text-[11px] uppercase tracking-[0.04em] text-dim">
              {label}
            </span>
            <span className="text-[12px] font-bold tabular-nums">{value}</span>
          </div>
        )
      })}
    </div>
  )
}
