# SPEC.md — Technical Specification (v0.1)

## 1. Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                          X / Twitter Tab                            │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Content Script (apps/extension/src/entrypoints/content.ts)   │  │
│  │  · mouseover delegation on document.body                     │  │
│  │  · EVM address regex match in text nodes                     │  │
│  │  · dotted underline on detected addresses                    │  │
│  │  · 200ms hover delay → message to Background SW              │  │
│  │  · Shadow DOM mount for React hover card                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ chrome.runtime.sendMessage
                                   ▼
┌────────────────────────────────────────────────────────────────────┐
│ Background Service Worker (entrypoints/background.ts)               │
│  · IndexedDB cache (idb library) — per-user local                  │
│  · Cache miss → fetch from Worker                                  │
│  · Returns typed LookupResult to content script                    │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ HTTPS GET
                                   ▼
┌────────────────────────────────────────────────────────────────────┐
│ Cloudflare Worker (apps/worker)                                     │
│  · Hono router                                                     │
│  · CORS: chrome-extension://* + localhost                          │
│  · Per-IP rate limit: 60 req/min                                   │
│  · Daily cap kill switch                                           │
│  · KV cache (CACHE namespace)                                      │
│  · Adds X-API-KEY, proxies to CoinStats                            │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ HTTPS GET + X-API-KEY
                                   ▼
                       CoinStats Public API
                   (openapiv1.coinstats.app)
```

## 2. Repo structure (exact)

```
alphapeek/
├── apps/
│   ├── extension/
│   │   ├── src/
│   │   │   ├── entrypoints/
│   │   │   │   ├── content.ts            # Content script (X/Twitter only)
│   │   │   │   ├── background.ts         # Service worker (IndexedDB cache + Worker fetch)
│   │   │   │   └── popup/                # index.html, main.tsx, App.tsx, Splash.tsx (open splash, UX §7)
│   │   │   ├── components/               # HoverCard, ResultView, TokenView, WalletView,
│   │   │   │                             # Sparkline, LoadingView, ErrorView, UnknownView,
│   │   │   │                             # FearGreedBadge, ManualLookup, RecentLookups,
│   │   │   │                             # ChainSelect, icons.tsx, ui.ts
│   │   │   ├── lib/                      # regex, chain, format, debug
│   │   │   ├── services/                 # worker-client, cache (idb), messaging, settings
│   │   │   ├── shadow/                   # mount.ts, styles.css, tokens.css (design tokens)
│   │   │   ├── index.css                 # Tailwind directives
│   │   │   └── vite-env.d.ts
│   │   ├── public/                       # icon-16/48/128.png + icon.svg
│   │   ├── scripts/make-icons.mjs        # regenerates PNG icons from icon.svg (postinstall)
│   │   ├── wxt.config.ts                 # manifest + CSP (see §5)
│   │   ├── tailwind.config.ts            # Terminal design system (see UX.md §2)
│   │   ├── postcss.config.js
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── worker/
│   │   ├── src/
│   │   │   ├── index.ts                  # Hono router (see §4)
│   │   │   ├── coinstats.ts              # CoinStats client + normalizers
│   │   │   ├── cache.ts                  # read-through KV cache helper
│   │   │   ├── ratelimit.ts              # per-IP limit + daily cap
│   │   │   └── env.ts                    # Env bindings + WORKER_VERSION
│   │   ├── test/normalize.test.ts        # Vitest unit tests
│   │   ├── wrangler.toml
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── store-visuals/                    # Dev-only: renders the real cards over a faux-X
│                                         # feed to export Chrome Web Store screenshots
├── packages/
│   └── shared/
│       └── src/types.ts                  # LookupResult, TokenSummary, etc. (the contract)
├── docs/
│   ├── SPEC.md  (this file)
│   ├── UX.md
│   ├── ROADMAP.md
│   ├── DEPLOYMENT.md
│   ├── store-listing.md                  # Chrome Web Store listing copy
│   ├── privacy.md
│   └── privacy.html                      # hosted privacy policy (GitHub Pages)
├── assets/                               # logo.svg, logo-animated.svg (README/branding)
├── .github/workflows/                    # ci.yml + deploy-worker.yml
├── LICENSE                               # MIT
├── biome.json
├── pnpm-workspace.yaml
├── package.json                          # root, with scripts
└── README.md
```

## 3. Tech stack (locked versions for v0.1)

| Concern | Choice | Version | Why |
|---|---|---|---|
| Package manager | pnpm | ^9 | Fast, disk-efficient workspaces |
| Language | TypeScript | ^5.7 | Strict mode everywhere |
| Lint/format | Biome | ^1.9 | Single tool, fast |
| Extension framework | WXT | ^0.19 | MV3 + Vite + React out of the box |
| UI library | React | ^18.3 | Familiar, mature |
| Styling | Tailwind CSS | ^3.4 | v3 (v4 has Shadow DOM quirks) |
| Tooltip positioning | @floating-ui/react | ^0.27 | Industry standard |
| Icons | hand-rolled inline SVG (`components/icons.tsx`) | — | A few square-cap paths; no icon-font dependency |
| IndexedDB wrapper | idb | ^8 | Tiny, Promise-based |
| Worker framework | Hono | ^4.6 | Tiny, ergonomic routing |
| Worker runtime | Cloudflare Workers | — | Free tier, KV cache |
| Test (Worker only) | Vitest | ^2 | Vite-native |
| CI | GitHub Actions | — | Free for public repos |

**No other dependencies without user approval.** No date libraries (use `Intl.DateTimeFormat`), no http libraries (use `fetch`), no utility libraries (use native methods).

## 4. Cloudflare Worker spec

### Endpoints

#### `GET /v1/lookup`
The only data endpoint. Resolves any EVM address to a typed result.

**Query params:**
- `addr` (required): EVM address, lowercase normalized. Regex: `^0x[a-f0-9]{40}$`
- `chain` (optional, default `ethereum`): one of the supported blockchain identifiers from CoinStats `/wallet/blockchains`. For v0.1: `ethereum`, `bsc`, `polygon`, `base`, `arbitrum`, `optimism`, `avalanche`.

**Response (200):**
```ts
type LookupResponse =
  | { kind: 'token'; data: TokenSummary }
  | { kind: 'wallet'; data: WalletSummary }
  | { kind: 'unknown' }

