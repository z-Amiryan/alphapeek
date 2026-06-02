// Popup header: live Fear & Greed index (UX §7). The face emoji and label both
// carry the signal, so color is never the only cue (UX §6).
import type { FearGreed } from '@alphapeek/shared'
import { useEffect, useState } from 'react'
import { requestFearGreed } from '@/services/messaging'

type State = { status: 'loading' } | { status: 'ready'; data: FearGreed } | { status: 'error' }

function faceFor(value: number): string {
  if (value <= 25) return '😨'
  if (value <= 45) return '😟'
  if (value <= 55) return '😐'
  if (value <= 75) return '🙂'
  return '🤑'
}

export function FearGreedBadge() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let active = true
    requestFearGreed().then((res) => {
      if (!active) return
      setState(res.ok ? { status: 'ready', data: res.data } : { status: 'error' })
    })
    return () => {
      active = false
    }
  }, [])

  if (state.status === 'loading') {
    return <div className="text-sm text-neutral-500">Loading market mood…</div>
  }
  if (state.status === 'error') {
    return <div className="text-sm text-neutral-500">Fear &amp; Greed unavailable</div>
  }

  const { value, label } = state.data
  return (
    <div className="flex items-center gap-2 text-sm text-neutral-900 dark:text-neutral-50">
      <span aria-hidden="true">{faceFor(value)}</span>
      <span className="font-medium">Fear &amp; Greed: {value}</span>
      <span className="text-neutral-500">— {label}</span>
    </div>
  )
}
