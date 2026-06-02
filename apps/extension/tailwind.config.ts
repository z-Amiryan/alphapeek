import type { Config } from 'tailwindcss'

// Design tokens mirror UX.md §2. Dark mode is class-based: the shadow-root
// container gets a `dark` class when X is in dark theme (see shadow/mount.ts).
export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        neutral: {
          50: '#FAFAFA',
          100: '#F4F4F5',
          500: '#71717A',
          900: '#18181B',
        },
        // Dark surfaces, referenced via the `dark:` variant.
        surface: {
          dark: '#18181B',
          'dark-100': '#27272A',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        accent: '#6366F1',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xs: '11px',
        sm: '13px',
        base: '14px',
        lg: '16px',
        xl: '20px',
      },
      boxShadow: {
        card: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      },
      width: {
        card: '320px',
      },
      maxHeight: {
        card: '480px',
      },
    },
  },
  plugins: [],
} satisfies Config
