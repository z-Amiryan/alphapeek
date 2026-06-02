// Error state (UX §3E) in the Terminal pattern. Red state bar = hard error;
// amber = back off / capacity. Retry is offered only where it could help.
import type { LookupErrorCode } from '@alphapeek/shared'
import { BTN_SOLID } from './ui'

type Props = {
  code?: LookupErrorCode
  onRetry?: () => void
}

type ErrorConfig = {
  kind: 'err' | 'warn'
  title: string
  message: string
  retry: boolean
}

const CONFIG: Record<LookupErrorCode, ErrorConfig> = {
  upstream_error: {
    kind: 'err',
    title: 'Connection Failed',
    message: 'Network error. Try again in a moment.',
    retry: true,
  },
  rate_limited: {
    kind: 'warn',
    title: 'Rate Limited',
    message: "You're checking addresses faster than we can keep up. Try again in a minute.",
    retry: true,
  },
  daily_cap_reached: {
    kind: 'warn',
    title: 'Daily Cap Reached',
    message: 'AlphaPeek is taking a quick breather. Try again tomorrow.',
    retry: false,
  },
  invalid_address: {
    kind: 'err',
    title: 'Invalid Address',
    message: "That doesn't look like a valid EVM address.",
    retry: false,
  },
}

const BAR: Record<ErrorConfig['kind'], string> = {
  err: 'border-b-down bg-down text-down-ink',
  warn: 'border-b-warn bg-warn text-acc-ink',
}

export function ErrorView({ code = 'upstream_error', onRetry }: Props) {
  const cfg = CONFIG[code]
  const showRetry = Boolean(onRetry) && cfg.retry

  return (
    <div>
      <div
        className={`flex items-center gap-2 border-b-[1.5px] px-[13px] py-[9px] ${BAR[cfg.kind]}`}
      >
        <span className="h-[13px] w-[13px] shrink-0 bg-current" />
        <span className="text-[11px] font-bold uppercase tracking-[0.1em]">{cfg.title}</span>
      </div>
      <div className="px-[13px] py-[14px]">
        <p className="text-[12px] leading-[1.5] text-dim">{cfg.message}</p>
      </div>
      {showRetry ? (
        <div className="flex border-t-[1.5px] border-line">
          <button type="button" onClick={onRetry} className={BTN_SOLID}>
            Retry
          </button>
        </div>
      ) : null}
    </div>
  )
}
