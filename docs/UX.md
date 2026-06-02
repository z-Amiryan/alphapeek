# UX.md — Interaction & Visual Specification

## 1. The core interaction

```
USER ACTION              EXTENSION RESPONSE                      TIMING
─────────────────────────────────────────────────────────────────────────────
mouse enters address  →  dotted underline appears                instant
mouse stays > 200ms   →  lookup fires, loading card shows        200ms
data arrives          →  loading card swaps to data card         50-400ms
mouse leaves address  →  100ms grace period (allows moving       100ms
                          mouse onto the card itself)
mouse leaves card     →  card dismisses                          100ms
```

**Why these timings:**
- **200ms hover delay** — avoids triggering on accidental mouse pass-overs while scrolling
- **100ms grace period** — allows user to move mouse from address to card without it disappearing
- **No animation longer than 150ms** — feels snappy, not sluggish

## 2. Visual design tokens

Centralize these in `tailwind.config.ts` as theme extensions, and reuse everywhere.

### Colors

```ts
// Light mode (X light theme)
neutral: {
  50:  '#FAFAFA',  // card background
  100: '#F4F4F5',  // subtle divider
  500: '#71717A',  // secondary text
  900: '#18181B',  // primary text
}

// Dark mode (X dark theme — detect via prefers-color-scheme inside iframe? Actually use a CSS media query inside the shadow root)
neutral-dark: {
  50:  '#18181B',
  100: '#27272A',
  500: '#A1A1AA',
  900: '#FAFAFA',
}

// Semantic
success: '#10B981'  // green — positive PnL, safe risk score
warning: '#F59E0B'  // amber — caution, mid risk
danger:  '#EF4444'  // red — losses, high risk
accent:  '#6366F1'  // indigo — brand accent, links, focus
```

Use Tailwind's `dark:` variant inside the Shadow DOM. Detect dark mode by inspecting `document.documentElement` for X's `data-theme` attribute or `prefers-color-scheme`.

### Typography

```ts
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
}
fontSize: {
  xs:   '11px',   // micro labels, FDV, vol secondaries
  sm:   '13px',   // most body text
  base: '14px',   // primary readable
  lg:   '16px',   // token name, big numbers
  xl:   '20px',   // total balance, price (hero)
}
```

Use system fonts as fallback — don't ship Inter as a font file (bundle size). It usually renders if user has it; falls back gracefully if not.

### Spacing

```ts
// Tailwind defaults are fine. Card uses:
padding: 'p-4'           // 16px
gap: 'gap-2' or 'gap-3'  // 8px or 12px
border-radius: 'rounded-xl'  // 12px
```

### Card dimensions

- **Width:** 320px (fixed)
- **Max height:** 480px (scrollable if exceeded, rare)
- **Shadow:** `shadow-lg` (`0 10px 15px -3px rgb(0 0 0 / 0.1)`)
- **Border:** 1px solid `neutral-100` (light), `neutral-900` (dark) — gives subtle definition

## 3. Card layouts

### A. Loading state

```
┌────────────────────────────────────┐
│                                    │
│         ◌  Loading…                │
│                                    │
└────────────────────────────────────┘
```

Single spinner icon (lucide `Loader2`, spin animation), centered. Card height ~60px during loading. Card grows in place when data arrives.

### B. Token card (contract address)

```
┌────────────────────────────────────┐
│ [🪙] PEPE                $0.000002 │ ← row 1: icon + symbol + price
│      Pepe Coin            ↑ 12.4% │ ← row 2: name + 24h change (colored)
│ ────────────────────────────────── │
│ ⚠ Low liquidity  ⚠ High volatility │ ← flag badges (only if present)
│ ────────────────────────────────── │
│ Mcap   $2.1B                       │ ← stats grid
│ Vol    $480M                       │
│ ────────────────────────────────── │
│ ╱╲╱╲___╱╲╱─                       │ ← 7d sparkline (60px tall, full width)
│ ────────────────────────────────── │
│ [↗ CoinStats]  [↗ DEXScreener]    │ ← footer actions
└────────────────────────────────────┘
```