type TokenSummary = {
  coinId: string
  name: string
  symbol: string
  imgUrl: string
  price: number
  pCh24h: number
  marketCap: number
  volume: number
  sparkline: number[]  // 7d, ~168 points
  flags: TokenFlag[]   // 'low_liquidity' | 'high_volatility' — market-data hints, not a safety verdict
}

type WalletSummary = {
  address: string
  chain: string
  totalUsd: number
  holdings: Array<{
    coinId?: string  // CoinStats slug for the deep-link (coinstats.app/coins/{coinId}); absent if un-indexed
    symbol: string
    name: string
    imgUrl: string
    usd: number
    pct: number  // 0-100
  }>
  stablecoinPct: number  // 0-100, computed over the FULL holdings before the top-N slice
}
```

**Error responses:**
- `400` — invalid address format
- `429` — rate limited (per IP, 60/min)
- `503` — daily cap reached OR upstream CoinStats error

#### `GET /health`
Returns `{ ok: true, version: string }`. No auth, no rate limit.

### Caching strategy (mandatory)

| Cache layer | Key pattern | TTL | Rationale |
|---|---|---|---|
| KV `CACHE` | `kind:{chain}:{addr}` | 30 days | An address doesn't change type |
| KV `CACHE` | `token:{coinId}` | 60 seconds | Price moves |
| KV `CACHE` | `chart:{coinId}` | 900 seconds | 7d sparkline is hourly data; cached apart from `token` so a flaky chart call can't pin a blank sparkline, and to cut the ~3-credit chart cost |
| KV `CACHE` | `wallet:{chain}:{addr}` | 300 seconds | Balances change but slowly |

> The Worker sends `Cache-Control: public, max-age=…` on `/v1/lookup` and `/v1/fear-greed`
> responses (a hint for the browser / service-worker HTTP cache). There is intentionally
> **no Cloudflare edge-cache layer**: on `workers.dev` a header alone doesn't populate the
> edge cache (the Worker makes no Cache API call), and it would be redundant — the KV layer
> above already collapses repeat lookups across users, and the extension's IndexedDB cache
> handles per-user repeats.

### Rate limiting

| Limit | Window | Scope | Action |
|---|---|---|---|
| 60 requests | 1 minute | per IP | 429 |
| `DAILY_CAP` (default 5,000) | 1 day | global | 503 + alert |

Rate limit state lives in `RATELIMIT` KV namespace with auto-expiry.

### CoinStats endpoints we call

| Internal use | CoinStats path | Cost |
|---|---|---|
| Detect if address is a token | `GET /coins?blockchains={coinsSlug}&contractAddresses={addr}&limit=1` | ~5 credits |
| Token details | `GET /coins/{coinId}` | ~1 credit |
| Token 7d chart | `GET /coins/charts?coinIds={coinId}&period=1w` | ~3 credits |
| Wallet balance | `GET /wallet/balance?address={addr}&connectionId={connSlug}` | **40 credits** |

(Costs are estimates — verify against `https://coinstats.app/docs/multipliers.md` and the per-endpoint docs.)

