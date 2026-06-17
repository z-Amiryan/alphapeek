# SPEC.md — Technical Specification (v0.2-beta)

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
                   (api.coinstats.app)
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
│   │   │   ├── coinstats.ts              # CoinStats Public Api client + normalizers
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

> **External data sources (not npm packages):** v0.1 = CoinStats only. v0.2 adds
> **GoPlus Token Security** (`api.gopluslabs.io`, free + keyless) for contract-safety
> scans — Worker-side `fetch` only, never called from the extension, no package added.

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
  sparkline: number[]  // 7d, ~168 points (empty for DexScreener-sourced tokens — no free history)
  flags: TokenFlag[]   // 'low_liquidity' | 'high_volatility' — market-data hints, not a safety verdict
  safety?: TokenSafety // v0.2: GoPlus contract-safety scan (shape in §6); best-effort, absent if unavailable
  source: 'coinstats' | 'dexscreener'  // v0.2: data provider; 'dexscreener' = free zero-credit fallback
  url?: string         // v0.2: external page (the DexScreener pair) when source='dexscreener'
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
  pnl?: WalletPnl        // v0.2: all-time PnL from /wallet/pl (shape in §6); best-effort
}
```

**Error responses:**
- `400` — invalid address format
- `429` — rate limited (per IP, 60/min)
- `503` — daily cap reached OR upstream CoinStats error

#### `GET /v1/coin` (v0.2 — $TICKER path)
Resolves a CoinStats coinId (from a detected `$CASHTAG`) to a token card. Shares the token
assembly (`buildToken`) and the `token:`/`chart:`/`safety:` cache keys with `/v1/lookup`, so a
cashtag and its contract collapse to the same cached data.

**Query params:**
- `coinId` (required): a CoinStats slug, validated `^[a-z0-9][a-z0-9._-]{0,80}$`.

**Behavior:** fetches coin detail + 7d chart, and derives the GoPlus safety target from the coin's
`contractAddresses` via `pickSafetyTarget` (prefers the canonical singular `contractAddress`
deployment, then ethereum, then `SUPPORTED_CHAINS` order; null when no supported-chain deployment
exists → safety omitted). No `chain` param — the safety chain is derived, not supplied.

**Response (200):** `{ kind: 'token'; data: TokenSummary }` (`source: 'coinstats'`), or
`{ kind: 'unknown' }` if the detail is empty.

**Errors:** `400` invalid coinId · `429` rate limited · `503` daily cap / upstream error.

#### `GET /v1/symbol` (v0.2 — long-tail $TICKER path)
Resolves a bare cashtag **symbol** the extension couldn't map from its top-1000 whitelist. A
long-tail `$SYMBOL` is genuinely ambiguous (many coins reuse a ticker — e.g. ~19 distinct
"MOON"s), so resolving to the highest-cap match would routinely render a confident **wrong-token**
card. The guard converts that ambiguity into silence instead.

**Query params:**
- `symbol` (required, uppercased server-side): validated `^[A-Z][A-Z0-9]{1,10}$`.

**Behavior:** `resolveSymbolToCoinId` calls `/coins?symbol=…&sortBy=rank&sortDir=asc` and applies
`pickSymbolMatch` — a candidate must (a) match the symbol exactly, (b) have a deployment on a
**supported EVM chain**, and (c) clear a **`MIN_SYMBOL_MARKET_CAP_USD` ($50k) dust floor**. It
resolves **only when exactly one candidate survives**; multiple contenders → no match. The resolved
coinId (or a `'-'` no-match sentinel) is cached under `symid:{SYMBOL}` for **a day** — the
`/coins?symbol=` search is ~5 credits, so this bounds it to at most one search per symbol per day
and negative-caches slang words. On a hit it reuses `buildToken` (same `token:`/`chart:`/`safety:`
keys as `/v1/coin`), so the price still refreshes on the short token TTL.

**Coverage (deliberate):** CoinStats-indexed, supported-EVM **or Solana** (v0.3 widened
`pickSymbolMatch` to accept a single Solana deployment under the same single-match + floor
discipline). Brand-new micro-caps not yet propagated to any data index still stay `unknown` by
design; a pasted Solana *mint* is served by `/v1/sol` instead (see below).

**Response (200):** `{ kind: 'token'; data: TokenSummary }` (`source: 'coinstats'`), or
`{ kind: 'unknown' }` when no single confident match exists.

**Errors:** `400` invalid symbol · `429` rate limited · `503` daily cap / upstream error.

#### `GET /v1/sol` (v0.3 — Solana token / mint path)
Resolves a detected/pasted **Solana mint** (base58) to a token card. EVM-only `/v1/lookup`
can't serve these (a mint fails its `^0x[a-f0-9]{40}$` guard), so Solana gets a dedicated route
with Solana-native resolution + safety. The extension **pre-flights** every base58 candidate
here and mounts only on a `token` result (see §5), so a base58 false positive costs a cached
probe, never a wrong card.

**Query params:**
- `mint` (required): a Solana mint, validated `^[1-9A-HJ-NP-Za-km-z]{32,44}$` (base58; **case-
  sensitive — NOT lowercased**, unlike EVM addresses).

**Behavior:** `resolveSolana` mirrors `resolve()`'s CoinStats-first shape. A stable `solkind:{mint}`
cache gates the search; on a miss it calls `detectSolanaTokenCoinId` — a
`GET /coins?blockchains=solana&contractAddresses={mint}&limit=1` search that returns the coin's
**canonical** `id` (verified live: BONK → `bonk`, GOAT → `…pump_solana`, WIF → `dogwifcoin`).
It **never constructs `<mint>_solana`** — a canonical mega-cap's id is its slug (`bonk`), and the
mint-form 404s. On a hit it reuses `buildToken` with an explicit Solana safety target (GoPlus-
Solana). For a mint too new to be indexed yet, it supplements with the free **DexScreener-Solana**
lookup, then `unknown`. The non-resolving `NOT_A_TOKEN` sentinel is negative-cached so base58
detection noise doesn't burn the request cap.

**Response (200):** `{ kind: 'token'; data: TokenSummary }` with `network: 'solana'` + `solMint`
(see §6), or `{ kind: 'unknown' }`.

**Errors:** `400` invalid mint · `429` rate limited · `503` daily cap / upstream error.

> **Solana cashtags** ride the existing `/v1/coin` (whitelisted top-1000, e.g. `$WIF`/`$BONK`)
> and `/v1/symbol` (long-tail) routes — no new route. `pickSymbolMatch` is widened to accept a
> Solana deployment under the **same single-match + $50k-floor** discipline, so a contested
> Solana ticker (`$GOAT` — Goatseus *and* Sonic The Goat both clear the floor) stays **silent by
> design**. `pickSafetyTarget` is **EVM-first** (a multichain coin scans its calibrated EVM
> deployment), falling back to the Solana mint only when the coin has no supported-EVM deployment.

#### `GET /health`
Returns `{ ok: true, version: string }`. No auth, no rate limit.

### Caching strategy (mandatory)

| Cache layer | Key pattern | TTL | Rationale |
|---|---|---|---|
| KV `CACHE` | `kind:{chain}:{addr}` | 30 days (positive) / 6 hours (not-yet-a-token) | A real token contract's type is permanent (cache the coinId for a month); a `NOT_A_TOKEN` result is often just a brand-new token still propagating to data indexes, so it re-checks within hours and, once indexed, the card upgrades to the full CoinStats data |
| KV `CACHE` | `token:{coinId}` | 60 seconds | Price moves |
| KV `CACHE` | `chart:{coinId}` | 900 seconds | 7d sparkline is hourly data; cached apart from `token` so a flaky chart call can't pin a blank sparkline, and to cut the ~3-credit chart cost |
| KV `CACHE` | `wallet:{chain}:{addr}` | 300 seconds | Balances change but slowly |
| KV `CACHE` | `pnl:{chain}:{addr}` | 300 seconds | All-time PnL (v0.2); tracks the wallet TTL |
| KV `CACHE` | `safety:{chain}:{addr}` | 6 hours | GoPlus contract-safety scan (v0.2); slow-moving, but a renounce/blacklist flip should surface same-day |
| KV `CACHE` | `dex:{addr}` | 60 seconds | DexScreener supplementary coverage (v0.2); address-keyed (chain-agnostic). Short TTL — the newest tokens move fast — but enough to collapse a viral burst on one address against DexScreener's per-IP rate limit |
| KV `CACHE` | `symid:{SYMBOL}` | 1 day | Long-tail cashtag → coinId resolution (v0.2). Stable mapping; the `/coins?symbol=` search is ~5 credits, so a long TTL bounds it to one search per symbol per day and negative-caches slang (`'-'` sentinel). Price stays fresh via the `token:`/`chart:` keys inside `buildToken` |
| KV `CACHE` | `solkind:{mint}` | 30 days (positive) / 6 hours (not-yet-indexed) | Solana mint → canonical coinId (v0.3); same rationale as `kind:` — a real mint's id is permanent, and a not-yet-indexed brand-new mint re-checks within hours. `safety:solana:{mint}` (6h, GoPlus-Solana) and `dex:{mint}` (60s, DexScreener-Solana) reuse the existing safety/dex patterns; the `dex:` keyspace stays disjoint (base58 mints vs `0x…` addrs) |

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
| Detect if address is a token (EVM or Solana) | `GET /coins?blockchains={coinsSlug}&contractAddresses={addr}&limit=1` (`coinsSlug=solana` for the v0.3 mint path) | ~5 credits |
| Token details | `GET /coins/{coinId}` | ~1 credit |
| Token 7d chart | `GET /coins/charts?coinIds={coinId}&period=1w` | ~3 credits |
| Wallet balance | `GET /wallet/balance?address={addr}&connectionId={connSlug}` | **40 credits** |
| Wallet PnL (v0.2) | `GET /wallet/pl?address={addr}&connectionId={connSlug}` | **25 credits** |

(Costs are estimates — verify against `https://coinstats.app/docs/multipliers.md` and the per-endpoint docs.)