- **Token icon:** 32px circle, fallback to gray circle with first letter of symbol if `imgUrl` fails
- **Price:** right-aligned, large (`text-xl`), bold
- **24h change:** colored green/red, arrow icon (lucide `TrendingUp` / `TrendingDown`)
- **Flag badges (`TokenSummary.flags`):** soft amber pills for `low_liquidity` (24h vol < $50k) and
  `high_volatility` (|24h| ≥ 25%) — derived from market data only. **NOT a safety verdict** — true
  token-risk (honeypot/ownership) is deferred to v0.2. Render nothing when `flags` is empty.
- **Sparkline:** SVG, neutral gray stroke 2px, no fill, no axes, no labels. Just the shape. Min/max from data, no padding.
- **Footer links:** open in new tab. Use `target="_blank"` + `rel="noopener noreferrer"`.

### C. Wallet card

```
┌────────────────────────────────────┐
│ 0x1234…abcd   [⎘ copy]             │ ← row 1: truncated address + copy
│ Ethereum                           │ ← row 2: chain name
│ ────────────────────────────────── │
│ Total Balance        Stablecoins 18%│ ← label + stablecoin % (right)
│ $48,237,512                        │ ← big number (text-xl)
│ ▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱           │ ← allocation bar (top holdings, value-neutral hues)
│ ────────────────────────────────── │
│ Top Holdings                       │ ← section label
│ [Ξ] ETH    42%      $20,259,755   │ ← top 5, sorted by USD desc
│ [$] USDC   18%       $8,682,752   │
│ [🐸] PEPE   11%      $5,306,126   │
│ [◇] LINK    8%       $3,858,801   │
│ [Φ] AAVE    5%       $2,411,876   │
│ ────────────────────────────────── │
│ [↗ View on Etherscan]             │
└────────────────────────────────────┘
```

- **Address:** truncated to `0x1234…abcd` (first 6 + ellipsis + last 4)
- **Copy button:** lucide `Copy` icon. On click: copy full address to clipboard + brief toast inside card "Copied!"
- **Stablecoin % (`WalletSummary.stablecoinPct`):** "risk-on vs parked" signal, computed worker-side
  over the FULL holdings (before the top-5 slice), so it's accurate even when stables fall outside
  the shown rows. Shown next to "Total Balance".
- **Allocation bar:** thin stacked bar, one value-neutral colored segment per top holding (width =
  `pct`); the uncovered remainder of the track reads as "other". Purely visual — no green/red.
- **Holdings rows:** icon (24px) + symbol + percentage + USD. Hover row for slight bg highlight.
- **Total balance:** `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })`

Note: v0.1 wallet card **does not show PnL** because the PnL endpoint costs additional credits per call and we want to keep wallet lookups at 40 credits, not 80+. Add PnL in v0.2 with a deliberate UX decision (e.g., fetch on click-to-expand only).

### D. Unknown state

```
┌────────────────────────────────────┐
│ 0x1234…abcd                        │
│                                    │
│ No data yet. This could be a       │
│ brand-new token that isn't indexed │
│ yet, a fresh/empty wallet, or an   │
│ unsupported chain.                 │
│                                    │
│ [↗ DEXScreener]   [↗ Etherscan]   │
└────────────────────────────────────┘
```

Defensive UX. Don't gaslight the user — say what we know. **CoinStats has a ~few-hour indexing
lag (SPEC §9),** so a freshly-launched token contract legitimately lands here; DexScreener usually
lists it before CoinStats, so we offer that link alongside the explorer. We deliberately do NOT
claim "this is a new token" — we can't distinguish a too-new contract from an empty wallet without
an on-chain `getCode` check, so the copy stays honest about all three possibilities.

### E. Error state