**Chain slugs differ PER ENDPOINT — three namespaces (verified live 2026-06-02).** Do not share
one map. `/coins?blockchains=` uses CoinStats' internal "chain" slugs; `/wallet/balance` uses the
`connectionId` from `GET /wallet/blockchains` (NOT a `blockchain` param). The worker keeps two
maps (`COINS_CHAIN`, `WALLET_CHAIN`) in `apps/worker/src/coinstats.ts`.

| our `chain` | `/coins` blockchains | `/wallet/balance` connectionId | status |
|---|---|---|---|
| ethereum | `ethereum` | `ethereum` | verified |
| bsc | `binance_smart` ⚠️ (NOT `binance-smart-chain`) | `binancesmartchain` | verified |
| base | `base` | `base-wallet` | verified |
| polygon | `polygon-pos` | `polygon-wallet` | verified (coins) |
| arbitrum | `arbitrum-one` | `arbitrum-wallet` | verified (coins) |
| optimism | `optimistic-ethereum` | `optimism-wallet` | **unverified** |
| avalanche | `avalanche` | `avalanche-wallet` | **unverified** |

**Verified against the live API (2026-06-01)** — note: the chart-shape and endpoint notes in
this section were corrected the next day; see the **2026-06-02** section below, which supersedes
any conflicting statement here.

- The detection filter param is **`contractAddresses` (plural)**, not `contractAddress`.
  The singular form is silently ignored by CoinStats: it returns the top-ranked
  coin for the chain (e.g. `tether`) for *any* address, so every address was being
  misdetected as a token. The plural param filters correctly (SHIB → `shiba-inu`).
- **Known limitation — canonical USDT/USDC are not in the contract-address index.**
  `GET /coins?contractAddresses=0xdac17…` returns only a price-0 PulseChain fork,
  never `id:"tether"` (confirmed with and without `blockchains`). CoinStats exposes
  no address→coin endpoint for these mega-cap multichain coins, so they resolve as
  `unknown` / fall through to the wallet path. Normal ERC-20s are unaffected. Use
  SHIB/PEPE, not USDT, as the token smoke-test address.
- Response field names confirmed: coins use `id`, `icon`, `priceChange1d`,
  `marketCap`, `volume`; charts were assumed to be bare `[ts, price, …]` tuple arrays
  (**superseded** — the correct `/coins/charts` endpoint returns a wrapped array; see the
  2026-06-02 section below); `/wallet/balance` returns a flat array of `{ amount, price, symbol, name, imgUrl,
  coinId }` (no `usd` field — value is `amount * price`); fear & greed nests under
  `now: { value, value_classification }`.
