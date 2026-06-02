# CLAUDE.md — Agent Operating Manual

> **Read this file before any other file. This is your source of truth for behavior, scope, and decision-making.**

## Project mission (one paragraph)

Build **AlphaPeek v0.1**: a Chrome extension (Manifest V3) that detects EVM wallet addresses on X/Twitter and shows a hoverable info card with wallet balance and top holdings — or token price and 7-day chart if the address is a contract. (30-day PnL is deferred to v0.2 — see `docs/ROADMAP.md`.) Data flows through a Cloudflare Worker proxy that holds the CoinStats API key. The user is **anonymous** (no login). MVP target: **fast, clean, defensive, shippable in ~2 weeks**.

## Documents in this repo (read in order)

1. **`CLAUDE.md`** ← you are here
2. **`docs/SPEC.md`** — full technical spec (architecture, contracts, components)
3. **`docs/UX.md`** — hover card layouts and interaction details
4. **`docs/ROADMAP.md`** — v0.1 / v0.2 / v0.3 scope (do not cross v0.1 boundary without asking)
5. **`docs/DEPLOYMENT.md`** — runbook for Cloudflare + Chrome Web Store
6. **`README.md`** — repo overview (already read?)

## Operating rules (hard, do not violate)

### Stop and ask the user before:
- Deploying anything to Cloudflare production (`wrangler deploy` to non-dev environment)
- Submitting to the Chrome Web Store
- Adding any npm/pnpm dependency not listed in `docs/SPEC.md`
- Implementing any feature not in v0.1 scope (see `docs/ROADMAP.md`)
- Modifying anything in `.github/workflows/` after initial setup
- Committing or logging anything containing `COINSTATS_API_KEY` or other secrets
- Pushing directly to `main` (always PR, even for solo work)

### Always do:
- Run `pnpm typecheck` and `pnpm biome check .` before declaring any task complete
- Use **conventional commits** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`)
- Branch per feature: `feat/<slug>`, `fix/<slug>`
- Reference the spec file + section in commit bodies when relevant
- Comment only to explain a *why* — a non-obvious decision, tradeoff, or gotcha. Don't add comments that restate *what* the code already says; rename or restructure instead.
- Re-read the relevant spec section before starting a new task

### Never do:
- Use `any` in TypeScript (use `unknown` and narrow, or define proper types)
- Use `console.log` in production code (use a `debug(...)` helper that strips in builds)
- Add a state-management library (Redux, Zustand, Jotai) — v0.1 doesn't need it
- Add analytics, telemetry, or tracking of any kind without explicit user approval
- Touch the user's CoinStats API key in any frontend code path — only the Worker holds it
- Inline any address, key, or URL that could be a secret — all secrets go through Wrangler secrets or GitHub Actions secrets

## Definition of Done (v0.1)

A task is **done** when ALL of:
- [ ] Code passes `pnpm typecheck` with zero errors
- [ ] Code passes `pnpm biome check .` with zero errors
- [ ] If a behavior changed: documented in commit message
- [ ] If a spec assumption was wrong: spec doc updated in same PR
- [ ] Manual smoke test passed (see test matrix in `docs/SPEC.md`)

## Coding standards (concise)

**TypeScript:**
- `strict: true`, `noUncheckedIndexedAccess: true`
- Prefer `type` over `interface` unless extending
- No `any`. No non-null assertions (`!`) — handle the null case
- Discriminated unions for variant responses (see `LookupResult` type)

**React:**
- Function components only. Hooks only.
- One component per file. File name = component name (`HoverCard.tsx`)
- Props typed inline if simple, separate `type Props = {...}` if complex
- No prop-drilling more than 2 levels — lift state or use context
- No `useEffect` for derived state — use `useMemo`

**File layout (extension):**
```
apps/extension/src/
├── entrypoints/
│   ├── content.ts        # Content script entry (X/Twitter only)
│   ├── background.ts     # Service worker entry
│   └── popup/            # Popup UI entry
├── components/           # React components
├── lib/                  # Pure utilities (regex, cache, formatting)
├── services/             # I/O boundary (Worker client, IndexedDB)
└── shadow/               # Shadow DOM mount logic
```

**Imports:**
- Use path aliases (`@/components/...`, `@shared/types`)
- Group: external → internal absolute → relative
- No wildcard re-exports

**Styling:**
- Tailwind utility classes only
- No inline `style={{...}}` except for dynamic positioning (e.g. Floating UI)
- Component-specific tweaks via Tailwind's `@apply` in a colocated `.css` file (last resort)

## When to ask the user vs. when to decide

**Ask** when:
- A choice has long-term reversibility cost (deps, file structure, public APIs)
- The spec is genuinely ambiguous or contradictory
- A finding suggests we should change scope
- You'd be guessing about the user's intent

**Decide** when:
- The choice is internal and easily refactorable (variable names, helper structure)
- The spec implies the answer even if not explicit
- It's a routine engineering judgment call (file naming, function decomposition)

**Default behavior when unsure:** ask. A 30-second clarification beats an hour of rework.

## Skills to leverage (in the Cowork environment)

- **`frontend-design`** — for React component patterns, Tailwind, accessibility
- **`product-self-knowledge`** — if you need facts about Anthropic products or the API

If a skill is unavailable, proceed with general best practices.

## Skill: how to handle the CoinStats API

- All API calls go through the Worker, never directly from the extension.
- The Worker's input/output contract is in `packages/shared/src/types.ts` and `docs/SPEC.md`.
- Use the curl examples in `docs/SPEC.md` to validate Worker behavior before integrating with the extension.
- API responses can have field name variations (e.g. `coinId` vs `id`, `imgUrl` vs `icon`). Handle both with a normalization function in the Worker.
- Credit cost is real: **/wallet/balance is 40 credits per call**. The cache strategy in `docs/SPEC.md` is mandatory, not optional.

## Sanity check: the smallest useful slice

If you only had time to ship one thing, ship the **hover card on a single wallet address detected in a single tweet**. Everything else (multiple addresses, popup UI, error states, settings) is layered on top of that core loop. Get the core loop working first, then iterate outward.
