// Contract-safety breakdown for the token card: buy/sell tax + the severity-ranked
// findings (worst first, capped to keep the hover card compact). Pairs with
// SafetyBadge, which owns the verdict header plus the GoPlus attribution + disclaimer
// (its "i" marker) — so this section stays pure data, no second "Contract" label.
import type { SafetyFlag, TokenSafety } from '@alphapeek/shared'

const FLAG_LABELS: Record<SafetyFlag, string> = {
  honeypot: 'Honeypot',
  cant_sell_all: "Can't sell all",
  high_buy_tax: 'High buy tax',
  high_sell_tax: 'High sell tax',
  mintable: 'Mintable supply',
  owner_privileges: 'Owner privileges',
  proxy: 'Proxy contract',
  unverified_source: 'Unverified source',
  blacklist: 'Blacklist function',
  transfer_pausable: 'Pausable transfers',
  mint_authority: 'Mint authority',
  freeze_authority: 'Freeze authority',
  mutable_metadata: 'Mutable metadata',
}

// Show the worst few inline; summarize the rest. Hover cards are small and
// ephemeral, so a "+N more" tail beats an expander that fights dismiss-on-mouseout.
const MAX_INLINE_FLAGS = 3

function formatTax(pct: number | null): string {
  return pct === null ? '—' : `${pct}%`
}

export function SafetyDetails({ safety }: { safety: TokenSafety }) {
  const { flags, notes, buyTaxPct, sellTaxPct } = safety
  const hasTax = buyTaxPct !== null || sellTaxPct !== null
  if (flags.length === 0 && notes.length === 0 && !hasTax) return null

  const shown = flags.slice(0, MAX_INLINE_FLAGS)
  const extra = flags.length - shown.length

  return (
    <div className="flex flex-col gap-2 border-t-[1.5px] border-line px-[13px] py-[10px]">
      {hasTax ? (
        <div className="flex gap-5 text-[11px]">
          <span className="text-dim">
            Buy tax <span className="font-bold tabular-nums text-fg">{formatTax(buyTaxPct)}</span>
          </span>
          <span className="text-dim">
            Sell tax <span className="font-bold tabular-nums text-fg">{formatTax(sellTaxPct)}</span>
          </span>
        </div>
      ) : null}

      {shown.length > 0 || notes.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {/* Verdict-driving risks: amber warning chips. */}
          {shown.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-[5px] whitespace-nowrap border-[1.5px] border-warn px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-warn"
            >
              ⚠ {FLAG_LABELS[f]}
            </span>
          ))}
          {extra > 0 ? (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-dim">
              +{extra} more
            </span>
          ) : null}
          {/* Informational capabilities: neutral hairline chips (no warning color). */}
          {notes.map((n) => (
            <span
              key={n}
              className="inline-flex items-center whitespace-nowrap border-[1.5px] border-line px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-dim"
            >
              {FLAG_LABELS[n]}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