- **Rate limit:** this API key's plan throttles aggressively. A token lookup fires
  3 upstream calls (detect + details + charts) and can trip CoinStats' 429, which
  `cs()` maps to a `503 upstream_error` per spec. Single-call lookups (wallet,
  fear-greed) are fine. The mandatory KV cache (§ above) is what keeps this within
  budget in practice; space out manual test calls.

**Verified live 2026-06-02 (fixed bugs — see the slug table above):**

- **BSC detection was broken by the wrong `/coins` slug.** The docs say `binance-smart-chain`,
  but that returns 0 results; the working value is **`binance_smart`**. Fixed → all trending BSC
  tokens (CAKE, XVS, FLOKI, CHEEMS, BROCCOLI, BOB, Siren) resolve.
- **Wallet lookups were broken on every non-ETH chain.** `/wallet/balance` keys off
  **`connectionId`** (e.g. `base-wallet`, `binancesmartchain`), not a plain `blockchain=` name —
  the latter 400s. Fixed → BSC/Base wallets return holdings.
- **7d chart endpoint was wrong.** Correct path is **`GET /coins/charts?coinIds={id}&period=1w`**
  (plural `coinIds`); response is `[{ coinId, chart: [[ts, usd, btc, eth], …] }]` (a wrapped
  array, NOT the bare tuple array noted above for the old path). The old `/coins/{id}/charts`
  404'd and was swallowed by `.catch(()=>null)` → empty sparkline. `normalizeChart` now drills
  into `[0].chart`. Note: the chart call still silently empties under rate-limit (best-effort).
- **`?contractAddresses=` works as a filter empirically, though the 2025-06-11 changelog documents
  it as a *response field only*** — undocumented/fragile. Each CA resolves to its own coin.
  Long-term-safe alternative: a preloaded `{chain:addr→coinId}` index from the response field.
- **Indexing latency ≈ hours.** A ~1h-old Base token ($138k liq) returned `unknown`; a ~9h-old
  one resolved. CoinStats indexes new tokens within hours regardless of liquidity → not a
  minute-zero tool. See § 9.

### Worker reference implementation

The full Worker code is in `apps/worker/src/index.ts`. See the CLAUDE conversation thread (or ask the user) for the starting point. Key invariants:

1. All CoinStats fetches go through a single `cs()` helper that injects `X-API-KEY`.
2. All cache reads go through `cached(env, key, ttl, fn)` — never bypass.
3. Rate limit + daily cap middleware run before any business logic.
4. CORS allowlist: `chrome-extension://*` and `http://localhost:*` only.

### Worker `wrangler.toml` essentials

```toml
name = "alphapeek-proxy"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[[kv_namespaces]]
binding = "CACHE"
id = "REPLACE_ME"

[[kv_namespaces]]
binding = "RATELIMIT"
id = "REPLACE_ME"

[vars]
DAILY_CAP = "5000"

# Secret (never commit):
#   wrangler secret put COINSTATS_API_KEY
```

## 5. Extension spec

### Manifest (generated by WXT)

```ts
// wxt.config.ts
export default defineConfig({
  manifest: {
    name: 'AlphaPeek',
    description: 'Peek any wallet or token on X (Twitter) — see balances, top holdings, price and 7-day charts instantly on hover.',
    version: '0.1.0',
    permissions: ['storage'],
    host_permissions: ['https://x.com/*', 'https://twitter.com/*'],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; connect-src 'self' https://alphapeek-proxy.<your>.workers.dev"
    },
    action: { default_popup: 'popup.html' },
  },
})
```

### Content script behavior

