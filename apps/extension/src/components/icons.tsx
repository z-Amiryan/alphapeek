// Inline UI icons for the Terminal design — drawn as a few path commands with
// square caps to match the neo-brutalist line work. Decorative; callers label
// the surrounding control, so these are aria-hidden.
type IconProps = {
  size?: number
}

// Outbound box-arrow, paired with footer/link buttons.
export function ArrowOut({ size = 11 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d="M5 11 11 5M6 5h5v5" />
    </svg>
  )
}

// AlphaPeek brand mark: electric-lime tile with an ink stepped-sparkline glyph
// whose trailing detached pixel reads as the value being "peeked." Mirrored by
// the toolbar icon (public/icon.svg + scripts/make-icons.mjs) — keep in sync.
export function LogoMark() {
  return (
    <span className="relative inline-flex h-[18px] w-[18px] shrink-0 bg-acc text-acc-ink">
      <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
        <path
          d="M7 25 H13 V19 H19 V22 H25 V13 H33"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        <rect x="31.5" y="11.5" width="3.4" height="3.4" fill="currentColor" />
      </svg>
    </span>
  )
}

// Downward chevron for the custom select control.
export function Chevron({ size = 13 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  )
}
