# AlphaPeek

> Peek any wallet or token address on X — instant balances, holdings, and prices.

**AlphaPeek** is a Chrome extension (Manifest V3) for **X / Twitter** that detects **EVM wallet and token addresses** and shows a hoverable info card: wallet **balances** and top **holdings**, or token **price**, market cap, and a **7-day chart** — all on **hover**, with no login or setup. Built on the CoinStats Public API.

**Status:** v0.1 — pre-release, in active development by a Claude agent.

## What it does

Hover any EVM wallet address on X/Twitter → instant card showing balance and top holdings for wallets, or price, market cap, and 7-day sparkline for token contracts. No login, no setup, no friction.

## Architecture at a glance

```
┌────────────────┐   GET /v1/lookup    ┌──────────────────────┐   X-API-KEY    ┌──────────────┐
│ WXT Extension  │ ──────────────────▶ │ Cloudflare Worker    │ ─────────────▶ │ CoinStats    │
│ (React, TS)    │ ◀────────────────── │ (Hono, KV cache)     │ ◀───────────── │ Public API   │
└────────────────┘     JSON            └──────────────────────┘    JSON         └──────────────┘
        │
        │ IndexedDB cache (per user)
        ▼
   Shadow DOM hover card
```

## Repo structure

```
alphapeek/
├── apps/
│   ├── extension/        # WXT-based Chrome extension (React + Tailwind + TS)
│   └── worker/           # Cloudflare Worker proxy (Hono + TS)
├── packages/
│   └── shared/           # Shared TypeScript types between extension and worker
├── docs/                 # Project docs (read these in order: CLAUDE.md, SPEC.md, UX.md, ...)
├── .github/workflows/    # CI/CD
├── biome.json            # Lint + format config
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

## Getting Started (local development)

AlphaPeek runs entirely on free tiers, with your own keys. Nothing is shared — the
extension talks to *your* Worker, and the Worker holds *your* CoinStats key.

**Prerequisites:** Node 22 + `pnpm` 9, a free [CoinStats Public API](https://openapi.coinstats.app)
key, and (for deploying the proxy) a free Cloudflare account. See `docs/DEPLOYMENT.md` §0.

```bash
# 1. Install
pnpm install

# 2. Worker: add your CoinStats key (gitignored, never committed)
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
#   then edit apps/worker/.dev.vars and set COINSTATS_API_KEY=<your key>

# 3. Extension: point it at the local Worker
cp apps/extension/.env.example apps/extension/.env
#   .env should contain: VITE_WORKER_URL=http://localhost:8787

# 4. Run the Worker locally
pnpm -C apps/worker dev          # serves http://localhost:8787

# 5. Build the extension, then load it in Chrome
pnpm -C apps/extension build     # outputs apps/extension/.output/chrome-mv3/
#   chrome://extensions → Developer mode → Load unpacked → select that folder
```

Quick sanity check against the running Worker:

```bash
curl "http://localhost:8787/v1/lookup?chain=ethereum&addr=0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce"  # SHIB token
```

**Checks before opening a PR:** `pnpm typecheck`, `pnpm biome check .`, `pnpm -C apps/worker test`.

For the full architecture and the Worker's request/response contract, read `docs/SPEC.md`.
For deploying your own Worker + the security model of the shared proxy, see `docs/DEPLOYMENT.md`.

## Quickstart for the agent

1. **Read `CLAUDE.md` first.** It's the operating manual.
2. Then read in order: `docs/SPEC.md` → `docs/UX.md` → `docs/ROADMAP.md` → `docs/DEPLOYMENT.md`.
3. Build incrementally; commit often with conventional commits.

## For humans

- **License:** MIT — see [LICENSE](LICENSE)
- **Privacy policy:** `/docs/privacy.md` (served via GitHub Pages)
- **Issues:** GitHub Issues
- **API:** [CoinStats Public API](https://coinstats.app/api-docs/)
