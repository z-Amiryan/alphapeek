# ROADMAP.md — Version Scope Boundaries

> **Agent rule:** Do not implement features outside the current version's scope without explicit user approval. If you encounter an opportunity that looks "easy to add" — note it in a `// TODO(v0.2):` comment, do not build it.

## v0.1 — Wallet Inspector for X (DONE)

**Goal:** Validate the hover-card interaction model on a single high-traffic site.

**Positioning (evidence-backed, 2026-06-02):** a **trending/established token + wallet inspector**
for Crypto Twitter — *not* a minute-zero launch-sniper. CoinStats has a ~few-hour indexing lag
(see SPEC § 9), so the very newest tokens return `unknown` by design. Lean the value on Base/BNB
trending tokens + wallet inspection (X's native cashtags don't do wallets). Detection verified
working across both chains; BSC required slug fixes (see SPEC § 4).

**In scope:**
- Chrome extension only (Manifest V3)
- X / Twitter (`x.com`, `twitter.com`) only
- EVM addresses only — regex `/(?<![a-fA-F0-9])0x[a-fA-F0-9]{40}(?![a-fA-F0-9])/g`
- Supported chains: Ethereum, BSC, Polygon, Base, Arbitrum, Optimism, Avalanche
- Chain inference: surrounding-text keywords → user default
- Hover-triggered (200ms delay), no page-load scanning
- Dotted underline as the hover-discoverability cue
- Card variants: token, wallet, unknown, loading, error
- Wallet card shows: total balance, top 5 holdings, **allocation bar**, **stablecoin %** (no PnL — v0.2); each holding **deep-links to its CoinStats coin page**
- Token card shows: price, 24h change, market cap, volume, 7d sparkline, **derived flags** (low-liquidity / high-volatility — market-data hints, not a safety verdict)
- Popup UI: Fear & Greed, manual address lookup, default chain setting, recent lookups, brief branded open splash (see UX § 7)
- Anonymous (no login, no account)
- Cloudflare Worker proxy with KV cache + per-IP rate limit + daily cap
- Unlisted Chrome Web Store beta

**Explicitly out of scope (will reject if attempted):**
- $TICKER detection → v0.2
- Solana, BTC, or non-EVM chain support → v0.2 or v1.1
- Any site other than X → v0.2+
- Watchlist persistence → v0.3
- Notifications / alerts → v0.3
- Optional account or login → v0.3
- BYO API key power mode → v0.3
- Any backend that isn't the proxy Worker → v1.0+
- Mobile support → never planned (extensions are desktop-only)
- Wallet PnL → v0.2 (extra credit cost, deliberate v0.2 decision)
- DeFi positions → v0.2

## v0.2 — Safety-first (CURRENT · BETA)

**Goal:** Make safety the headline. Lead with a free contract-risk verdict on every
token card (the unique value proposition now that Hexens/Token Risks is out), plus a
smart-money PnL read on wallets — the two highest degen-value signals for Crypto
Twitter. Built this cut (status below); breadth items deferred within v0.2.

**This cut (built):**
- **Token Safety — GoPlus (headline VP).** Free, keyless contract scan
  (`api.gopluslabs.io`) on every token card: a `safe` / `caution` / `danger`
  verdict + buy/sell tax + severity-ranked findings. Verdict rules are **calibrated
  against a live trusted basket** (SHIB/LINK/UNI/AAVE/PEPE/CAKE/BRETT) — `mintable`,
  `proxy`, `blacklist` fire on legit tokens so they're informational *notes*, never
  verdict-driving. Best-effort: the card renders fully if the scan is unavailable.
