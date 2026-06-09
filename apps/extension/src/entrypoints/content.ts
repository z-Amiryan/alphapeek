// Hover detection loop for X/Twitter (SPEC §5, UX §1). One delegated mouseover
// listener on document.body; we never pre-scan, so we stay leak-free on X's
// virtualized feed. caretRangeFromPoint limits inspection to the string under the
// cursor. 200ms delay debounces pass-overs; a 100ms grace on leave lets the cursor
// travel onto the card. The card lives in an isolated shadow root (shadow/mount.ts).
import { type Chain, isChain } from '@alphapeek/shared'
import { browser } from 'wxt/browser'
import { inferChainForAddress } from '@/lib/chain'
import { debugError } from '@/lib/debug'
import { findAddress, findCashtag } from '@/lib/regex'
import { requestSymbolLookup } from '@/services/messaging'
import { DEFAULT_CHAIN_KEY, getDefaultChain } from '@/services/settings'
import { type CardHandle, type Target, mountCard } from '@/shadow/mount'
import '@/shadow/styles.css'

const HOVER_DELAY = 200
const DISMISS_GRACE = 100
const UNDERLINE_CLASS = 'alphapeek-hover'
const STYLE_ID = 'alphapeek-underline-style'
// Brand-lime underline, mirroring --ap-acc in shadow/tokens.css. The page is
// outside our shadow root, so we drive the color via a CSS var set per-hover
// from the detected X theme (light vs dim/lights-out) instead of reading --ap-acc.
const UNDERLINE_VAR = '--alphapeek-acc'
const ACCENT_BY_THEME = { light: '#aad400', dark: '#c6f432' } as const

