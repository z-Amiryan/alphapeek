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

## 2. Visual design tokens — "Terminal" system

A neo-brutalist mono desk with an electric-lime accent. Tokens are **CSS variables** defined in
`apps/extension/src/shadow/tokens.css` and exposed to Tailwind via semantic names in
`tailwind.config.ts` (`bg`, `surface`, `fg`, `dim`, `line`, `acc`, `acc-ink`, `up`, `down`, `warn`,
`seg-1..5`). **Light is the default; a single `.dark` class on the `.ap-root` wrapper flips every
variable** — there are no Tailwind `dark:` variants. Theme is chosen in `shadow/mount.ts` (hover
card, follows X's theme) and `popup/App.tsx` (popup, follows OS `prefers-color-scheme`).

### Colors

```
token        light        dark         use
────────────────────────────────────────────────────────────────────
bg           #ecebe3      #0d0d0d      page/feed backdrop, row hover fills
surface      #ffffff      #141414      card surface
fg           #0d0d0d      #f2f2f2      primary text
dim          #6b6b6b      #8a8a8a      secondary text / micro-labels
line         #0d0d0d      #353535      hairline rules + 1.5px borders
acc          #aad400      #c6f432      electric-lime accent (brand, links, gains)
acc-ink      #0d0d0d      #0d0d0d      text on accent fills
up / down    #aad400 / #d62b2b   #c6f432 / #ff4d4d   gains / losses
warn         #b46b00      #ffb627      caution (amber) — flag badges
shadow       5px 5px 0 #0d0d0d        5px 5px 0 rgba(198,244,50,.18)
seg-1..5     acc, #1a1a1a, #6b6b6b, #a3a3a3, #d0d0d0  (dark: acc, #e6e6e6, #8a8a8a, #565656, #383838)
```

`seg-1..5` is the allocation-bar ramp (largest → smallest holding). Gains/losses use accent-lime for
up and red for down — **not** the conventional green; this is intentional brand.

### Typography

- **Mono everywhere:** `Space Mono`, falling back to `ui-monospace, SFMono-Regular, Menlo, monospace`.
  System-loaded — no font file is shipped.
- Sizes are set as **explicit px** per element (e.g. `text-[9px]` micro-labels … `text-[30px]` hero
  balance), not a named scale — the terminal look relies on tight, deliberate sizing.

### Borders, shape & shadow

- **Borders:** `1.5px solid` in `line`. Hairline dividers between sections and rows.
- **Corners:** square — **no border-radius** anywhere (neo-brutalist).
- **Shadow:** one hard **offset** shadow per card (`shadow-tm` = `5px 5px 0`), no blur — ink on light,
  lime-tinted on dark.

### Card dimensions

- **Width:** 320px (`w-card`); **popup:** 360px.
- **Max height:** 480px (`max-h-card`), scrollable if exceeded.
- **Transitions:** 120ms (`duration-tm`). Loading uses a **blinking caret** (`ap-blink`, gated behind
  `motion-safe`), not a spinner. No animation longer than 150ms.

## 3. Card layouts

### A. Loading state

```
┌────────────────────────────────────┐
│                                    │
│         ◌  Loading…                │
│                                    │
└────────────────────────────────────┘
```

A blinking caret (`ap-blink`, gated behind `motion-safe`), centered — no spinner. Card height ~60px during loading; it grows in place when data arrives.

### B. Token card (contract address)

```
┌────────────────────────────────────┐
│ ▣ FLOKI / USD                LIVE  │ ← header: accent square + SYMBOL / USD + LIVE tag
│ ────────────────────────────────── │
│ Contract  [CAUTION]    1 issue  ⓘ │ ← contract-safety verdict (only if scan present)
│ ────────────────────────────────── │
│ $2.4e-5                     +0.5% │ ← hero price (left) + 24h change pill (colored)
│ ╱╲╱──╲╱─                          │ ← 7d sparkline (44px, full width; lime up / red down)
│ ⚠ Low liquidity  ⚠ High volatility │ ← market-data flag badges (only if present)
│ ────────────────────────────────── │
│ Mcap  $235.8M  │  Vol 24h  $21.4M │ ← split stats grid
│ ────────────────────────────────── │
│ Buy tax 0.3%    Sell tax 0.3%     │ ← contract-safety breakdown (only if data)
│ [⚠ Owner privileges]   Mintable   │ ←  risk chips (amber) + note chips (neutral)
│ ────────────────────────────────── │
│ [↗ CoinStats]      [↗ DEX]        │ ← footer actions
└────────────────────────────────────┘
```

- **Header:** an accent-lime square + `{SYMBOL} / USD`, with a `LIVE` tag on the right. No token icon or coin-name row — the symbol carries the identity.
- **Price:** hero size (`text-[28px]`), left-aligned; **24h change** is a filled pill on the right, colored `up` (accent-lime) / `down` (red) — note up is lime, not green (brand).
- **Contract-safety verdict (`TokenSummary.safety`, v0.2 — `SafetyBadge`):** the first thing under the header. Maps `safe` → **Safe** (lime fill), `caution` → **Caution** (amber outline), `danger` → **Risk** (red fill), `unknown` → **Unverified** (grey hairline), mirroring the change-pill convention so it reads as status. The right side shows the verdict-driving issue count (or "No critical risks" when safe). A small square **ⓘ marker** reveals the GoPlus attribution + "not financial advice" disclaimer on hover/focus — a pure-CSS tooltip (no JS): the card only dismisses on mouse-leave of the *whole* card, so hovering the marker inside it keeps it open. It's anchored here, not in the breakdown, because the verdict row always renders when `safety` exists while the breakdown drops out for a clean token. Render nothing when `safety` is absent (best-effort scan).
- **Contract-safety breakdown (`SafetyDetails`, v0.2):** buy/sell tax, then severity-ranked **risk chips** (amber, worst-first, capped at 3 with a `+N more` tail) and **informational note chips** (neutral grey — `mintable` / `proxy` / `blacklist`, which fire on legit tokens like CAKE/AAVE, so they never raise the verdict). No disclaimer line here — it lives in the verdict row's ⓘ marker. Renders only when there's tax, a risk, or a note.
- **Flag badges (`TokenSummary.flags`):** soft amber pills for `low_liquidity` (24h vol < $50k) and
  `high_volatility` (|24h| ≥ 25%) — derived from **market data only**, distinct from the contract-safety
  verdict above. Render nothing when `flags` is empty.
- **Sparkline:** SVG, 2px stroke, no fill / axes / labels — just the shape, min/max from data. Accent-lime when 24h is up, red when down. Icons throughout are hand-rolled inline SVG (`components/icons.tsx`), not an icon font.
- **Footer links:** `CoinStats` + `DEX`, open in new tab (`target="_blank"` + `rel="noopener noreferrer"`).

### C. Wallet card

```
┌────────────────────────────────────┐
│ 0x1234…abcd   [⎘ copy]             │ ← row 1: truncated address + copy
│ Ethereum                           │ ← row 2: chain name
│ ────────────────────────────────── │
│ Total Balance        Stablecoins 18%│ ← label + stablecoin % (right)
│ $48,237,512                        │ ← big number (text-xl)
│ PnL · All-time      +$1.2M · +24.6%│ ← v0.2: all-time PnL (colored), only if present
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
- **Copy button:** a `Copy` text button. On click: copy full address to clipboard + the button briefly flips to "Copied" (accent fill).
- **Stablecoin % (`WalletSummary.stablecoinPct`):** "risk-on vs parked" signal, computed worker-side
  over the FULL holdings (before the top-5 slice), so it's accurate even when stables fall outside
  the shown rows. Shown next to "Total Balance".
- **Allocation bar:** thin stacked bar, one value-neutral colored segment per top holding (width =
  `pct`); the uncovered remainder of the track reads as "other". Purely visual — no green/red.
- **Holdings rows:** symbol + percentage + USD (no token icon in v0.1). Row hover → slight `bg` highlight. Each row **deep-links to `coinstats.app/coins/{coinId}`** (new tab) when the holding has a CoinStats id, with a hover-revealed ↗; rows without an id stay non-clickable.
- **Total balance:** `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })`
- **PnL (`WalletSummary.pnl`, v0.2):** a single `PnL · All-time` line directly under the balance,
  colored `up`/`down`. CoinStats exposes fixed profit buckets with **no 30-day window**, so the
  surfaced figure is **all-time** profit — the strongest "ever been profitable" read.

Note: PnL costs an extra 25 credits, so it's fetched **only once an address is a confirmed wallet** (never on token/unknown fallthroughs) and is **best-effort** — a PnL failure doesn't fail the card. Total wallet lookups stay at 40 credits; the +25 only applies to confirmed wallets.

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

### Popup open splash

On the **first popup open of each browser session**, the popup shows a centered branded splash — the
oversized brand mark drawing in (`ap-logo-line`, 0.9s) over a faint hairline grid, the `ALPHAPEEK`
wordmark, and an `INITIALIZING` caret — then **fades into the real popup content** (`ap-fade-in`,
~300ms). Every later open in the same session goes straight to content with no splash and no delay, so
the popup stays a snappy utility for repeat use. The once-per-session flag lives in `storage.session`
(survives popup closes and SW sleeps, clears on browser restart — see `shouldShowSplash`).

The splash is an opaque overlay on top of the already-mounted content, so the popup is sized from first
paint (no resize jump) and the data underneath (Fear & Greed, recent lookups) loads *during* the
splash. On the session's first open it clears once local settings have loaded **and** a short
min-splash beat (`POPUP_SPLASH_MS`, default 900ms — roughly one logo-draw) has elapsed, whichever is
later; it never blocks on the network. While the gate is still being read, a plain surface-colored
cover holds so content never flashes. Both the logo draw and the fade are gated behind
`prefers-reduced-motion` — reduced-motion users get the finished mark and an instant cut with no
movement, while the min-splash beat still applies so nothing flashes.

This brief, once-per-session hold is the one place in the popup we show a deliberate loading state;
per-hover cards keep the snappy, no-animation-over-150ms rule (§ 1).
