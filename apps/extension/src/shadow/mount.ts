// Shadow-root mount for the hover card. createShadowRootUi isolates the card from
// X's CSS and WXT injects our compiled Tailwind into the same root. This file is
// `.ts` (SPEC §2), so it renders via createElement rather than JSX. The card
// positions itself with Floating UI, so the inline host wrapper just must not be clipped.
import type { Chain } from '@alphapeek/shared'
import { createElement } from 'react'
import { type Root, createRoot } from 'react-dom/client'
import { type ContentScriptContext, createShadowRootUi } from 'wxt/client'
import { HoverCard } from '@/components/HoverCard'

// What the card is showing: an EVM address (with an inferred chain), a whitelisted coin
// (a $CASHTAG resolved to a coinId), a long-tail $symbol the Worker resolves on demand, or
// (v0.3) a Solana mint pre-flighted before showing. Defined here so content.ts, mount.ts,
// and HoverCard share one shape.
export type Target =
  | { kind: 'address'; addr: string; chain: Chain }
  | { kind: 'coin'; coinId: string; symbol: string }
  | { kind: 'symbol'; symbol: string }
  | { kind: 'sol'; mint: string }

export type CardOptions = {
  target: Target
  anchor: HTMLElement
  theme: 'light' | 'dark'
  onClose: () => void
  onPointerEnter: () => void
  onPointerLeave: () => void
}

export type CardHandle = {
  remove: () => void
}

export async function mountCard(ctx: ContentScriptContext, opts: CardOptions): Promise<CardHandle> {
  const ui = await createShadowRootUi<Root>(ctx, {
    name: 'alphapeek-card',
    position: 'inline',
    anchor: 'body',
    onMount: (container) => {
      const root = createRoot(container)
      root.render(
        createElement(HoverCard, {
          target: opts.target,
          anchor: opts.anchor,
          theme: opts.theme,
          onClose: opts.onClose,
          onPointerEnter: opts.onPointerEnter,
          onPointerLeave: opts.onPointerLeave,
        }),
      )
      return root
    },
    onRemove: (root) => root?.unmount(),
  })

  ui.mount()
  return { remove: () => ui.remove() }
}
