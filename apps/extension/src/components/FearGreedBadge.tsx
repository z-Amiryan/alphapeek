// Popup market-mood gauge (UX §7): a segmented equalizer. The numeric value and
// the zone label both carry the signal, so color is never the only cue (UX §6).
import { useEffect, useState } from 'react'
import { requestFearGreed } from '@/services/messaging'

type State =
  | { status: 'loading' }
  | { status: 'ready'; value: number; label: string }
  | { status: 'error' }

const CELLS = 20

export function FearGreedBadge() {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let active = true
    requestFearGreed().then((res) => {
      if (!active) return
      setState(
        res.ok
          ? { status: 'ready', value: res.data.value, label: res.data.label }
          : { status: 'error' },
      )
    })
    return () => {
      active = false
    }
  }, [])

  const value = state.status === 'ready' ? state.value : 0
  const on = Math.round((value / 100) * CELLS)
  const zone =
    state.status === 'ready' ? state.label : state.status === 'error' ? 'Unavailable' : 'Loading'

  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-dim">Market Mood</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-[20px] font-bold tabular-nums">
          {state.status === 'ready' ? value : '—'}
        </span>
        <span className="text-[12px] font-bold uppercase tracking-[0.06em]">{zone}</span>
      </div>
      <div
        className="mt-[10px] flex h-[14px] gap-0.5"
        role="img"
        aria-label={`Fear and Greed ${state.status === 'ready' ? `${value}, ${zone}` : zone}`}
      >
        {Array.from({ length: CELLS }).map((_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length gauge; segments have no stable identity other than position
            key={i}
            className={`flex-1 border-[1.5px] ${i < on ? 'border-acc bg-acc' : 'border-line'}`}
          />
        ))}
      </div>
    </div>
  )
}