**Lifecycle:**
1. On load, attach a single delegated `mouseover` listener to `document.body`.
2. Set up a `MutationObserver` to catch X's SPA route changes and infinite-scrolled tweets. **Only purpose:** invalidate any cached "this element has been scanned" markers — do NOT eagerly scan.
3. On `mouseover`, identify the deepest text node under the cursor. Check if it contains an EVM address (regex). If yes:
   - Add a `alphapeek-hover` class to the parent element (Tailwind/CSS provides `border-bottom: 1px dotted currentColor`).
   - Wait 200ms (cancel if mouseout) — debounce to avoid flickering.
   - Send a `LOOKUP` message to background SW.
   - On response, mount the React hover card in Shadow DOM, positioned via Floating UI.
4. On `mouseout` from the address AND the card, dismiss after 100ms grace period.

**Address detection (`lib/regex.ts`):**
```ts
// Word-boundary lookbehind/lookahead to avoid matching inside longer hex (e.g. tx hashes)
export const EVM_ADDRESS = /(?<![a-fA-F0-9])0x[a-fA-F0-9]{40}(?![a-fA-F0-9])/g
```

**Chain inference (`lib/chain.ts`):**
For v0.1 on X only, there's no URL context. Inference order:
1. Scan 200 chars before/after the address in the same text node for keywords: `base`, `arbitrum`/`arb`, `polygon`/`matic`, `bsc`/`bnb`, `optimism`/`op`, `avalanche`/`avax`. Case-insensitive, word-boundary.
2. Fallback: user's default chain setting (from `chrome.storage.local`, defaults to `ethereum`).

### Background service worker behavior

