# ROADMAP.md — Version Scope Boundaries

> **Agent rule:** Do not implement features outside the current version's scope without explicit user approval. If you encounter an opportunity that looks "easy to add" — note it in a `// TODO(v0.2):` comment, do not build it.

## v0.1 — Wallet Inspector for X (CURRENT)

**Goal:** Validate the hover-card interaction model on a single high-traffic site.

**In scope:**
- Chrome extension only (Manifest V3)
- X / Twitter (`x.com`, `twitter.com`) only
- EVM addresses only — regex `/(?<![a-fA-F0-9])0x[a-fA-F0-9]{40}(?![a-fA-F0-9])/g`
- Supported chains: Ethereum, BSC, Polygon, Base, Arbitrum, Optimism, Avalanche
- Chain inference: surrounding-text keywords → user default
- Hover-triggered (200ms delay), no page-load scanning
- Dotted underline as the hover-discoverability cue
- Card variants: token, wallet, unknown, loading, error
- Wallet card shows: total balance, top 5 holdings (no PnL — v0.2)
- Token card shows: price, 24h change, market cap, volume, 7d sparkline
- Popup UI: Fear & Greed, manual address lookup, default chain setting, recent lookups
- Anonymous (no login, no account)
- Cloudflare Worker proxy with KV cache + per-IP rate limit + daily cap
- Unlisted Chrome Web Store beta

**Explicitly out of scope (will reject if attempted):**
- Token Risks / Hexens integration → v0.2
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

## v0.2 — Safety + Spread (NEXT)

**Goal:** Activate the unique value proposition (Token Risks) and broaden surface area.

**Added scope:**
- **Token Risks integration** — Hexens risk score on token cards, severity-ranked findings (top 3 in hover, full list on expand). This becomes the marketing headline.
- **Inline badge mode** (opt-in setting): tiny colored dot after each detected address, scanned on viewport entry. Hover-only stays as default for privacy/credit reasons.
- **$TICKER detection** with a whitelist of top 1000 coins (preloaded as a Set in the extension)
- **Wallet PnL** on hover card (30-day)
- **DeFi positions summary** ("$X across N protocols")
- **New sites:** Etherscan family (etherscan, basescan, arbiscan, bscscan, polygonscan, optimistic.etherscan, snowtrace), DEXScreener, GeckoTerminal
- **Chain inference v2:** URL context (path-based detection on block explorers)
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
