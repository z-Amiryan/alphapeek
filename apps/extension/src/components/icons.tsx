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

// AlphaPeek brand mark: the Terminal system's offset "data card" motif (an
// outlined card peeking out behind a solid lime front-card) on an ink field,
// with an ink stepped-sparkline inside — the wallet/token card you peek,
// trending up. The lime card reads against the ink field; the ink sparkline
// reads against the card. The brand hexes are intentionally hard-coded and MUST
// stay in sync with public/icon.svg and the full-size (48/128) render in
// scripts/make-icons.mjs. Pass `animated` to draw the sparkline in on mount
// (used by the popup, which remounts on every open).
export function LogoMark({ animated = false }: { animated?: boolean }) {
  return (
    <span className="relative inline-flex h-[18px] w-[18px] shrink-0">
      <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
        <rect width="40" height="40" fill="#0d0d0d" />
        <rect
          x="13"
          y="13"
          width="20"
          height="20"
          fill="#0d0d0d"
          stroke="#c6f432"
          strokeWidth="2.2"
        />
        <rect x="7" y="7" width="20" height="20" fill="#c6f432" />
        <path
          d="M10.5 21 H14 V16.5 H17.5 V18.5 H21 V12.5"
          fill="none"
          stroke="#0d0d0d"
          strokeWidth="2"
          strokeLinecap="square"
          strokeLinejoin="miter"
          pathLength={100}
          className={animated ? 'ap-logo-line' : undefined}
        />
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
