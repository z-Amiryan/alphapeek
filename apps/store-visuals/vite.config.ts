import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// No @vitejs/plugin-react: this is a static export page (no HMR/fast-refresh
// needed), so Vite's built-in esbuild handles TSX via the automatic JSX runtime.
// The `@` alias points at the real extension source so we render its actual
// TokenView / WalletView rather than a copy.
export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, '../extension/src') },
  },
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
})
