import { defineConfig } from 'wxt'

const WORKER_URL = 'https://alphapeek-proxy.z-amiryan.workers.dev'

// `@wxt-dev/module-react` is WXT's official React integration — the "+ React" half
// of the locked "WXT (MV3 + Vite + React)" choice (SPEC §3), not a new dependency.
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  // Function form so the CSP can be mode-aware: `wxt build|zip` runs as
  // `production`, `wxt` (dev) as `development` (ConfigEnv.mode).
  manifest: ({ mode }) => {
    // `localhost:8787` is the local `wrangler dev` Worker — needed for dev against
    // a local proxy, but it must NOT ship in the store build (DEPLOYMENT.md §2).
    const connectSrc =
      mode === 'production' ? `'self' ${WORKER_URL}` : `'self' ${WORKER_URL} http://localhost:8787`
    return {
      name: 'AlphaPeek',
      description:
        'Hover any wallet, token or $cashtag on X (Twitter) — balances, PnL, price, 7-day charts, and a contract-safety check, instantly.',
      // Chrome's manifest `version` must be numeric; `version_name` carries the
      // human-readable beta label (the v0.2 safety/PnL cut shipped; breadth deferred).
      version: '0.2.0',
      version_name: '0.2.0-beta',
      permissions: ['storage'],
      host_permissions: ['https://x.com/*', 'https://twitter.com/*'],
      action: { default_popup: 'popup.html' },
      content_security_policy: {
        extension_pages: `script-src 'self'; object-src 'self'; connect-src ${connectSrc}`,
      },
    }
  },
})