**Wallet PnL (v0.2):** `/wallet/pl` exposes fixed profit buckets — `allTime`,
`hour24`, `lastTrade`, `unrealized`, `realized` — and **no 30-day window**. We
surface **all-time** PnL (`summary.profit.allTime` + `summary.profitPercent.allTime`,
each a number or a `{ USD, BTC, ETH }` object). It is only fetched once an address is
a confirmed wallet (never on token/unknown fallthroughs), to avoid the 25-credit cost
on misses. Best-effort: a PnL failure doesn't fail the wallet card.

### GoPlus Token Security (v0.2 — external, free, keyless)

Not a CoinStats endpoint. `GET {GOPLUS_BASE_URL}/token_security/{chainId}?contract_addresses={addr}`
(`api.gopluslabs.io/api/v1`, numeric chain ids `1/56/137/8453/42161/10/43114`). **No
API key, no CoinStats credit, no daily-cap impact.** Fanned out in parallel with the
chart call on the token path; `apps/worker/src/goplus.ts` normalizes the raw `result[addr]`
record into a `TokenSafety` verdict (`safe`/`caution`/`danger`). Verdict rules are
**calibrated against a live trusted basket** — `is_mintable`/`is_proxy`/`is_blacklisted`
fire on legit tokens (CAKE/AAVE/PEPE), so they're informational `notes`, never
verdict-driving. Best-effort: a scan failure or unsupported chain leaves `safety`
undefined and the card renders without it.

