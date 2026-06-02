// Dev-only logger; the static isDev guard lets bundlers tree-shake every call
// site out of production builds. Use this instead of bare console.* in app code.
const isDev = import.meta.env.MODE === 'development'

export function debug(...args: unknown[]): void {
  if (isDev) {
    console.debug('[alphapeek]', ...args)
  }
}

export function debugError(...args: unknown[]): void {
  if (isDev) {
    console.error('[alphapeek]', ...args)
  }
}
