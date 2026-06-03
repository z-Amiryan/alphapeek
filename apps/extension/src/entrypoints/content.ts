// Hover detection loop for X/Twitter (SPEC §5, UX §1). One delegated mouseover
// listener on document.body; we never pre-scan, so we stay leak-free on X's
// virtualized feed. caretRangeFromPoint limits inspection to the string under the
// cursor. 200ms delay debounces pass-overs; a 100ms grace on leave lets the cursor
// travel onto the card. The card lives in an isolated shadow root (shadow/mount.ts).
import { type Chain, isChain } from '@alphapeek/shared'
import { browser } from 'wxt/browser'
import { inferChainForAddress } from '@/lib/chain'
import { debugError } from '@/lib/debug'
import { findAddress } from '@/lib/regex'
import { DEFAULT_CHAIN_KEY, getDefaultChain } from '@/services/settings'
import { type CardHandle, mountCard } from '@/shadow/mount'
import '@/shadow/styles.css'

const HOVER_DELAY = 200
const DISMISS_GRACE = 100
const UNDERLINE_CLASS = 'alphapeek-hover'
const STYLE_ID = 'alphapeek-underline-style'

export default defineContentScript({
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  // 'ui' keeps our Tailwind out of the page and lets createShadowRootUi inject
  // it into the card's shadow root instead.
  cssInjectionMode: 'ui',
  async main(ctx) {
    let defaultChain: Chain = await getDefaultChain()

    // Keep the inferred fallback fresh if the user changes it in the popup.
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return
      const next = changes[DEFAULT_CHAIN_KEY]?.newValue
      if (typeof next === 'string' && isChain(next)) defaultChain = next
    })

    let activeAnchor: HTMLElement | null = null
    let pendingAddr: string | null = null
    let hoverTimer: ReturnType<typeof setTimeout> | undefined
    let dismissTimer: ReturnType<typeof setTimeout> | undefined
    let card: CardHandle | null = null
    let cardAddr: string | null = null
    let pointerOnCard = false
    // Live cursor position, used to sanity-check dismissals against real geometry.
    let lastX = 0
    let lastY = 0

    ensureUnderlineStyle()

    function reset(): void {
      clearTimeout(hoverTimer)
      clearTimeout(dismissTimer)
      hoverTimer = undefined
      dismissTimer = undefined
      if (card) {
        card.remove()
        card = null
      }
      cardAddr = null
      pointerOnCard = false
      if (activeAnchor) {
        activeAnchor.classList.remove(UNDERLINE_CLASS)
        activeAnchor.removeEventListener('mouseleave', onAnchorLeave)
        activeAnchor = null
      }
      pendingAddr = null
    }

    // A fixed, top-layer card overlapping the anchor (plus the shadow-root boundary) makes the
    // browser fire a spurious `mouseleave` on the anchor the moment the card mounts — while the
    // cursor is geometrically still on the address. That was the show/hide flicker. So before
    // tearing down, re-check real cursor geometry: keep the card if the cursor is still inside
    // the anchor's box or over the card host.
    function cursorOverAnchorOrCard(): boolean {
      if (activeAnchor) {
        const r = activeAnchor.getBoundingClientRect()
        if (lastX >= r.left && lastX <= r.right && lastY >= r.top && lastY <= r.bottom) return true
      }
      if (card && document.elementFromPoint(lastX, lastY)?.closest('alphapeek-card')) return true
      return false
    }

    function scheduleDismiss(): void {
      clearTimeout(dismissTimer)
      dismissTimer = setTimeout(() => {
        if (pointerOnCard || cursorOverAnchorOrCard()) return
        reset()
      }, DISMISS_GRACE)
    }

    function onAnchorLeave(): void {
      // Cancel a not-yet-fired show (UX edge: leave before 200ms → no card),
      // and start the grace period that allows moving onto the card.
      clearTimeout(hoverTimer)
      hoverTimer = undefined
      scheduleDismiss()
    }

    async function showCard(anchor: HTMLElement, addr: string, chain: Chain): Promise<void> {
      hoverTimer = undefined
      // Bail if the target changed while the timer was pending.
      if (activeAnchor !== anchor || pendingAddr !== addr) return

      // Replacing a card on the same anchor (e.g. a second address in one
      // element): tear the old one down so it can't dangle.
      if (card) {
        card.remove()
        card = null
        cardAddr = null
      }

      try {
        const handle = await mountCard(ctx, {
          addr,
          chain,
          anchor,
          theme: detectTheme(),
          onClose: reset,
          onPointerEnter: () => {
            pointerOnCard = true
            clearTimeout(dismissTimer)
          },
          onPointerLeave: () => {
            pointerOnCard = false
            scheduleDismiss()
          },
        })
        // Target may have changed during the async mount; discard if so.
        if (activeAnchor !== anchor || pendingAddr !== addr) {
          handle.remove()
          return
        }
        card = handle
        cardAddr = addr
      } catch (err) {
        debugError('mountCard failed', err)
      }
    }

    function scheduleShow(anchor: HTMLElement, addr: string, context: string): void {
      clearTimeout(hoverTimer)
      clearTimeout(dismissTimer)

      if (anchor !== activeAnchor) {
        reset()
        activeAnchor = anchor
        anchor.classList.add(UNDERLINE_CLASS)
        anchor.addEventListener('mouseleave', onAnchorLeave)
      }
      pendingAddr = addr

      const chain = inferChainForAddress(context, addr, defaultChain)
      hoverTimer = setTimeout(() => {
        void showCard(anchor, addr, chain)
      }, HOVER_DELAY)
    }

    function onMouseMove(e: MouseEvent): void {
      lastX = e.clientX
      lastY = e.clientY
    }

    function onMouseOver(e: MouseEvent): void {
      lastX = e.clientX
      lastY = e.clientY
      if (pointerOnCard) return
      const node = textNodeAt(e.clientX, e.clientY)
      const text = node?.textContent
      // Quick reject before running the regex.
      if (!text || !text.includes('0x')) return
      const addr = findAddress(text)
      if (!addr) return
      const anchor = node?.parentElement
      if (!anchor) return
      // Already showing this exact target → nothing to do.
      if (card && cardAddr === addr && activeAnchor === anchor) return
      scheduleShow(anchor, addr, text)
    }

    document.body.addEventListener('mouseover', onMouseOver)
    // Passive cursor tracking so the dismiss-time geometry check uses the live position
    // (mouseover only fires on enter, not while the cursor sits on the address).
    document.addEventListener('mousemove', onMouseMove, { passive: true })

    // X virtualizes its feed: if the anchored node is detached (tweet recycled),
    // tear the card down so it can't dangle (UX edge #5). This is the only job of
    // the observer — we never eagerly scan (SPEC §5).
    const observer = new MutationObserver(() => {
      if (activeAnchor && !activeAnchor.isConnected) reset()
    })
    observer.observe(document.body, { childList: true, subtree: true })

    ctx.onInvalidated(() => {
      reset()
      observer.disconnect()
      document.body.removeEventListener('mouseover', onMouseOver)
      document.removeEventListener('mousemove', onMouseMove)
    })
  },
})

function textNodeAt(x: number, y: number): Text | null {
  const range = document.caretRangeFromPoint(x, y)
  if (!range) return null
  const node = range.startContainer
  return node.nodeType === Node.TEXT_NODE ? (node as Text) : null
}

function ensureUnderlineStyle(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `.${UNDERLINE_CLASS}{border-bottom:1px dotted currentColor;cursor:help;}`
  document.head.appendChild(style)
}

// X exposes no stable theme attribute, so derive it from body background
// luminance (covers light/dim/lights-out), falling back to the OS preference.
function detectTheme(): 'light' | 'dark' {
  const rgb = getComputedStyle(document.body).backgroundColor.match(/\d+/g)
  if (rgb && rgb.length >= 3) {
    const r = Number(rgb[0])
    const g = Number(rgb[1])
    const b = Number(rgb[2])
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b
    return luminance < 128 ? 'dark' : 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