// Stable identity for a hover target (dedup "already showing this" + post-async checks).
function targetKey(target: Target): string {
  if (target.kind === 'address') return `a:${target.addr}`
  if (target.kind === 'coin') return `c:${target.coinId}`
  return `s:${target.symbol}`
}

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
    let pendingTarget: Target | null = null
    let hoverTimer: ReturnType<typeof setTimeout> | undefined
    let dismissTimer: ReturnType<typeof setTimeout> | undefined
    let card: CardHandle | null = null
    let cardKey: string | null = null
    let pointerOnCard = false
    // Monotonic show-generation. Every reset / new schedule bumps it; an in-flight showCard
    // captures its value and aborts after each await if a newer show has started. Without this,
    // two concurrent showCards for the same target (the pre-flight + mount awaits widen the
    // window) both mount, and the untracked first card orphans — the frozen top-left ghost.
    let showSeq = 0
    // Live cursor position, used to sanity-check dismissals against real geometry.
    let lastX = 0
    let lastY = 0

    ensureUnderlineStyle()

    function reset(): void {
      showSeq++
      clearTimeout(hoverTimer)
      clearTimeout(dismissTimer)
      hoverTimer = undefined
      dismissTimer = undefined
      if (card) {
        card.remove()
        card = null
      }
      cardKey = null
      pointerOnCard = false
      if (activeAnchor) {
        activeAnchor.classList.remove(UNDERLINE_CLASS)
        activeAnchor.removeEventListener('mouseleave', onAnchorLeave)
        activeAnchor = null
      }
      pendingTarget = null
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

    async function showCard(anchor: HTMLElement, target: Target, seq: number): Promise<void> {
      hoverTimer = undefined
      const key = targetKey(target)
      // Superseded if a newer show/reset bumped the generation, or the active target moved on.
      const stale = (): boolean =>
        seq !== showSeq ||
        activeAnchor !== anchor ||
        !pendingTarget ||
        targetKey(pendingTarget) !== key
      if (stale()) return

      // Long-tail $symbol: confirm the Worker resolves it to a single token BEFORE showing
      // anything, so a hovered slang word neither flashes an underline nor pops a "No data"
      // card. The result is cached, so the card's own lookup below is an instant cache hit.
      if (target.kind === 'symbol') {
        const res = await requestSymbolLookup(target.symbol)
        if (stale()) return
        if (!res.ok || res.data.kind !== 'token') return
        anchor.classList.add(UNDERLINE_CLASS)
      }

      // Replacing a card on the same anchor (e.g. a second match in one element):
      // tear the old one down so it can't dangle.
      if (card) {
        card.remove()
        card = null
        cardKey = null
      }

      try {
        const handle = await mountCard(ctx, {
          target,
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
        // A newer show started during the async mount → discard this one so it can't orphan.
        if (stale()) {
          handle.remove()
          return
        }
        card = handle
        cardKey = key
      } catch (err) {
        debugError('mountCard failed', err)
      }
    }

    function scheduleShow(anchor: HTMLElement, target: Target): void {
      clearTimeout(hoverTimer)
      clearTimeout(dismissTimer)

      if (anchor !== activeAnchor) {
        reset()
        activeAnchor = anchor
        document.documentElement.style.setProperty(UNDERLINE_VAR, ACCENT_BY_THEME[detectTheme()])
        anchor.addEventListener('mouseleave', onAnchorLeave)
        // Known-resolvable targets (addresses, whitelisted cashtags) underline immediately
        // as the discoverability cue. A long-tail $symbol underlines only once the Worker
        // confirms a single match (in showCard), so hovering slang never flashes a cue.
        if (target.kind !== 'symbol') anchor.classList.add(UNDERLINE_CLASS)
      }
      pendingTarget = target

      // Capture the generation this show belongs to so a later show/reset can supersede it.
      const seq = ++showSeq
      hoverTimer = setTimeout(() => {
        void showCard(anchor, target, seq)
      }, HOVER_DELAY)
    }

    // An EVM address (chain inferred from nearby text) or a $CASHTAG. The 0x branch wins if
    // both somehow appear — an address is the higher-signal match. A cashtag is a whitelisted
    // coin (known coinId → shown immediately) or a long-tail symbol (resolved on demand, and
    // only shown if the Worker finds a single confident match — see showCard).
    function detectTarget(text: string): Target | null {
      if (text.includes('0x')) {
        const addr = findAddress(text)
        if (addr) {
          return { kind: 'address', addr, chain: inferChainForAddress(text, addr, defaultChain) }
        }
      }
      if (text.includes('$')) {
        const hit = findCashtag(text)
        if (hit) {
          return hit.coinId
            ? { kind: 'coin', coinId: hit.coinId, symbol: hit.symbol }
            : { kind: 'symbol', symbol: hit.symbol }
        }
      }
      return null
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
      if (!text) return
      const target = detectTarget(text)
      if (!target) return
      const anchor = node?.parentElement
      if (!anchor) return
      // Already showing this exact target → nothing to do.
      if (card && cardKey === targetKey(target) && activeAnchor === anchor) return
      scheduleShow(anchor, target)
    }

    // Scrolling the feed dismisses the card (standard hover-tooltip behavior). On X's
    // virtualized timeline the anchor's tweet gets recycled mid-scroll, which would leave
    // a card chasing a detached node (Floating UI then pins it to 0,0 — the top-left ghost);
    // closing on scroll avoids that entirely. Capture phase catches scrolls in any nested
    // container, and the card's own internal scroll is fine since the card doesn't scroll.
    function onScroll(): void {
      if (activeAnchor || card) reset()
    }

    document.body.addEventListener('mouseover', onMouseOver)
    // Passive cursor tracking so the dismiss-time geometry check uses the live position
    // (mouseover only fires on enter, not while the cursor sits on the address).
    document.addEventListener('mousemove', onMouseMove, { passive: true })
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })

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
      document.removeEventListener('scroll', onScroll, { capture: true })
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
  style.textContent = `.${UNDERLINE_CLASS}{border-bottom:1px dotted var(${UNDERLINE_VAR},${ACCENT_BY_THEME.dark});cursor:help;}`
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
