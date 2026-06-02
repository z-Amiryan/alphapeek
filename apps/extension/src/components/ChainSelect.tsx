// Custom-chromed chain dropdown for the popup (Terminal pattern). Native <select>
// for accessibility/keyboard, with the platform chevron swapped for our inline one.
import { type Chain, CHAIN_LABELS, SUPPORTED_CHAINS } from '@alphapeek/shared'
import { Chevron } from './icons'

type Props = {
  id?: string
  ariaLabel?: string
  value: Chain
  onChange: (chain: Chain) => void
  className?: string
}

export function ChainSelect({ id, ariaLabel, value, onChange, className = '' }: Props) {
  return (
    <div className={`relative inline-flex ${className}`}>
      <select
        id={id}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value as Chain)}
        className="h-[38px] w-full cursor-pointer appearance-none border-[1.5px] border-line bg-bg pl-[11px] pr-[30px] text-[13px] font-bold text-fg outline-none transition-colors duration-tm focus:border-acc"
      >
        {SUPPORTED_CHAINS.map((c) => (
          <option key={c} value={c}>
            {CHAIN_LABELS[c]}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-[9px] top-1/2 -translate-y-1/2 text-dim">
        <Chevron />
      </span>
    </div>
  )
}
