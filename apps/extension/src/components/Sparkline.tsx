// 7-day price sparkline, rendered as a stepped (sample-and-hold) path to match
// the Terminal design. Stroke is currentColor, so the caller picks the tone
// (lime up / red down) via a Tailwind text class.
type Props = {
  data: number[]
  className?: string
}

const W = 290
const H = 44
const PAD = 2

export function Sparkline({ data, className }: Props) {
  if (data.length < 2) return null

  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const v of data) {
    if (v < min) min = v
    if (v > max) max = v
  }
  const range = max - min || 1

  const x = (i: number) => PAD + (i / (data.length - 1)) * (W - PAD * 2)
  const y = (v: number) => PAD + (1 - (v - min) / range) * (H - PAD * 2)

  // Stepped path: hold the previous level horizontally, then step to the new one.
  const first = data[0] ?? min
  let d = `M${x(0).toFixed(1)},${y(first).toFixed(1)}`
  for (let i = 1; i < data.length; i++) {
    const v = data[i] ?? min
    d += ` H${x(i).toFixed(1)} V${y(v).toFixed(1)}`
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      role="img"
      aria-label="7-day price chart"
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
