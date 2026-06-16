# Privacy Policy — AlphaPeek

_Last updated: June 10, 2026._

AlphaPeek is an open-source Chrome extension that shows information about wallet addresses and token contracts — on EVM chains and Solana — when you hover them on supported websites. This document explains what data the extension touches and what it doesn't.

## What AlphaPeek collects

When you hover an address (or `$cashtag`) that AlphaPeek recognizes on a supported site (currently X / Twitter only), the extension sends that address — an EVM address with a chain identifier (e.g., `ethereum`, `base`), or a Solana token mint — to the AlphaPeek proxy server. The proxy then queries the CoinStats Public API to fetch token or wallet information and returns the result to your browser.

## What AlphaPeek does NOT collect

- **Your identity.** AlphaPeek has no accounts, no login, no user IDs.
- **Your wallet's private data.** AlphaPeek reads public on-chain data about addresses you hover. It does not connect to wallets, request signatures, or have any access to your funds.
- **Browsing history.** AlphaPeek does not track which pages you visit. It only acts when you hover an address.
- **Tweet content.** AlphaPeek does not read tweets beyond the address pattern it matches under the cursor.
- **Tracking or advertising data.** No analytics, no tracking pixels, no third-party SDKs.

## What the proxy server logs

The AlphaPeek proxy (hosted on Cloudflare Workers) keeps the following minimal logs:
- **IP-based rate-limit counters** — to prevent abuse. These auto-expire after ~70 seconds (a 60-second sliding window plus a small margin) and are not tied to any identity.
- **Aggregate request counts per day** — to monitor service health and stay within free-tier limits. These auto-expire after ~36 hours.

The proxy does **not** log:
- Which specific addresses you queried
- Headers, cookies, or any identifying request metadata
- Browser fingerprints

## Third parties

When AlphaPeek looks up an address, the proxy sends that address to the [CoinStats Public API](https://coinstats.app/api/) to fetch token or wallet data. For **token contracts** (EVM contracts and Solana mints alike), the proxy also sends the contract/mint address to the [GoPlus Token Security API](https://gopluslabs.io/) for a free, keyless contract-safety scan. For a brand-new token still propagating to data indexes, the proxy may additionally send the address to the [DexScreener API](https://dexscreener.com/) — a free, keyless market-data lookup that covers both EVM chains and Solana — to surface the very newest tokens. Each provider's own privacy policy applies to that interaction. Your browser never contacts CoinStats, GoPlus, or DexScreener directly — all requests go through the proxy.

## Local storage on your device

AlphaPeek uses two browser storage mechanisms:
- **IndexedDB** — caches address lookup results for a short period (90 seconds for tokens, 10 minutes for wallets, 1 hour for addresses with no data yet) to reduce network requests. This same cache also powers the popup's "recent lookups" list.
- **`chrome.storage.local`** — stores your settings (your default chain).

You can clear both at any time by removing the extension or via Chrome's "Clear browsing data → Cookies and site data."

## Your rights

Because we don't collect anything tied to your identity, there is nothing to delete on our end. To stop using AlphaPeek, uninstall the extension from `chrome://extensions`.

## Changes

If this policy changes, the "Last updated" date above will change and the new version will be visible in the repo's commit history.

## Contact

Open an issue at the [AlphaPeek GitHub repository](https://github.com/z-Amiryan/alphapeek) for any privacy questions or concerns.