```
┌────────────────────────────────────┐
│ ⚠  Couldn't load this address      │
│                                    │
│ Network error. Try again in a      │
│ moment.                            │
│                                    │
│ [Retry]                            │
└────────────────────────────────────┘
```

For 429 (rate limited):
> You're checking addresses faster than we can keep up. Try again in a minute.

For 503 (daily cap):
> AlphaPeek is taking a quick breather. Try again tomorrow, or [open settings] to add your own API key (Pro Mode).

## 4. Number formatting (`lib/format.ts`)

| Value range | Format | Example |
|---|---|---|
| ≥ $1B | `$1.2B` | `$2.1B` |
| ≥ $1M | `$1.2M` | `$480M` |
| ≥ $1K | `$1.2K` | `$48.2K` |
| < $1, > $0.01 | `$0.12` | `$0.42` |
| < $0.01 | scientific | `$2.4e-7` (or subscript like `$0.0₆24`) |
| Negative | same with `-` | `-$1.2M` |

Use `Intl.NumberFormat` with `notation: 'compact'` for the millions/billions case.

Percentages: 1 decimal place. `+12.4%` (always show sign).

## 5. Edge cases the agent must handle

1. **Multiple addresses in one tweet, very close together.** Each gets its own underline + hover trigger. Card appears for the one under the cursor.
2. **Address inside an `<a>` tag** (e.g., a Twitter mention or quote-tweet link). Still detect, still decorate. Underline merges visually with the existing link underline — that's fine.
3. **Mouse leaves address but enters card.** Card stays open. Grace period prevents flicker.
4. **Card would render off-screen.** Floating UI handles flipping to the opposite side. Test near viewport edges.
5. **Twitter virtualized list re-mounts the tweet.** Underline is re-applied on next hover (because we don't pre-decorate). No memory leak.
6. **User has X open in two tabs.** Each tab has its own content script, but they share the background SW's IndexedDB cache. Same address hovered in tab 2 → instant from cache.
7. **Address text is split across DOM elements** (rare, but Twitter sometimes wraps mid-string for ENS-like cases). Detection looks at the deepest text node only; if the address spans multiple text nodes, we miss it for v0.1. Acceptable.
8. **Card is open, user clicks elsewhere.** Card dismisses. (Click-outside handler.)
9. **Card icon fails to load.** Show gray circle with first letter of symbol.
10. **Holdings array is empty** (fresh wallet, balance is dust). Show "No significant holdings" instead of an empty list.

## 6. Accessibility (must-haves, even for v0.1)

- Card has `role="tooltip"` and a unique `id`.
- Address element gets `aria-describedby={cardId}` when card is open.
- Card is keyboard-focusable (`tabindex="-1"` to receive focus programmatically) but does NOT trap focus.
- Copy button is a proper `<button>` with `aria-label="Copy address"`.
- Color is never the only signal — combine with icons (arrows for up/down).
- Minimum contrast ratio 4.5:1 for text. Verify both themes.

## 7. The popup (extension icon click)

```
┌─────────────────────────────────────┐
│ AlphaPeek                       v0.1│ ← header
│ ─────────────────────────────────── │
│ 😐 Fear & Greed: 52 — Neutral       │ ← live data, cached 5min
│ ─────────────────────────────────── │
│ Look up an address                  │
│ ┌─────────────────────────────────┐ │
│ │ 0x...                           │ │ ← input
│ └─────────────────────────────────┘ │
│ Chain: [Ethereum ▾]                 │ ← dropdown
│ [Look up]                           │ ← button
│                                     │
│ ─── Recent lookups ────             │ ← last 5 from IndexedDB
│ 0xdac1…ec7  USDT       $1.00        │
│ 0xd8da…045  Wallet     $48.2M       │
│ ─────────────────────────────────── │
│ Default chain: [Ethereum ▾]         │ ← setting
│ ─────────────────────────────────── │
│ [↗ GitHub]  [↗ Report a bug]        │
└─────────────────────────────────────┘
```

Width: 360px. Height: auto, max 600px.
