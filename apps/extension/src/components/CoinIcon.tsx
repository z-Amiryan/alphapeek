// Falls back to a lettered bubble when the image is missing or fails (UX #9).
// Decorative — the symbol is always shown as text alongside, so it's aria-hidden.
import { useState } from 'react'
import { initial } from '@/lib/format'

type Props = {
  src: string
  symbol: string
  size?: 'sm' | 'md'
}

const SIZE_CLASS: Record<'sm' | 'md', string> = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
}

export function CoinIcon({ src, symbol, size = 'sm' }: Props) {
  const [failed, setFailed] = useState(false)
  const sizeClass = SIZE_CLASS[size]

  if (!src || failed) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-neutral-100 font-medium text-neutral-500 dark:bg-surface-dark-100 ${sizeClass}`}
      >
        {initial(symbol)}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover ${sizeClass}`}
    />
  )
}
