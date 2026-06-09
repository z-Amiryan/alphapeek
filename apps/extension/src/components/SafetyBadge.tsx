// Contract-safety verdict chip (UX: the v0.2 headline). Sits directly under the
// token header so it's the first thing the eye lands on. The detail breakdown
// lives in SafetyDetails; this is the at-a-glance read. The "i" marker carries the
// GoPlus attribution + disclaimer on hover — anchored here (not in SafetyDetails)
// because the badge always renders when safety exists, while the detail section
// drops out for a clean token, which must still credit its data source.
import type { SafetyVerdict, TokenSafety } from '@alphapeek/shared'
import { InfoTooltip } from './InfoTooltip'

// Each verdict adds exactly one fill/outline treatment in the Terminal palette:
// safe = up-green fill, danger = down-red fill, caution = amber outline, unknown =
// hairline grey. Mirrors the change-pill convention so it reads as "status".
const VERDICT: Record<SafetyVerdict, { label: string; cls: string }> = {
  safe: { label: 'Safe', cls: 'border-up bg-up text-up-ink' },
  caution: { label: 'Caution', cls: 'border-warn text-warn' },
  danger: { label: 'Risk', cls: 'border-down bg-down text-down-ink' },
  unknown: { label: 'Unverified', cls: 'border-line text-dim' },
}

export function SafetyBadge({ safety }: { safety: TokenSafety }) {
  const v = VERDICT[safety.verdict]
  // Only verdict-driving flags count as "issues"; informational notes don't.
  const count = safety.flags.length

  return (
    <div className="flex items-center gap-2 border-b-[1.5px] border-line px-[13px] py-[8px]">
      <span className="text-[9px] uppercase tracking-[0.12em] text-dim">Contract</span>
      <span
        className={`shrink-0 border-[1.5px] px-[7px] py-[3px] text-[10px] font-bold uppercase tracking-[0.1em] ${v.cls}`}
      >
        {v.label}
      </span>
      <span className="ml-auto truncate text-[10px] uppercase tracking-[0.06em] text-dim">
        {safety.verdict === 'safe'
          ? 'No critical risks'
          : `${count} ${count === 1 ? 'issue' : 'issues'}`}
      </span>
      <InfoTooltip label="Contract-safety data source">
        Security checks by <span className="font-bold text-fg">GoPlus</span>. Informational only —
        not financial advice.
      </InfoTooltip>
    </div>
  )
}
