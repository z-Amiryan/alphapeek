// Hover/focus tooltip on a small square "i" marker (square to stay on-system — the
// Terminal language has no rounded shapes). Pure CSS reveal works here because the
// hover card only dismisses on mouse-leave of the *whole* card, so hovering this
// marker inside it keeps the card open with no JS. Opens downward, right-aligned and
// fixed-width so it stays inside the card's clipped box (the 320px card forces
// overflow-x:auto, which would clip an overflowing popover).
import { type ReactNode, useId } from 'react'

export function InfoTooltip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId()

  return (
    <span className="group relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="flex h-[14px] w-[14px] cursor-help items-center justify-center border-[1.5px] border-dim text-[9px] font-bold normal-case leading-none text-dim transition-colors duration-tm hover:border-fg hover:text-fg focus-visible:border-fg focus-visible:text-fg"
      >
        i
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-10 mt-1.5 w-[190px] border-[1.5px] border-line bg-surface px-2 py-1.5 text-left text-[10px] normal-case leading-snug tracking-[0.02em] text-dim opacity-0 shadow-tm transition-opacity duration-tm group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {children}
      </span>
    </span>
  )
}
