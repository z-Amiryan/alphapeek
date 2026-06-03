// Shared Terminal class strings. Footer buttons are full-width, hairline-split
// cells; the solid variant carries the accent fill. Tailwind's content scan
// picks these up because the source glob includes `.ts` files.

export const CARD =
  'w-card max-h-card overflow-y-auto border-[1.5px] border-line bg-surface text-fg shadow-tm font-mono antialiased'

export const FOOT = 'flex border-t-[1.5px] border-line'

// Colorless base: layout, hairline split, typography. Variants below each add
// exactly ONE text color, so they never collide on source order (the bug where
// `text-fg` and `text-acc-ink` both landed on the solid button and the lighter
// one won, making "Look Up" unreadable).
const BTN_BASE =
  'flex flex-1 cursor-pointer items-center justify-center gap-1.5 border-l-[1.5px] border-line px-1.5 py-[11px] text-[11px] font-bold uppercase tracking-[0.06em] no-underline transition-colors duration-tm first:border-l-0 active:translate-x-px active:translate-y-px'

export const BTN = `${BTN_BASE} text-fg hover:bg-acc hover:text-acc-ink`

export const BTN_SOLID = `${BTN_BASE} bg-acc text-acc-ink hover:bg-fg hover:text-surface`

// Micro section/field label used across the popup.
export const LABEL = 'block text-[9px] font-bold uppercase tracking-[0.14em] text-dim'
