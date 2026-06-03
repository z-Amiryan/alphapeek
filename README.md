<p align="center">
  <img src="assets/logo-animated.svg" alt="AlphaPeek" width="96" height="96" />
</p>

<h1 align="center">AlphaPeek</h1>

<p align="center">
  <em>Peek any wallet or token address on X — instant balances, holdings, and prices, on hover.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-c6f432" alt="MIT License" />
  <img src="https://img.shields.io/badge/manifest-v3-0d0d0d" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/status-v0.1%20pre--release-555" alt="Status" />
</p>

---

**AlphaPeek** is an open-source Chrome extension (Manifest V3) for **X / Twitter**. It detects **EVM wallet and token addresses** in the timeline and, when you hover one, shows a compact info card — a wallet's **balance, top holdings, and allocation**, or a token's **price, market cap, volume, and 7-day chart** — without ever leaving the page. No login, no wallet connection, no setup. Crypto data is powered by the [CoinStats Public API](https://coinstats.app/api-docs/).

> **Why it exists:** addresses fly past on Crypto Twitter constantly, and checking each one means copy-pasting into a block explorer. AlphaPeek turns that into a hover. It's also a reference implementation of what the CoinStats Public API can do.

## Features

- **Hover a wallet** → total USD balance, top 5 holdings, an allocation bar, and a **stablecoin %** ("risk-on vs parked") signal.
- **Hover a token contract** → symbol, price, 24h change, market cap, 24h volume, a **7-day sparkline**, and soft market-data flags (`low-liquidity` / `high-volatility` — hints, **not** a safety verdict).
- **Click any holding** → opens its CoinStats coin page (`coinstats.app/coins/{coin}`).
- **Toolbar popup** → live **Fear & Greed** index, a manual address lookup, your recent lookups, and a default-chain setting.
- **7 EVM chains:** Ethereum, BNB Chain, Polygon, Base, Arbitrum, Optimism, Avalanche. Chain is inferred from surrounding tweet text, falling back to your default.
- **Fast & private:** results are cached locally (IndexedDB), the card renders in an isolated Shadow DOM, and there is **no login, no account, and no tracking of any kind**.

## How it works

```
┌────────────────┐   GET /v1/lookup    ┌──────────────────────┐   X-API-KEY    ┌──────────────┐
│ WXT Extension  │ ──────────────────▶ │ Cloudflare Worker    │ ─────────────▶ │ CoinStats    │
│ (React + TS)   │ ◀────────────────── │ (Hono + KV cache)    │ ◀───────────── │ Public API   │
└────────────────┘     JSON            └──────────────────────┘    JSON         └──────────────┘
        │
        │ IndexedDB cache (per user) · Shadow DOM hover card
        ▼
   X / Twitter timeline
```

1. A content script watches for `mouseover` on the timeline and matches EVM addresses (`0x…40 hex`) in text.
2. After a 200 ms hover delay, the **background service worker** checks its IndexedDB cache, then calls the Worker on a miss.
3. The **Cloudflare Worker** is the only component that holds the CoinStats API key. It detects whether the address is a token contract or a wallet, fetches the data, normalizes CoinStats' field quirks, caches it in KV, and returns a typed result.
4. The extension renders the card in a Shadow DOM so AlphaPeek's styles never leak into — or inherit from — X's page.

**The API key never touches the extension or the repo.** It lives only as a Cloudflare Worker secret. Anyone can run their own copy: deploy the Worker with their own key (see [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)).

## Repo structure

```
alphapeek/
├── apps/
│   ├── extension/        # WXT Chrome extension (React + Tailwind + TS)
│   ├── worker/           # Cloudflare Worker proxy (Hono + TS, holds the API key)
│   └── store-visuals/    # Dev-only: renders the real cards for Web Store screenshots
├── packages/
│   └── shared/           # Shared TypeScript types — the worker⇄extension contract
├── docs/                 # SPEC, UX, ROADMAP, DEPLOYMENT, privacy, store-listing
├── .github/workflows/    # CI (checks) + gated worker deploy
└── README.md
```

The single source of truth for the Worker's request/response contract is [`packages/shared/src/types.ts`](packages/shared/src/types.ts).

## Getting started (local development)

AlphaPeek runs entirely on free tiers, with **your own** keys — nothing is shared. The extension talks to *your* Worker, and *your* Worker holds *your* CoinStats key.

**Prerequisites:** Node 22 + `pnpm` 9, a free [CoinStats Public API](https://openapi.coinstats.app) key, and (to deploy the proxy) a free Cloudflare account. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §0.

```bash
# 1. Install
pnpm install

# 2. Worker: add your CoinStats key (gitignored, never committed)
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
#   then set COINSTATS_API_KEY=<your key> in apps/worker/.dev.vars

# 3. Extension: point it at the local Worker
cp apps/extension/.env.example apps/extension/.env
#   .env should contain: VITE_WORKER_URL=http://localhost:8787

# 4. Run the Worker locally
pnpm -C apps/worker dev          # serves http://localhost:8787

# 5. Build the extension and load it in Chrome
pnpm -C apps/extension build     # outputs apps/extension/.output/chrome-mv3/
#   chrome://extensions → Developer mode → Load unpacked → select that folder
```

Quick sanity check against the running Worker (use SHIB — USDT/USDC aren't in CoinStats' contract index; see SPEC §4):

```bash
curl "http://localhost:8787/v1/lookup?chain=ethereum&addr=0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce"
```

## Contributing

- **Before opening a PR**, run: `pnpm typecheck`, `pnpm biome check .`, and `pnpm -C apps/worker test`.
- **Conventional commits** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`), one feature per branch.
- **TypeScript is strict** — no `any`, no `console.log` in production code (use the `debug()` helper).
- **No new dependencies** without discussion (see the locked stack in [`docs/SPEC.md`](docs/SPEC.md) §3).
- New to the codebase? Read in order: [`CLAUDE.md`](CLAUDE.md) → [`docs/SPEC.md`](docs/SPEC.md) → [`docs/UX.md`](docs/UX.md) → [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Security & privacy

- **The CoinStats API key is never in this repo, the extension bundle, or CI** — only as a Cloudflare Worker secret. Forks deploy their own.
- **No accounts, no login, no wallet connection, no analytics, no tracking.** AlphaPeek only acts when you hover an address.
- The Worker is an unauthenticated public proxy protected by a per-IP rate limit and a global daily cap; see the abuse model in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §11.
- Full policy: [`docs/privacy.md`](docs/privacy.md) (hosted via GitHub Pages for the Web Store listing).

## Status & limitations

v0.1, pre-release. Deliberately scoped (full list in [`docs/ROADMAP.md`](docs/ROADMAP.md)):

- **EVM only**, **X / Twitter only** — more chains and sites in v0.2+.
- **Trending/established-token inspector, not a launch-sniper.** CoinStats indexes new tokens within a few hours, so a minutes-old contract resolves as `unknown` by design.
- **No token-risk scoring, `$TICKER` detection, PnL, or watchlist yet** — see the roadmap.
- Chain inference from tweet text is best-effort (X has no URL context).

## For humans

- **License:** MIT — see [LICENSE](LICENSE)
- **Issues / bugs:** [GitHub Issues](https://github.com/z-Amiryan/alphapeek/issues)
- **Data:** [CoinStats Public API](https://coinstats.app/api-docs/)