**GoPlus Solana (v0.3 — same provider, `source:'goplus'`).** Solana mints scan via
`GET {GOPLUS_BASE_URL}/solana/token_security?contract_addresses={mint}` (`normalizeSolanaSafety`).
The result is keyed by the mint **verbatim** (base58 is case-sensitive). The EVM calibration
**inverts** on Solana: a legitimate SPL token *revokes* its mint + freeze authority, so an
un-revoked `mintable`/`freezable` is a **verdict-driving** `danger` (→ `mint_authority` /
`freeze_authority` flags), not benign-common. Verified live against WIF/JUP/POPCAT (all
revoked → `safe`) and BONK (`safe` + a `mutable_metadata` note — the one EVM-style exception,
since metadata-mutable fires on trusted JUP). `non_transferable` → `honeypot`;
balance-mutable / transfer-hook → `owner_privileges` (caution). SPL transfer-fee shape is
unverified, so taxes are reported `null` rather than risk a wrong number. Reusing GoPlus
(not a new provider) means **no new privacy disclosure** and no new env var.

### DexScreener supplementary coverage (v0.2 — external, free, keyless)

Not a CoinStats endpoint. `GET {DEXSCREENER_BASE_URL}/latest/dex/tokens/{addr}`
(`api.dexscreener.com`). **No API key, no CoinStats credit, no daily-cap impact** — the same
free-source model as GoPlus. `apps/worker/src/dexscreener.ts` normalizes the response into a
`TokenSummary` (`source:'dexscreener'`).

