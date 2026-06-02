# Security Policy

## Supported versions

AlphaPeek is in early v0.1 development. Only the latest `0.1.x` release receives
security fixes.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a vulnerability

**Please do not report security issues through public GitHub issues.**

Report privately via [GitHub Security Advisories](https://github.com/z-Amiryan/alphapeek/security/advisories/new).
This keeps the report confidential until a fix is available. You can expect an
initial response within a few days. If you prefer email, contact
zhora.amiryan@coinstats.app.

Please include:

- A description of the issue and its impact.
- Steps to reproduce (a proof of concept if possible).
- Affected component: the Chrome extension (`apps/extension`), the Cloudflare
  Worker proxy (`apps/worker`), or shared code (`packages/shared`).

## Scope and threat model

The most sensitive asset in this project is the **CoinStats API key**, which
spends real credits. It lives only as a Cloudflare Worker secret (set via
`wrangler secret put COINSTATS_API_KEY`) and is never present in any extension
code path or committed to the repo. The Worker is an **unauthenticated public
proxy**; abuse is mitigated by layered rate limiting and caching rather than by
`Origin` checks (the `Origin` header is browser-only and trivially forged). See
[`docs/DEPLOYMENT.md` §11](docs/DEPLOYMENT.md) for the full abuse-mitigation model.

Reports we are especially interested in:

- Any path that could leak or exfiltrate the `COINSTATS_API_KEY`.
- Ways to bypass the Worker's per-IP and daily-cap rate limiting.
- XSS or content-injection in the hover card rendered into pages on X/Twitter.

## Key rotation

If the CoinStats API key is ever leaked or abused, rotate it immediately:

```bash
cd apps/worker
npx wrangler secret put COINSTATS_API_KEY   # re-prompts for a new value
```

Then revoke the old key in the CoinStats dashboard. See
[`docs/DEPLOYMENT.md` §11](docs/DEPLOYMENT.md) for details.

## For contributors and forks

Deploy your **own** Worker with your **own** key and point `VITE_WORKER_URL` at
it. Never share or commit a key, and never rely on someone else's proxy.