- **Wallet PnL (all-time).** From CoinStats `GET /wallet/pl`, surfaced near total
  balance. CoinStats exposes fixed buckets (allTime / 24h / unrealized / realized) —
  **no 30-day window**, so the surfaced signal is **all-time** PnL (strongest "ever
  been profitable" read). Extra credit cost (25cr), only spent on confirmed wallets.
- **DexScreener coverage fallback (free, keyless, zero-credit).** When CoinStats returns
  `unknown` for a token address (detect→null + empty wallet), the Worker falls through to
  DexScreener (`api.dexscreener.com`), covering the three CoinStats coverage gaps: ~hours
  indexing latency (fresh tokens), the long tail (outside CoinStats' index), and **wrong-chain
  inference** (the chosen pair's `chainId` is authoritative, rescuing tokens a bad chain-guess
  would have hidden). **CoinStats-first is preserved** — it only fires on a miss, so it adds
  zero CoinStats credits; GoPlus safety then runs on the authoritative chain. A
  `MIN_LIQUIDITY_USD` floor + silent degrade-to-`unknown` keep it honest. See SPEC §4.

**Deferred within v0.2 / later (still planned, not this cut):**
- **Inline badge mode** (opt-in setting): tiny colored dot after each detected address, scanned on viewport entry. Hover-only stays as default for privacy/credit reasons.
- **$TICKER detection** with a whitelist of top 1000 coins (preloaded as a Set in the extension)
- **DeFi positions summary** ("$X across N protocols")
- **New sites:** Etherscan family (etherscan, basescan, arbiscan, bscscan, polygonscan, optimistic.etherscan, snowtrace), DEXScreener, GeckoTerminal
- **Chain inference v2:** URL context (path-based detection on block explorers)
- **Chain expansion** (analysis 2026-06; CoinStats supports 120+ chains via `GET /wallet/blockchains`):
  - *First, close the v0.1 gap:* verify the currently-**unverified** `optimism` / `avalanche` slugs
    (SPEC §4 marks them unverified) against the live API.
  - *EVM drop-ins* — share the same `0x…40hex` address space as our current 7, so no new detection
    regex is needed, only verified dual-slugs (`/coins?blockchains=` + `/wallet/balance?connectionId=`):
    **zkSync Era, Polygon zkEVM, Fantom, Immutable X**, plus emerging L2s (Linea, Scroll, Blast) if indexed.
  - *Kill wallet chain-inference:* evaluate **`GET /wallet/balances?address=…&networks=all`** (plural) —
    returns all EVM chains' balances in one call, so wallets no longer need a guessed chain. Weigh the
    higher credit cost. This is the architecturally cleaner path than adding EVM chains one at a time.
  - *Non-EVM chains* (Cardano, Tron, XRP, Cosmos, Polkadot, Near, Algorand, Stellar, LTC/DOGE/BCH,
    Hedera, StarkNet, …) use different address formats → a **new per-chain detection model**, not a slug
    add. Treat as its own effort. **Solana** (see v0.3) is the highest-value non-EVM target for Crypto Twitter.
- **Public Chrome Web Store listing** (out of beta)

## v0.3 — Stickiness

**Goal:** Turn one-shot users into daily users.

**Added scope:**
- **Watchlist** — star a wallet from any hover card, view list in popup
- **Background polling** — `chrome.alarms` checks watchlist every 15 minutes, push notification on significant changes
- **Price alerts** — set a threshold on any coin, get notified
- **Optional account** — sign in to sync watchlist across devices (Anthropic-style: optional, not required)
- **BYO API key power mode** — settings toggle, user pastes their own CoinStats key, bypasses the proxy
- **Telegram Web** + **Discord Web** + **Farcaster / Warpcast** site support
- **Solana** support (different address regex, different chain handling)

## v1.0 — Full crypto-browsing companion

**Stretch goals, prioritized later based on usage data:**
- Bitcoin (xpub support via CoinStats)
- NFT collection cards (when hovering NFT contracts)
- News overlay (CoinStats news inline on relevant tickers)
- Exchange ticker comparison (arbitrage hints)
- Firefox + Safari builds
- Embedded micro-charts on long pages (CMC / CoinGecko / Etherscan token pages)
- Optional encrypted sync via a tiny backend (if account adoption justifies it)

## Things that are NEVER in scope

These are explicit non-goals — flag and reject if proposed.

- Trading / order placement (regulatory minefield, not our value)
- Wallet connection / signing (security risk, not our value)
- Custodial features
- Crypto-tax calculation as a primary feature (tools like Koinly exist)
- AI chat features (use CoinStats's MCP server if you want this)
- Advertising or sponsored content
- Selling user data
- Cross-domain user tracking