**CoinStats-first — this runs ONLY when CoinStats returns no data for an address** (a brand-new
token still propagating to data indexes). In `resolve()` it runs after both `detectTokenCoinId` →
null **and** the wallet path is empty, immediately before returning `unknown`. It never replaces a
working CoinStats path, so it adds **zero** CoinStats credits. It extends breadth for the three
newest-token scenarios: tokens still propagating to indexes, the long tail, and **wrong-chain
inference** (the chosen pair's `chainId` is authoritative, so a bad `chain` guess can't hide a token).

- **Pair selection:** among pairs whose `chainId` maps to one of our 7 supported chains, pick the
  highest `liquidity.usd`. Below `MIN_LIQUIDITY_USD` (10,000) → `null` (stay `unknown`; never a
  confident card for a dust/honeypot pair). The chosen pair's `chainId` is the **authoritative
  chain**, used both for the card and for the GoPlus scan that follows (`safety:{chain}:{addr}`).
- **DexScreener uses its OWN chain-slug namespace** (`ethereum`, `bsc`, `base`, `arbitrum`,
  `polygon`, `optimism`, `avalanche` — NOT CoinStats' `binance_smart`/`polygon-pos`). The worker
  keeps a separate `DEX_CHAIN` map; do not reuse `COINS_CHAIN`. Verified live 2026-06-09.
- **Best-effort:** a failure, timeout (2.5s), `429`, or below-floor result returns `null` and the
  lookup returns the `unknown` card. `sparkline` is empty (no free historical series).
- **Rate limit:** DexScreener's free tier is per-IP; the Worker is the caller (shared Cloudflare
  egress). The `dex:{addr}` KV cache (60s) absorbs bursts; on `429` we degrade silently.
- **Solana (v0.3):** `normalizeDexSolToken`/`fetchDexSolToken` are the Solana analogue, used by
  `/v1/sol` when a mint isn't yet indexed. Same endpoint (`/latest/dex/tokens/{mint}`), but it picks the
  highest-liquidity pair whose `chainId === 'solana'` and stamps `network:'solana'` + `solMint`.
  The EVM `DEX_CHAIN` map is intentionally left EVM-only — its values are the `Chain` (EVM) union,
  and a Solana mint never reaches the EVM `/v1/lookup` path, so adding `solana` there would be dead.

**Chain slugs differ PER ENDPOINT — three CoinStats namespaces (verified live 2026-06-02), plus a
fourth for DexScreener (above).** Do not share one map. `/coins?blockchains=` uses CoinStats' internal "chain" slugs; `/wallet/balance` uses the
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