- Maintains an IndexedDB cache via `idb`: `alphapeek-cache` DB, store `lookups`, key = `${chain}:${addr}`.
- TTLs are keyed by the cached result's `kind` (sit just above the Worker's so repeat
  hovers don't re-hit the network; mirror the retention quoted in the privacy policy):
  - token: 90 seconds
  - wallet: 10 minutes
  - unknown: 60 minutes
  (There is no client-side "kind" TTL — kind resolution is the Worker's 30-day KV layer.)
- On message `LOOKUP { addr, chain }`:
  1. Check IndexedDB — hit + not expired → return immediately
  2. Miss/expired → `fetch(WORKER_URL + '/v1/lookup?...')`
  3. Store result, return to content script
- Worker URL is `import.meta.env.VITE_WORKER_URL` at build time (set via `.env`).

### Popup UI (extension icon click)

Minimal first version:
- Open splash: a brief branded loading overlay shown on the first open of each browser session (gated by `shouldShowSplash` via `storage.session`), fading into the content once local settings load + a short min-splash beat (UX §7, `Splash.tsx`). Later opens in the same session skip it. No new message types — reuses `FEAR_GREED`.
- Header: Fear & Greed Index (fetch on open, cache 5min). Use `https://coinstats.app/docs/openapi/fear-and-greed.md` endpoint — same Worker, add a `GET /v1/fear-greed` endpoint.
- Manual lookup: paste an EVM address + chain selector → renders same hover card layout.
- Footer: "Default chain" setting (saved to `chrome.storage.local`), version, link to repo.

### Shadow DOM mount pattern (WXT)

WXT supports `defineContentScript` with a `main()` that creates a `ShadowRootContentScriptUi`. Pattern:

```ts
// shadow/mount.ts (sketch)
import { createShadowRootUi } from 'wxt/client'
import { createRoot } from 'react-dom/client'

export async function mountCard(ctx, addr, chain) {
  const ui = await createShadowRootUi(ctx, {
    name: 'alphapeek-card',
    position: 'inline',
    onMount: (container) => {
      const root = createRoot(container)
      root.render(<HoverCard addr={addr} chain={chain} />)
      return root
    },
    onRemove: (root) => root?.unmount(),
  })
  ui.mount()
  return ui
}
```

Tailwind CSS for the card is bundled and injected into the shadow root automatically by WXT's `createShadowRootUi`.

## 6. Shared types (`packages/shared/src/types.ts`)

```ts
export type Chain =
  | 'ethereum' | 'bsc' | 'polygon' | 'base'
  | 'arbitrum' | 'optimism' | 'avalanche'

export type TokenFlag = 'low_liquidity' | 'high_volatility'

export type TokenSummary = {
  coinId: string
  name: string
  symbol: string
  imgUrl: string
  price: number
  pCh24h: number
  marketCap: number
  volume: number
  sparkline: number[]
  flags: TokenFlag[]  // market-data hints only — NOT a safety verdict
}

export type WalletSummary = {
  address: string
  chain: Chain
  totalUsd: number
  holdings: Array<{
    coinId?: string  // CoinStats slug → coinstats.app/coins/{coinId}; absent if un-indexed
    symbol: string
    name: string
    imgUrl: string
    usd: number
    pct: number
  }>
  stablecoinPct: number  // 0-100, over the FULL holdings before the slice
}

export type LookupResult =
  | { kind: 'token'; data: TokenSummary }
  | { kind: 'wallet'; data: WalletSummary }
  | { kind: 'unknown' }

export type LookupError =
  | { error: 'invalid_address' }
  | { error: 'rate_limited' }
  | { error: 'daily_cap_reached' }
  | { error: 'upstream_error' }
```

Both `apps/extension` and `apps/worker` import from `@alphapeek/shared`.

## 7. Performance budgets

| Metric | Budget |
|---|---|
| Content script bundle (gzipped) | < 25 KB |
| Hover card bundle (lazy, on first hover) | < 80 KB gzipped |
| Time from hover to card visible (cache hit) | < 50ms |
| Time from hover to card visible (cache miss, p95) | < 400ms |
| Worker p50 latency | < 60ms (cache hit), < 250ms (cache miss) |
| Memory overhead per tab | < 5 MB |

If a budget is exceeded after honest effort, document the gap in the PR and decide with the user.

## 8. Manual smoke test matrix (run before declaring v0.1 done)

| # | Scenario | Expected |
|---|---|---|
| 1 | Hover SHIB contract on a tweet | Token card with SHIB data (USDT/USDC are not in CoinStats' contract index — see §4) |
| 2 | Hover Vitalik's address on a tweet | Wallet card with total balance + top holdings (no PnL in v0.1 — ROADMAP) |
| 3 | Hover a random unknown address | "Unknown address" state |
| 4 | Hover same address twice in 1 min | Second hover served from cache, < 50ms |
| 5 | Hover, then quickly mouseout before 200ms | No card appears (debounce works) |
| 6 | Scroll Twitter feed, hover many addresses | No memory leak, no jank |
| 7 | Click extension icon, paste address | Manual lookup works |
| 8 | Disconnect internet, hover address | Graceful error card, no console errors |
| 9 | Toggle theme (X dark → light) | Card readable in both modes |
| 10 | Open X in two tabs, hover same address | Cache shared via background SW |
| 11 | Click extension icon (first time this browser session) | Brief branded splash, then fades into popup content; reduced-motion shows an instant cut, no flash |
| 12 | Reopen the popup in the same session | No splash — straight to content, no delay. Splash returns only after a browser restart |

## 9. Known v0.1 limitations (document in README and roadmap)

- **EVM only** — Solana, BTC, others in v0.2+
- **X only** — Etherscan, DEXScreener, Telegram, Discord in v0.2+
- **No Token Risks** — Hexens risk scoring lands in v0.2
- **No $TICKER** detection — lands in v0.2
- **No persistent watchlist** — in v0.3 with optional account
- **No alerts/notifications** — in v0.3
- **Chain inference is best-effort** — Twitter has no URL context, may guess wrong chain
- **Not a launch-sniping tool — ~hours of indexing latency.** CoinStats indexes new tokens within
  a few hours of launch (a ~1h-old token returns `unknown`; ~9h-old resolves), regardless of
  liquidity. AlphaPeek is a **trending/established-token inspector**, not a minute-zero ape tool.
  Tokens too new to be indexed should render a dedicated **"Too new — not indexed yet"** card
  (with a DexScreener link), never a generic error. Market the product accordingly.
