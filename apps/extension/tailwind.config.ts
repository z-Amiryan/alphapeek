import type { Config } from 'tailwindcss'

// Terminal design system — neo-brutalist mono desk, electric-lime accent.
// Colors are CSS-variable-backed (defined in src/shadow/tokens.css) so a single
// `dark` class on the card/popup root flips the whole palette without `dark:`
// variants. Theme switching is wired in shadow/mount.ts and popup/App.tsx.
export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--ap-bg)',
        surface: 'var(--ap-surface)',
        fg: 'var(--ap-fg)',
        dim: 'var(--ap-dim)',
        line: 'var(--ap-line)',
        acc: 'var(--ap-acc)',
        'acc-ink': 'var(--ap-acc-ink)',
        up: 'var(--ap-up)',
        'up-ink': 'var(--ap-up-ink)',
        down: 'var(--ap-down)',
        'down-ink': 'var(--ap-down-ink)',
        warn: 'var(--ap-warn)',
        // Allocation-bar ramp (largest → smallest holding).
        seg: {
          1: 'var(--ap-seg1)',
          2: 'var(--ap-seg2)',
          3: 'var(--ap-seg3)',
          4: 'var(--ap-seg4)',
          5: 'var(--ap-seg5)',
        },
      },
      fontFamily: {
        mono: ['Space Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        // One offset hard shadow per card — lime-tinted on dark, ink on light.
        tm: 'var(--ap-shadow)',
      },
      width: {
        card: '320px',
      },
      maxHeight: {
        card: '480px',
      },
      transitionDuration: {
        tm: '120ms',
      },
      keyframes: {
        'ap-blink': { '50%': { opacity: '0' } },
        'ap-fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        // Loading caret — gated behind motion-safe so it respects reduced-motion.
        'ap-blink': 'ap-blink 1s steps(1) infinite',
        // Popup open splash → content reveal (UX §7). Always paired with `motion-safe:`
        // so reduced-motion users get the finished content with no movement.
        'ap-fade-in': 'ap-fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) both',
      },
    },
  },
  plugins: [],
} satisfies Config
