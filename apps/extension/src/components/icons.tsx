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
