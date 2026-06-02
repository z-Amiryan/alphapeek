---
name: coinstats-contract
description: Reference for the AlphaPeek Cloudflare Worker's HTTP contract (/v1/lookup, /v1/fear-greed, /health) and copy-paste curl smoke checks to validate Worker behavior against a local `wrangler dev` before wiring the extension. Use when adding or changing a Worker endpoint, debugging a lookup/fear-greed response shape, verifying CORS/caching/rate-limit behavior, or confirming the Worker still matches packages/shared/src/types.ts.
---

# CoinStats Worker contract & smoke checks

The extension never calls CoinStats directly — it talks only to the Worker
(`apps/worker`), which holds `COINSTATS_API_KEY` and returns the typed shapes in
`packages/shared/src/types.ts`. That file is the single source of truth; this
skill is the operational view of it plus how to exercise it.

## Endpoints

### `GET /v1/lookup`
Resolves any EVM address to a `LookupResult`.

Query params:
- `addr` (required) — `^0x[a-f0-9]{40}$` after lowercase normalization. Bad shape → `400 { "error": "invalid_address" }`.
- `chain` (optional, default `ethereum`) — one of `ethereum`, `bsc`, `polygon`, `base`, `arbitrum`, `optimism`, `avalanche`. Unknown values fall back to `ethereum`.

200 response (`LookupResult`, discriminated on `kind`). One of:
```jsonc
// token contract
{
  "kind": "token",
  "data": {
    "coinId": "tether",
    "name": "Tether",
    "symbol": "USDT",
    "imgUrl": "https://static.coinstats.app/coins/tether.png",
    "price": 1.0,
    "pCh24h": -0.01,
    "marketCap": 112000000000,
    "volume": 45000000000,
    "sparkline": [0.999, 1.0, 1.001], // ~168 hourly points; may be []
    "flags": [] // 'low_liquidity' | 'high_volatility' — market-data hints, NOT a safety verdict
  }
}
```
```jsonc
// wallet
{
  "kind": "wallet",
  "data": {
    "address": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
    "chain": "ethereum",
    "totalUsd": 12345.67,
    "holdings": [ // top 5, USD-desc
      { "symbol": "ETH", "name": "Ethereum", "imgUrl": "https://…", "usd": 9000.0, "pct": 72.9 }
    ],
    "stablecoinPct": 12.4 // 0-100, computed over the FULL holdings before the top-5 slice
  }
}
```
```jsonc
// neither a known token nor a wallet with balances
{ "kind": "unknown" }
```

Resolution order (SPEC §4): kind-cache (token contract vs not) → if token, token detail+chart → else wallet balance → else `unknown`. The expensive `/wallet/balance` call (40 credits) is gated behind the long-lived kind cache.

### `GET /v1/fear-greed`
`200 FearGreed` → `{ "value": number, "label": string }`. Globally cached 300s.

### `GET /health`
`200 Health` → `{ "ok": true, "version": string }`. No auth, no rate limit.

## Error codes (`LookupError`)
| HTTP | `error` | Meaning |
|---|---|---|
| 400 | `invalid_address` | addr failed the regex |
| 429 | `rate_limited` | per-IP limit (60/min) tripped |
| 503 | `daily_cap_reached` | global `DAILY_CAP` reached |
| 503 | `upstream_error` | CoinStats non-2xx or unreachable |

## Caching & credit cost (do not regress)
| Layer | Key | TTL | Why |
|---|---|---|---|
| KV `CACHE` | `kind:{chain}:{addr}` | 30 days | address type is stable; gates the wallet call |
| KV `CACHE` | `token:{coinId}` | 60s | price moves |
| KV `CACHE` | `wallet:{chain}:{addr}` | 300s | balances move slowly |
| KV `CACHE` | `feargreed:latest` | 300s | shared globally |

CoinStats credit costs: detect ~5, token detail ~1, chart ~3, **wallet/balance 40**. The kind cache is what keeps repeated hovers of one address from re-burning 40 credits — never bypass `cached()`.

## Upstream slug gotchas (verified 2026-06-02 — full table in SPEC §4)

CoinStats uses **three different chain-slug namespaces** — the worker keeps `COINS_CHAIN` vs `WALLET_CHAIN`:
- `/coins?blockchains=` → internal chain slugs. **bsc = `binance_smart`** (the docs' `binance-smart-chain` returns 0 results). base=`base`, polygon=`polygon-pos`, arbitrum=`arbitrum-one`.
- `/wallet/balance?connectionId=` → wallet connection ids (NOT a `blockchain=` param, which 400s). bsc=`binancesmartchain`, base=`base-wallet`, polygon=`polygon-wallet`, etc.
- 7d chart endpoint is **`GET /coins/charts?coinIds={id}&period=1w`** (plural `coinIds`, wrapped `[{coinId, chart:[[ts,usd,…]]}]`) — NOT `/coins/{id}/charts`.

## CORS
`Access-Control-Allow-Origin` is reflected only for `chrome-extension://*`, `http://localhost[:port]`, and `http://127.0.0.1[:port]`. Other origins get no CORS headers.

## Smoke checks (local)

Start the Worker (needs `apps/worker/.dev.vars` with `COINSTATS_API_KEY` — gitignored, never commit it):
```bash
pnpm -C apps/worker dev   # serves http://localhost:8787
```

Run against `http://localhost:8787`. Use a `chrome-extension://` Origin so CORS headers come back.
```bash
BASE=http://localhost:8787
ORIGIN='chrome-extension://abcdefghijklmnopabcdefghijklmnop'

# health — no key needed
curl -s "$BASE/health"

# token (USDT on Ethereum) → expect kind:"token"
curl -s -H "Origin: $ORIGIN" \
  "$BASE/v1/lookup?addr=0xdac17f958d2ee523a2206206994597c13d831ec7&chain=ethereum"

# wallet (vitalik.eth) → expect kind:"wallet" with holdings, OR kind:"unknown"
curl -s -H "Origin: $ORIGIN" \
  "$BASE/v1/lookup?addr=0xd8da6bf26964af9d7eed9e03e53415d37aa96045&chain=ethereum"

# bad address → 400 invalid_address
curl -s -o /dev/null -w '%{http_code}\n' -H "Origin: $ORIGIN" "$BASE/v1/lookup?addr=0x123"

# fear & greed → { value, label }
curl -s -H "Origin: $ORIGIN" "$BASE/v1/fear-greed"

# CORS preflight → expect 204 + Access-Control-Allow-Origin echoing the Origin
curl -s -i -X OPTIONS -H "Origin: $ORIGIN" "$BASE/v1/lookup?addr=0x0" | head -n 15
```

Sanity rules:
- Every 200 body matches the `LookupResult` / `FearGreed` / `Health` shape in `packages/shared/src/types.ts`. If you change a field, change it there first.
- A token contract must resolve to `kind:"token"`, not `kind:"unknown"` — if every address comes back `token`, the `/coins` filter param is wrong (must be plural `contractAddresses`).
- If **BSC** tokens come back `unknown` or BSC lookups 503, check the slugs: `/coins` needs `binance_smart` and `/wallet/balance` needs `connectionId=binancesmartchain`. A ~1h-old token returning `unknown` is expected (indexing lag), not a bug.
- Never print or paste `COINSTATS_API_KEY` into a terminal, log, or commit.

After changes, run the worker unit tests: `pnpm -C apps/worker test`.
