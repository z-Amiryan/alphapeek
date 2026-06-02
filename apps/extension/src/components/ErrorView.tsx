// Error state (UX §3E). Per-code copy; retry is offered only where it could help.
import type { LookupErrorCode } from '@alphapeek/shared'
import { AlertTriangle } from 'lucide-react'

type Props = {
  code?: LookupErrorCode
  onRetry?: () => void
}

const MESSAGES: Record<LookupErrorCode, string> = {
  invalid_address: "That doesn't look like a valid EVM address.",
  rate_limited: "You're checking addresses faster than we can keep up. Try again in a minute.",
  daily_cap_reached: 'AlphaPeek is taking a quick breather. Try again tomorrow.',
  upstream_error: 'Network error. Try again in a moment.',
}

export function ErrorView({ code = 'upstream_error', onRetry }: Props) {
  const showRetry = Boolean(onRetry) && (code === 'upstream_error' || code === 'rate_limited')

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-2 text-neutral-900 dark:text-neutral-50">
        <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
        <span className="text-sm font-medium">Couldn't load this address</span>
      </div>
      <p className="mt-2 text-sm text-neutral-500">{MESSAGES[code]}</p>
      {showRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}
