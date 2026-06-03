import type { Config } from 'tailwindcss'
import extensionConfig from '../extension/tailwind.config'

// Reuse the extension's Terminal theme verbatim (same tokens, shadows, fonts) so
// the rendered cards are pixel-identical to production. Only the content globs
// differ: scan both the gallery and the real extension components, since the
// utility class names live in those component files.
export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,html}', './index.html', '../extension/src/**/*.{ts,tsx}'],
  theme: extensionConfig.theme,
  plugins: [],
} satisfies Config
