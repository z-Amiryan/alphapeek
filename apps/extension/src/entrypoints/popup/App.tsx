// Popup root (UX §7). Theme follows the OS preference — the popup is our surface.
import { type Chain, CHAIN_LABELS, DEFAULT_CHAIN, SUPPORTED_CHAINS } from '@alphapeek/shared'
import { useEffect, useState } from 'react'
import { FearGreedBadge } from '@/components/FearGreedBadge'
import { ManualLookup } from '@/components/ManualLookup'
import { RecentLookups } from '@/components/RecentLookups'
import { getDefaultChain, setDefaultChain } from '@/services/settings'

// Public repo links (the live remote). Not secrets, safe to inline.
const REPO_URL = 'https://github.com/ZhoraAmiryan/alphapeek'
const ISSUES_URL = 'https://github.com/ZhoraAmiryan/alphapeek/issues'

const SECTION_DIVIDER = 'my-3 border-t border-neutral-100 dark:border-surface-dark-100'

function usePrefersDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e: MediaQueryListEvent) => setDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return dark
}

export function App() {
  const dark = usePrefersDark()
  const [defaultChain, setChain] = useState<Chain>(DEFAULT_CHAIN)
  const [ready, setReady] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true
    getDefaultChain().then((chain) => {
      if (!active) return
      setChain(chain)
      setReady(true)
    })
    return () => {
      active = false
    }
  }, [])

  const onDefaultChainChange = async (chain: Chain) => {
    setChain(chain)
    await setDefaultChain(chain)
  }

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="w-[360px] max-h-[600px] overflow-y-auto bg-neutral-50 px-4 py-3 text-neutral-900 dark:bg-surface-dark dark:text-neutral-50">
        <header className="flex items-baseline justify-between">
          <h1 className="text-lg font-bold">AlphaPeek</h1>
          <span className="text-xs text-neutral-500">v0.1</span>
        </header>

        <div className={SECTION_DIVIDER} />
        <FearGreedBadge />

        <div className={SECTION_DIVIDER} />
        {ready ? (
          <ManualLookup
            key={defaultChain}
            defaultChain={defaultChain}
            onLookupComplete={() => setReloadToken((n) => n + 1)}
          />
        ) : null}

        <div className={SECTION_DIVIDER} />
        <h2 className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Recent lookups</h2>
        <RecentLookups reloadToken={reloadToken} />

        <div className={SECTION_DIVIDER} />
        <label htmlFor="cl-default-chain" className="mb-1 block text-sm font-medium">
          Default chain
        </label>
        <select
          id="cl-default-chain"
          value={defaultChain}
          onChange={(e) => void onDefaultChainChange(e.target.value as Chain)}
          className="w-full rounded-lg border border-neutral-100 bg-neutral-50 px-2 py-1.5 text-sm text-neutral-900 dark:border-surface-dark-100 dark:bg-surface-dark dark:text-neutral-50"
        >
          {SUPPORTED_CHAINS.map((c) => (
            <option key={c} value={c}>
              {CHAIN_LABELS[c]}
            </option>
          ))}
        </select>

        <div className={SECTION_DIVIDER} />
        <footer className="flex items-center gap-4 text-sm">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            GitHub
          </a>
          <a
            href={ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            Report a bug
          </a>
        </footer>
      </div>
    </div>
  )
}