- The detection filter param is **`contractAddresses` (plural)** — use the plural form to filter
  by contract; the singular `contractAddress` is a response field, not a filter (it returns the
  chain's top-ranked coin for any address). With the plural param, contract detection resolves
  cleanly (SHIB → `shiba-inu`).
- **Routing nuance — canonical multichain mega-caps (USDT/USDC) resolve via the wallet/holdings
  path, not raw contract-address detection.** Hovering a bare USDT/USDC *contract address* is the
  rare case where the contract-detection probe returns nothing actionable, so AlphaPeek surfaces
  these through the wallet path instead. Standard ERC-20s detect directly. When smoke-testing the
  *contract-detection* path, use a standard ERC-20 like SHIB/PEPE rather than USDT.
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
- **`?contractAddresses=` as a filter:** each contract address resolves to its own coin. A
  preloaded `{chain:addr→coinId}` index built from the response field is an equally valid approach.
- **Brand-new-token propagation ≈ hours (universal to data indexes).** A ~1h-old Base token
  ($138k liq) returned `unknown`; a ~9h-old one resolved. New tokens take time to propagate to any
  index regardless of liquidity → AlphaPeek is a trending/established-token tool, and supplements
  the very newest with live DEX data (see § 9).

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
5. On `scroll` (capture phase, any container), dismiss immediately — standard hover-tooltip behavior, and it prevents a card from chasing a tweet that X recycles mid-scroll (which would leave Floating UI pinning an orphaned card to the 0,0 top-left corner). A monotonic show-generation counter guards the async show path (pre-flight + mount awaits) so two concurrent shows for the same target can't both mount and orphan one.

**Address detection (`lib/regex.ts`):**
```ts
// Word-boundary lookbehind/lookahead to avoid matching inside longer hex (e.g. tx hashes)
export const EVM_ADDRESS = /(?<![a-fA-F0-9])0x[a-fA-F0-9]{40}(?![a-fA-F0-9])/g
```

**$TICKER (cashtag) detection (v0.2 — `lib/regex.ts` + `lib/tickers.generated.ts`):**
```ts
// `$` not preceded by a word char or another `$` + a letter-led 1–10 char symbol.
export const TICKER = /(?<![A-Za-z0-9$])\$([A-Za-z][A-Za-z0-9]{0,9})\b/
```
`findCashtag` uppercases the match and looks it up in **`TICKERS`** — a preloaded
`Map<UPPER_SYMBOL, coinId>` of the **top-1000 CoinStats coins by rank** (≈936 symbols after
collisions). A whitelist hit is the high-precision path (`$100`, plain English, stock tickers all
fall away; on a symbol collision the lowest-rank/canonical coin wins, so scam tokens reusing a
popular ticker never resolve) → it carries a known coinId and looks up via `/v1/coin`. The asset
is generated by **`scripts/build-tickers.mjs`** (`pnpm tickers:build`, committed output, run
manually — never in postinstall, it needs the API key) from
`GET /coins?limit=1000&sortBy=rank&sortDir=asc` (rank, **not** marketCap — that sort is broken
upstream).

**Long-tail cashtags (v0.2):** a `$SYMBOL` that is **not** whitelisted but ≥3 chars resolves to a
`{kind:'symbol'}` target that looks up via `/v1/symbol` (the Worker's single-match + market-cap
guard, §4). Two UX rules keep loosening the gate honest: (1) the discoverability **underline is
deferred** — a long-tail symbol underlines only *after* the Worker confirms a single match, so
hovering slang (`$GM`, `$WAGMI`) never flashes a cue; (2) `showCard` runs a **pre-flight** symbol
lookup and mounts the card only on a `token` result, so a non-match leaves no trace (no underline,
no "No data" card). The pre-flight result is cached, so the card's own lookup is an instant hit.
`content.ts` carries one `Target = {kind:'address',addr,chain} | {kind:'coin',coinId,symbol} |
{kind:'symbol',symbol} | {kind:'sol',mint}`.

**Solana mint detection (v0.3 — `lib/regex.ts` `findSolanaMint`):**
```ts
// 32–44 base58 chars, boundary-guarded. EVM addresses can't match (0x-prefixed; `0` excluded).
export const SOLANA_MINT = /(?<![1-9A-HJ-NP-Za-km-z])[1-9A-HJ-NP-Za-km-z]{32,44}(?![1-9A-HJ-NP-Za-km-z])/
```
A bare base58 mint has no cheap prefix to gate on, so `detectTarget` runs `findSolanaMint`
**last** — only after the `0x` and `$` checks miss. Base58 detection is inherently low-precision
(other chains' addresses, IPFS CIDs, random tokens all look alike), so it reuses the long-tail
**pre-flight + deferred-underline** trust gate **exactly**: `showCard` probes `/v1/sol`, mounts
only on a confirmed `token`, and adds the underline only then — so a false positive costs a cached
Worker probe, never a wrong card or a flashed cue. (No `pump`-suffix gate: it would exclude
BONK/WIF/JUP and the pre-flight already gates precisely.) A new `SOL_LOOKUP { mint }` message,
`/v1/sol?mint=` worker call, and `sol:{mint}` IndexedDB key mirror the `SYMBOL_LOOKUP`/`sym:` trio
(the `unknown` result is cached too, and `sol:` entries are kept out of the popup's recent list).

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
- On message `COIN_LOOKUP { coinId }` (v0.2, $TICKER): same flow against `/v1/coin`, cached under
  a `coin:{coinId}` IndexedDB key (token-kind TTL). Coin entries are kept out of the popup's
  address-shaped recent list.
- On message `SYMBOL_LOOKUP { symbol }` (v0.2, long-tail $TICKER): same flow against `/v1/symbol`,
  cached under a `sym:{SYMBOL}` IndexedDB key. The `unknown` result is cached too (60-min unknown
  TTL), so a hovered slang word doesn't re-hit the Worker — mirroring the Worker's own negative
  cache. Symbol entries are kept out of the popup's address-shaped recent list.
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

// v0.2 — third-party (GoPlus) contract-safety scan. Distinct from TokenFlag
// (our own market-data heuristic): reflects on-chain contract properties.
export type SafetyVerdict = 'safe' | 'caution' | 'danger' | 'unknown'

export type SafetyFlag =
  | 'honeypot' | 'cant_sell_all' | 'high_buy_tax' | 'high_sell_tax'
  | 'mintable' | 'owner_privileges' | 'proxy' | 'unverified_source'
  | 'blacklist' | 'transfer_pausable'
  // v0.3 Solana (GoPlus-Solana): mint/freeze authority are verdict-driving on Solana (a
  // legit token revokes them); mutable_metadata is an informational note (fires on JUP).
  | 'mint_authority' | 'freeze_authority' | 'mutable_metadata'

export type TokenSafety = {
  verdict: SafetyVerdict
  buyTaxPct: number | null
  sellTaxPct: number | null
  flags: SafetyFlag[]  // verdict-driving risks, severity-ranked (worst first)
  notes: SafetyFlag[]  // informational (mintable/proxy/blacklist) — never raise the verdict
  source: 'goplus'
}

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
  flags: TokenFlag[]    // market-data hints only — NOT a safety verdict
  safety?: TokenSafety  // v0.2: best-effort; absent when the scan is unavailable
  source: 'coinstats' | 'dexscreener'  // v0.2: 'dexscreener' = free zero-credit supplementary source for the newest tokens
  url?: string          // v0.2: DexScreener pair URL when source='dexscreener'
  network?: 'solana'    // v0.3: present for Solana (SPL) tokens — the card's explorer discriminator
  solMint?: string      // v0.3: the Solana mint, for the solscan link (coinId may be a slug, not the mint)
}

// v0.2 — wallet performance. CoinStats exposes fixed buckets (no 30-day window),
// so the surfaced window is all-time.
export type WalletPnl = {
  window: 'all_time'
  absUsd: number  // may be negative
  pct: number     // may be negative
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
  pnl?: WalletPnl        // v0.2: all-time PnL; best-effort
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
| 1 | Hover SHIB contract on a tweet | Token card with SHIB data (use SHIB/PEPE — canonical mega-caps like USDT/USDC surface via the wallet path, see §4) + GoPlus safety verdict with hover-`ⓘ` attribution/disclaimer (v0.2; absent if scan unavailable) |
| 2 | Hover Vitalik's address on a tweet | Wallet card with total balance + top holdings + all-time PnL line (v0.2; absent if unavailable) |
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
| 13 | Hover `$PEPE` / `$CAKE` on a tweet (v0.2) | Token card (price/chart/mcap) + GoPlus verdict; single CoinStats footer link (no DEX link — no hovered contract) |
| 14 | Hover a non-whitelisted but uniquely-resolvable EVM cashtag, e.g. `$AEVO` (v0.2 long-tail) | Token card + GoPlus verdict, resolved via `/v1/symbol` single-match; the underline appears *with* the card (deferred), not on hover |
| 15 | Hover a cashtag, then its contract address (v0.2) | Both render the same token; second is cache-served (shared `token:`/`chart:`/`safety:` keys) |
| 16 | Hover a contested/sub-floor cashtag, e.g. `$MOON` (v0.2 long-tail) | No card AND no underline flash — `/v1/symbol` finds no single confident match (reused ticker), so nothing renders |
| 17 | Hover slang or a short cashtag, e.g. `$GM` / `$ME` (v0.2) | No card, no Worker hit — below the 3-char long-tail floor in `findCashtag` |
| 18 | Hover a pasted Solana mint, e.g. BONK `DezX…pB263` (v0.3) | Token card via `/v1/sol` + GoPlus-Solana verdict; footer links CoinStats + **Solscan**; underline appears *with* the card (deferred pre-flight) |
| 19 | Hover a fresh pump.fun mint not yet in CoinStats (v0.3) | Token card via the DexScreener-Solana fallback (`source:'dexscreener'`, empty sparkline) + safety; footer links DexScreener + Solscan |
| 20 | Hover a random base58-looking string (v0.3) | No card, **no underline flash** — `/v1/sol` pre-flight finds no token (negative-cached) |
| 21 | Hover a whitelisted Solana cashtag, e.g. `$WIF` / `$BONK` (v0.3) | Token card (price/chart/mcap) + safety; a Solana-native coin links Solscan, a multichain coin scans its EVM deployment (EVM-first) |
| 22 | Hover a contested Solana ticker, e.g. `$GOAT` (v0.3 long-tail) | No card AND no underline flash — two Solana coins clear the $50k floor → single-match guard stays silent |

## 9. Known v0.1 limitations (document in README and roadmap)

- **Solana tokens supported (v0.3); Solana wallets deferred** — Solana **token** mints + cashtags
  now resolve (token card + GoPlus-Solana safety, via `/v1/sol` and the widened cashtag guards).
  Solana **wallet** balances/PnL are **deferred to a follow-up cut** (a base58 *wallet* address
  needs a separate CoinStats wallet path or a Solana RPC; cashtag culture is token-centric). BTC
  and other non-EVM chains remain out (each needs its own address model).
- **X only** — Etherscan, DEXScreener, Telegram, Discord in v0.2+
- **$TICKER detection — shipped in v0.2, Solana added in v0.3** (top-1000 whitelist + a long-tail
  fallback via `/v1/symbol`). **Long-tail coverage is deliberately narrow:** CoinStats-indexed,
  supported-EVM **or Solana** (v0.3), resolving only when a symbol has exactly **one** showable coin
  above the $50k floor (the single-match guard — silent on the reused-ticker trap, so never a
  confident wrong-token card). What it doesn't resolve, by design: brand-new micro-caps not yet
  propagated to any data index, and **contested Solana tickers** where two coins clear the floor
  (e.g. `$GOAT`) — silent by design. It also fires comparatively rarely (most degen symbols are reused → silent).
  **Bundle note (SPEC §7):** the content script is ~83.7 KB gz, over the <25 KB budget, because
  React + the hover card are eagerly bundled into the content entry rather than lazy-loaded on first
  hover. v0.3 attempted the lazy-split (Phase 0) but **WXT 0.19 inlines content-script dynamic
  imports** (`import()` is bundled into the single IIFE, not code-split); a real split needs ESM
  content scripts + `web_accessible_resources` wiring — too invasive for the crown-jewel hover loop,
  so deferred. Solana adds only ~0.2 KB gz (a regex, no new whitelist), so it doesn't worsen the
  overage. Tracked as a follow-up, not a Solana/$TICKER regression.
- **No persistent watchlist** — in v0.3 with optional account
- **No alerts/notifications** — in v0.3
- **Chain inference is best-effort** — Twitter has no URL context, may guess wrong chain
- **Brand-new tokens take a few hours to propagate to any data index (v0.2 supplements those with
  live DEX data).** A brand-new token (~1h old) is too new to be indexed anywhere yet; by ~9h it
  resolves. AlphaPeek leads with **CoinStats** and, for tokens still propagating, additionally taps
  the free **DexScreener** source (§4), so the very newest EVM / long-tail / wrong-chain-inferred
  tokens with real liquidity (≥ `MIN_LIQUIDITY_USD`) still render a full token card + GoPlus verdict.
  The only remaining `unknown` cases (sub-floor liquidity, non-supported chains, pairs so new they
  aren't on DexScreener yet) render the [UnknownView] last-resort card, which links to both the block
  explorer and a DexScreener search. AlphaPeek is a trending/established-token inspector that also
  reaches the newest tokens.
