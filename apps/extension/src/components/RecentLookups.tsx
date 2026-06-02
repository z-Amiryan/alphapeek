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
    return <p className="text-sm text-neutral-500">No recent lookups yet.</p>
  }

  return (
    <ul className="space-y-1">
      {entries.map((entry) => {
        const { label, value } = describe(entry)
        return (
          <li
            key={entry.key}
            className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-surface-dark-100"
          >
            <span className="font-mono text-neutral-900 dark:text-neutral-50">
              {truncateAddress(entry.addr)}
            </span>
            <span className="flex-1 truncate text-neutral-500">{label}</span>
            <span className="text-neutral-900 dark:text-neutral-50">{value}</span>
          </li>
        )
      })}
    </ul>
  )
}
