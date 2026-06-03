import { defineConfig } from 'wxt'

// `@wxt-dev/module-react` is WXT's official React integration — the "+ React" half
// of the locked "WXT (MV3 + Vite + React)" choice (SPEC §3), not a new dependency.
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'AlphaPeek',
    description:
      'Peek any wallet or token on X (Twitter) — see balances, top holdings, price and 7-day charts instantly on hover.',
    version: '0.1.0',
    permissions: ['storage'],
    host_permissions: ['https://x.com/*', 'https://twitter.com/*'],
    action: { default_popup: 'popup.html' },
    // connect-src governs the popup page; tighten the workers.dev wildcard to the
    // deployed host after release (DEPLOYMENT.md §2).
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'self'; connect-src 'self' https://alphapeek-proxy.z-amiryan.workers.dev http://localhost:8787",
    },
  },
})
