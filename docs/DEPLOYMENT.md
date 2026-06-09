# DEPLOYMENT.md — Runbook for v0.1 Launch

> **Agent rule:** Anything in this doc marked **🚨 ASK USER** must be confirmed before executing.

## 0. Prerequisites

Before any deployment work, the user must have:
- [ ] A Cloudflare account (free tier is fine)
- [ ] A CoinStats Public API account with API key ([https://openapi.coinstats.app](https://openapi.coinstats.app))
- [ ] A Chrome Web Store developer account ($5 one-time fee, set up by the user)
- [ ] GitHub repo created (under user's personal account)

## 1. Initial project setup (agent runs autonomously)

```bash
# In the repo root, after cloning the empty repo
pnpm init
pnpm add -D -w typescript@^5.7 @biomejs/biome@^1.9
pnpm exec biome init

# Create workspace config
echo "packages:
  - 'apps/*'
  - 'packages/*'" > pnpm-workspace.yaml

# Set up the three workspaces
mkdir -p apps/extension apps/worker packages/shared
# Initialize each per docs/SPEC.md §2

# Root scripts
# package.json scripts:
#   "typecheck": "pnpm -r typecheck"
#   "build":     "pnpm -r build"
#   "lint":      "biome check ."
#   "format":    "biome format --write ."
```

## 2. Cloudflare Worker deployment

### One-time setup (per environment)

```bash
cd apps/worker
npx wrangler login            # Opens browser, authenticate
npx wrangler kv namespace create CACHE
npx wrangler kv namespace create RATELIMIT
# Copy the returned IDs into wrangler.toml
```

### Add the CoinStats API key as a secret

```bash
npx wrangler secret put COINSTATS_API_KEY
# Paste the key when prompted. Never commit it. Never log it.
```

### Deploy to development

```bash
pnpm --filter @alphapeek/worker run dev   # local Wrangler dev server
# Test with:
curl "http://localhost:8787/v1/lookup?chain=ethereum&addr=0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce"
# Should return a token result for SHIB. (Use SHIB/PEPE, not USDT/USDC — those
# canonical mega-caps are not in CoinStats' contract-address index; see SPEC §4.)
```

### 🚨 ASK USER: Deploy to Cloudflare production

```bash
pnpm --filter @alphapeek/worker run deploy
# Outputs: https://alphapeek-proxy.<account>.workers.dev
```

> **This is the recommended / primary deploy path** (the CI workflow in §8 is an
> optional, manually-triggered alternative). It keeps your Cloudflare token on your
> machine, never in the repo. Bump `WORKER_VERSION` (`apps/worker/src/env.ts`, §7)
> before deploying so `GET /health` confirms the new build is actually live.

After production deploy:
- [ ] Record the Worker URL in `apps/extension/.env` as `VITE_WORKER_URL=...`
- [ ] Update `wxt.config.ts` CSP `connect-src` to allowlist the Worker domain
- [ ] Verify `GET /health` responds with `{ok: true}`
- [ ] Verify `GET /v1/lookup?...` works against production

## 3. Privacy policy

Required by Chrome Web Store for any extension that accesses user data (which we do — we send addresses to our Worker).

**File:** `docs/privacy.md`

**Hosting:** Enable GitHub Pages on the repo, source `main` branch `/docs` folder. URL will be `https://<user>.github.io/alphapeek/privacy.html` (or `/privacy` for the .md rendered version).

**Content checklist:**
- [ ] What data we collect: addresses the user hovers (sent to our Worker)
- [ ] What data we DON'T collect: no PII, no wallet contents, no tracking
- [ ] How long we retain it: per-IP rate-limit counters expire in ~70s; the global daily-cap counter expires in ~36h. No logs of queried addresses.
- [ ] Third parties: CoinStats receives the address as part of API queries; for token contracts, GoPlus also receives the contract address for the safety scan (v0.2) — both via the Worker, keep in sync with `privacy.md`/`privacy.html`
- [ ] User's rights: nothing to delete (we don't keep anything tied to identity)
- [ ] Contact: GitHub Issues

## 4. Chrome Web Store assets

**Store listing name:** `AlphaPeek`

Required:
- [ ] **Icon:** 128×128 PNG (also 48 and 16 for in-extension use)
- [ ] **Screenshots:** 1280×800 or 640×400 PNG, minimum 1 (recommend 3–5)
- [ ] **Promotional tile (small):** 440×280 PNG
- [ ] **Short description:** ≤132 chars. Use exactly: `Peek any wallet or token on X (Twitter) — see balances, top holdings, price and 7-day charts instantly on hover.` (matches `wxt.config.ts` `manifest.description`)
- [ ] **Detailed description:** Markdown-ish plain text, up to 16 KB
- [ ] **Category:** Productivity (or Developer Tools)
- [ ] **Privacy policy URL:** GitHub Pages URL from step 3
- [ ] **Single purpose statement:** "AlphaPeek shows wallet and token info when you hover an address on X/Twitter."

> **SEO note:** Chrome Web Store search ranking lives in the **listing copy**, not in the code. The only discoverability lever is the **detailed description** — work keywords in *naturally* (wallet, token, EVM, X/Twitter, balances, holdings, price, hover). There is **no** keyword/tag field, and a standalone keyword list in the description is rejected as spam ([keyword stuffing](https://developer.chrome.com/docs/webstore/troubleshooting/#keyword-stuffing)). The manifest `description` only seeds the short description; update the listing copy to actually move SEO.

### 🚨 ASK USER: Permission justification

Chrome reviewers ask why we need each permission. Pre-write these:

| Permission | Justification |
|---|---|
| `storage` | Caches address lookups locally to reduce network requests; stores user's default chain preference. |
| `host_permissions: x.com, twitter.com` | Detect EVM addresses in tweets to enable hover info cards. We do not modify tweet content beyond adding a hover underline. |
| Remote code (Worker) | We do not load remote scripts. All JS is bundled with the extension. The Worker is a proxy that only returns JSON data. |

## 5. Building the extension for distribution

```bash
pnpm --filter @alphapeek/extension run build
# Outputs apps/extension/.output/chrome-mv3/
pnpm --filter @alphapeek/extension run zip
# Outputs apps/extension/.output/alphapeekextension-<version>-chrome.zip
# (e.g. alphapeekextension-0.1.0-chrome.zip — this is what you upload)
```

## 6. 🚨 ASK USER: Chrome Web Store submission

### First submission (unlisted beta)

1. Log into [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
2. Click "New Item" → upload `chrome-mv3.zip`
3. Fill in all assets from step 4
4. Under **Distribution > Visibility:** select **Unlisted**
5. Submit for review (typically 1–3 business days for first-time)

### After approval

- Share the unlisted URL with 5–10 trusted users (crypto-Twitter friends)
- Collect feedback for ~1 week
- File any bugs as GitHub Issues, fix, re-publish

### Flipping to public (after beta validates)

- 🚨 **ASK USER** before changing visibility from Unlisted to Public
- Final pre-public checklist:
  - [ ] All v0.1 features work as described in SPEC.md and UX.md
  - [ ] All 10 smoke tests pass (see SPEC.md §8)
  - [ ] No console errors in production builds
  - [ ] Privacy policy live at the URL listed
  - [ ] At least 3 high-quality screenshots
  - [ ] Detailed description proofread

## 7. Versioning

| Layer | Versioning |
|---|---|
| Worker | Date-based: `v2026.01.15` in `/health` response. Update on each deploy. |
| Extension | Semver in manifest: `0.1.0` → `0.1.1` for patches, `0.2.0` for v0.2 launch |
| Shared types | Pinned via workspace dependency. Bump alongside extension. |

Always bump extension version in `wxt.config.ts` `manifest.version` before any Web Store re-submission.

## 8. CI/CD (GitHub Actions)

Two workflows in `.github/workflows/`:

> The pnpm version is **not** pinned in the workflow `with:` block — `pnpm/action-setup@v4` reads it from the root `package.json` `packageManager` field (`pnpm@9.12.0`). Passing `version` too makes the action error on the conflict.

### `ci.yml` (runs on every PR and push to main)

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
      - name: Upload extension build
        uses: actions/upload-artifact@v4
        with:
          name: alphapeek-extension
          path: apps/extension/.output/chrome-mv3/
          if-no-files-found: error
```

### `deploy-worker.yml` (manual trigger, **gated by approval**)

**The primary deploy path is the manual `wrangler deploy` in §2** — best for a
solo, open-source beta because it keeps your Cloudflare credentials on your machine
and out of the public repo entirely. This workflow is the **optional** gated/audited
alternative: it runs **only** when you trigger it from the Actions tab
("Run workflow" → `workflow_dispatch`), and the `production` GitHub Environment
still **pauses for required-reviewer approval**.

> It previously triggered on push to `main`, but that **failed on every merge**
> (no `CLOUDFLARE_API_TOKEN` set) while the green `ci.yml` check made it *look* like
> a successful deploy — a real footgun (it shipped nothing). Manual trigger removes
> that. Only adopt the auto-deploy-on-merge form once you accept a scoped token
> living in the repo and want "merge = released".

```yaml
name: Deploy Worker
on:
  workflow_dispatch:             # manual "Run workflow" only
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production        # pauses for required-reviewer approval
    concurrency:
      group: deploy-worker
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @alphapeek/worker run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          # Uncomment only for a multi-account API token:
          # CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

The manual deploy (§2) needs **none** of the GitHub settings below. Configure them
**only if** you opt into this workflow:
1. **Create the `production` Environment** (Settings → Environments) and add the maintainer as a **Required reviewer** — this is what makes the gate pause.
2. **Add the `CLOUDFLARE_API_TOKEN` secret**, scoped to the `production` environment — create the token at https://dash.cloudflare.com/profile/api-tokens with the "Edit Cloudflare Workers" template (minimal scope: `Workers Scripts: Edit` + `Workers KV Storage: Edit` on the one account).
3. The Worker also needs its **KV namespace IDs** filled into `wrangler.toml` (§2) and the **first deploy done manually** (§2) — a non-interactive `wrangler deploy` fails until both are true, regardless of the token.
4. `COINSTATS_API_KEY` is set via `wrangler secret put` (§2), **NOT** as a GitHub secret. Never put it in repo or CI logs.

## 9. Rollback procedure

If a deployed Worker is broken:
```bash
cd apps/worker
npx wrangler deployments list
npx wrangler rollback <deployment-id>
```

If a published extension is broken:
- Go to Web Store Developer Dashboard → Item → Package → upload previous `.zip`
- Re-submit (faster review for re-submissions, usually <24h)
- Until review passes, users are on the broken version. **This is why we run unlisted beta first.**

## 10. Post-launch monitoring (first week)

The user (not the agent) checks daily:
- [ ] Cloudflare Workers analytics → daily request count vs `DAILY_CAP`
- [ ] CoinStats API dashboard → credit usage trend
- [ ] Chrome Web Store dashboard → install count, ratings, reviews
- [ ] GitHub Issues → user-reported bugs

If `DAILY_CAP` is approached, raise it in `wrangler.toml` and redeploy. If CoinStats credits trend toward the plan limit, the user decides whether to upgrade the plan or tighten the cache TTLs.

## 11. Security & abuse mitigation (shared public proxy)

The repo is open source and the extension ships publicly, so the Worker URL is
discoverable. **The proxy is an unauthenticated public endpoint that spends your
CoinStats credits.** CORS does **not** protect it: the `Origin` header is only
enforced by browsers and is trivially forged by `curl`/scripts, so we
deliberately do **not** server-side block by `Origin` (it would be false
security). Defense is layered instead:

**In code (already shipped):**
- Per-IP limit (60 req/min) and a global `DAILY_CAP` (default `5000`) in
  `wrangler.toml`. It counts `/v1/lookup` requests per day — incremented once per
  request, including KV cache hits — so it is a **request** cap and only an
  *upper bound* on credit spend, not a direct credit meter. Rough worst case is
  `DAILY_CAP × ~45` credits/day (an uncached wallet lookup ≈ detect 5 + balance
  40); cached requests and token lookups cost far less.
- The mandatory KV cache (SPEC §4) collapses repeat lookups so normal traffic
  costs far fewer credits than requests.

**At the Cloudflare edge — only on a custom domain, NOT on `*.workers.dev`:**
WAF Rate Limiting rules, Bot Fight Mode, and Turnstile are **zone-level** features.
They apply to domains you've added to Cloudflare, **not** to the shared `workers.dev`
domain. While the Worker is served from `alphapeek-proxy.<sub>.workers.dev`, the
in-code limits above are the defense; these dashboard controls are unavailable.

To unlock them (recommended before flipping the listing **Public**, optional for an
unlisted beta):
1. Add a domain you own to Cloudflare (free plan) and update its nameservers.
2. **Workers & Pages → alphapeek-proxy → Settings → Domains & Routes → Add Custom
   Domain** (e.g. `api.alphapeek.app`). This binds the Worker to that zone.
3. Update `VITE_WORKER_URL` + the `wxt.config.ts` CSP `connect-src` to the custom
   domain, rebuild, and re-submit the extension.
4. Now on that zone: **Security → Bots → Bot Fight Mode** (on), **Security → WAF →
   Rate limiting rules** (~30 req/min per IP, action *Block*), and optionally
   **Turnstile** if abuse persists. These run before the Worker, so they also blunt
   IP-rotating bursts cheaply.

A custom domain also removes the single-point-of-failure of the shared `workers.dev`
host and reads as more trustworthy in the privacy policy.

**On `workers.dev` today:** enable Worker observability (`[observability] enabled =
true` in `wrangler.toml`) and watch **Workers → Metrics** + CoinStats credit usage
(§10) — that plus the in-code per-IP and `DAILY_CAP` limits is sufficient for a
small unlisted beta.

**Operational:**
- Watch CoinStats credit usage daily (§10). Pick a `DAILY_CAP` whose worst-case
  credit cost (see above) you can afford to lose in a day; raise it deliberately
  as real usage grows.
- If the key is ever abused or leaked, rotate it immediately:
  `npx wrangler secret put COINSTATS_API_KEY` (re-prompts for a new value), then
  revoke the old key in the CoinStats dashboard.

**Contributors / forks:** deploy your **own** Worker with your **own** key
(§2) and point `VITE_WORKER_URL` at it — never share or commit a key, and never
rely on someone else's proxy. Note the Worker host is configured in **two** places:
`VITE_WORKER_URL` in `apps/extension/.env` (the fetch target) **and** the
`connect-src` allowlist in `apps/extension/wxt.config.ts` (the manifest CSP). A
**production** build pointed at your own Worker is silently CSP-blocked until **both**
are updated; local dev against `http://localhost:8787` works out of the box (the
dev-mode CSP allows it).
