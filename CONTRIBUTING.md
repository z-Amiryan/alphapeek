# Contributing to AlphaPeek

Thanks for your interest in AlphaPeek! This is a small, focused project — a Chrome
extension that shows wallet/token info on hover over EVM addresses on X/Twitter,
backed by a Cloudflare Worker proxy. Contributions are welcome.

> **Read [`CLAUDE.md`](CLAUDE.md) first** — it's the operating manual for the repo
> (scope, coding standards, and the rules below in more detail). Then skim
> [`docs/SPEC.md`](docs/SPEC.md) for the architecture and the Worker contract.

## Development setup

**Prerequisites:** Node 22, `pnpm` 9, a free [CoinStats Public API](https://openapi.coinstats.app)
key, and (only if you want to deploy a Worker) a free Cloudflare account.

Full step-by-step setup is in the [README "Getting Started"](README.md#getting-started-local-development)
section. In short:

```bash
pnpm install
cp apps/worker/.dev.vars.example apps/worker/.dev.vars   # add your CoinStats key
cp apps/extension/.env.example apps/extension/.env        # VITE_WORKER_URL=http://localhost:8787
pnpm -C apps/worker dev                                    # local Worker on :8787
pnpm -C apps/extension build                               # load .output/chrome-mv3 in Chrome
```

> **Run your own Worker.** AlphaPeek is designed so the extension talks to *your*
> Worker holding *your* CoinStats key. Forks must deploy their own Worker and point
> `VITE_WORKER_URL` at it — never commit a key, and never rely on someone else's
> proxy (it spends their credits). See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §11.

## Scope

AlphaPeek ships in versioned slices. Please keep PRs within the **current v0.1
scope** unless you've opened an issue to discuss first — see
[`docs/ROADMAP.md`](docs/ROADMAP.md) for what's in v0.1 vs. deferred to v0.2/v0.3
(e.g. wallet PnL, `$TICKER` detection, and new sites are explicitly v0.2+).

## Branching & commits

- Branch per change: `feat/<slug>` or `fix/<slug>`. Don't push directly to `main`.
- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`,
  `chore:`, `docs:`, `refactor:`. Reference the relevant spec section in the body
  when it helps.
- Open a PR (even small ones). Fill in the PR template checklist.

## Before you open a PR

These must pass — they mirror the project's Definition of Done:

```bash
pnpm typecheck          # zero errors (strict TS, no `any`, no non-null `!`)
pnpm biome check .      # zero errors (lint + format)
pnpm -C apps/worker test
```

If you changed behavior, note it in the commit message. If a spec assumption turned
out wrong, update the relevant doc in the same PR.

## Coding standards (quick version)

- **TypeScript:** `strict`, no `any` (use `unknown` and narrow), no non-null `!` —
  handle the null case. Discriminated unions for variant responses.
- **React:** function components + hooks only, one component per file.
- **No** `console.log` in production code (use the `debug(...)` helper), and **no**
  new dependencies, analytics, or state-management libraries without discussion.
- Comment the *why*, not the *what*.

Full detail lives in [`CLAUDE.md`](CLAUDE.md).

## Reporting bugs & requesting features

Use [GitHub Issues](../../issues) with the provided templates. For **security**
issues, do **not** open a public issue — see [`SECURITY.md`](SECURITY.md).

By contributing, you agree your contributions are licensed under the project's
[MIT License](LICENSE).
