// Number rules mirror UX.md §4. `Intl.*` only (no date/number libraries per
// SPEC §3); locale is pinned to en-US for stable output.

const LOCALE = 'en-US'

const usdFull = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const usdCompact = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0'
  return usdFull.format(n)
}

export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '$0'
  return usdCompact.format(n)
}

// Sub-cent prices fall back to scientific notation so they stay readable.
export function formatPrice(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '$0.00'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)

  if (abs >= 1) {
    return `${sign}${new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(abs)}`
  }
  if (abs >= 0.01) {
    return `${sign}${new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(abs)}`
  }
  return `${sign}$${abs.toExponential(1)}` // e.g. $2.4e-7
}

// Always-signed percentage to one decimal: `+12.4%`, `-0.2%`.
export function formatPct(n: number): string {
  if (!Number.isFinite(n)) return '0.0%'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

// Unsigned portfolio share for holding rows. Clamps the misleading edges: a dust
// holding shows `<1%` instead of `0%`, and a dominant-but-not-sole holding shows
// `>99%` instead of `100%` (UX.md §4).
export function formatShare(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return '0%'
  if (pct < 1) return '<1%'
  if (pct >= 100) return '100%'
  const rounded = Math.round(pct)
  return rounded >= 100 ? '>99%' : `${rounded}%`
}

// `0x1234…abcd` — first 6 and last 4 characters.
export function truncateAddress(addr: string): string {
  if (addr.length <= 11) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
