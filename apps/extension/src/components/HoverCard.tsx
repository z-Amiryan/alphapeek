// Owns the lookup lifecycle and positions the card against the hovered address
// via Floating UI. Pointer-enter/leave bubble to the content script so it can run
// the grace period that lets the user move from the address onto the card (UX §1).
import { DEFAULT_CHAIN } from '@alphapeek/shared'
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react'
import { useEffect, useId, useState } from 'react'
import {
  requestCoinLookup,
  requestLookup,
  requestSolLookup,
  requestSymbolLookup,
} from '@/services/messaging'
import type { Target } from '@/shadow/mount'
import { type LookupState, ResultView } from './ResultView'
import { CARD } from './ui'

type Props = {
  target: Target
  anchor: HTMLElement
  theme: 'light' | 'dark'
  onClose: () => void
  onPointerEnter: () => void
  onPointerLeave: () => void
}

// Sit above X's UI (z-index uses the max 32-bit signed value).
const TOP_LAYER = 2147483647

export function HoverCard({
  target,
  anchor,
  theme,
  onClose,
  onPointerEnter,
  onPointerLeave,
}: Props) {
  const [state, setState] = useState<LookupState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const cardId = useId()
  // ResultView/TokenView take addr+chain for the address card's explorer links; a coin
  // card has neither, so pass empty/default — TokenView drops the DEX link when addr is ''.
  const addr = target.kind === 'address' ? target.addr : ''
  const chain = target.kind === 'address' ? target.chain : DEFAULT_CHAIN

  const { refs, floatingStyles, isPositioned } = useFloating({
    placement: 'top',
    strategy: 'fixed',
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
    elements: { reference: anchor },
  })

  // Fetch on mount and whenever a retry bumps `attempt`.
  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt is an intentional retry trigger, not read in the body
  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    const lookup =
      target.kind === 'address'
        ? requestLookup(target.addr, target.chain)
        : target.kind === 'coin'
          ? requestCoinLookup(target.coinId)
          : target.kind === 'symbol'
            ? requestSymbolLookup(target.symbol)
            : requestSolLookup(target.mint)
    lookup.then((res) => {
      if (!active) return
      setState(
        res.ok ? { status: 'ready', result: res.data } : { status: 'error', code: res.error },
      )
    })
    return () => {
      active = false
    }
  }, [target, attempt])

  // Associate the anchor with the card for assistive tech (UX §6).
  useEffect(() => {
    anchor.setAttribute('aria-describedby', cardId)
    return () => anchor.removeAttribute('aria-describedby')
  }, [anchor, cardId])

  // Esc and outside pointer-down dismiss the card (UX §5.8).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onDown = (e: MouseEvent) => {
      const path = e.composedPath()
      const floating = refs.floating.current
      if (!path.includes(anchor) && floating && !path.includes(floating)) {
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onDown, true)
    }
  }, [anchor, onClose, refs.floating])

  return (
    <div
      ref={refs.setFloating}
      // Until Floating UI has measured the anchor, floatingStyles default to the
      // top-left corner; render hidden until positioned so the card doesn't flash
      // there for a frame before snapping into place.
      style={{
        ...floatingStyles,
        zIndex: TOP_LAYER,
        visibility: isPositioned ? 'visible' : 'hidden',
      }}
      className={`ap-root ${theme === 'dark' ? 'dark' : ''}`}
    >
      <div
        id={cardId}
        role="tooltip"
        tabIndex={-1}
        onMouseEnter={onPointerEnter}
        onMouseLeave={onPointerLeave}
        className={CARD}
      >
        <ResultView
          state={state}
          addr={addr}
          chain={chain}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      </div>
    </div>
  )
}
