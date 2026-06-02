// 7-day price sparkline (UX §3B). Stroke is currentColor, so the caller sets it
// via a Tailwind text class.
type Props = {
  data: number[]
  className?: string
}

export function Sparkline({ data, className }: Props) {
  if (data.length < 2) return null

  const width = 100
  const height = 100
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const v of data) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const range = max - min || 1
  const step = width / (data.length - 1)
  const points = data
    .map((v, i) => `${(i * step).toFixed(2)},${(height - ((v - min) / range) * height).toFixed(2)}`)
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label="7-day price chart"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
