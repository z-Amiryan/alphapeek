// Popup root (UX §7) in the Terminal pattern. Theme follows the OS preference —
// the popup is our own surface.
import { type Chain, DEFAULT_CHAIN } from '@alphapeek/shared'
import { useEffect, useState } from 'react'
import { ChainSelect } from '@/components/ChainSelect'
import { FearGreedBadge } from '@/components/FearGreedBadge'
import { ArrowOut, LogoMark } from '@/components/icons'
import { ManualLookup } from '@/components/ManualLookup'
import { RecentLookups } from '@/components/RecentLookups'
import { BTN, LABEL } from '@/components/ui'
import { getDefaultChain, setDefaultChain } from '@/services/settings'

// Public repo links (the live remote). Not secrets, safe to inline.
const REPO_URL = 'https://github.com/z-Amiryan/alphapeek'
const ISSUES_URL = 'https://github.com/z-Amiryan/alphapeek/issues'

const SEC = 'border-b-[1.5px] border-line p-[13px]'

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
    <div className={`ap-root ${dark ? 'dark' : ''}`}>
      <div className="max-h-[600px] w-[360px] overflow-y-auto border-[1.5px] border-line bg-surface font-mono text-fg antialiased">
        <header className="flex items-center gap-[9px] border-b-[1.5px] border-line p-[13px]">
          <LogoMark animated />
          <span className="text-[16px] font-bold tracking-[0.02em]">ALPHAPEEK</span>
          <span className="ml-auto text-[10px] font-bold tracking-[0.08em] text-dim">v0.1</span>
        </header>

        <section className={SEC}>
          <FearGreedBadge />
        </section>

        {ready ? (
          <section className={SEC}>
            <ManualLookup
              key={defaultChain}
              defaultChain={defaultChain}
              onLookupComplete={() => setReloadToken((n) => n + 1)}
            />
          </section>
        ) : null}

        <section className={SEC}>
          <span className={`mb-2 ${LABEL}`}>Recent Lookups</span>
          <RecentLookups reloadToken={reloadToken} />
        </section>

        <section className={SEC}>
          <label htmlFor="cl-default-chain" className={`mb-2 ${LABEL}`}>
            Default Chain
          </label>
          <ChainSelect
            id="cl-default-chain"
            value={defaultChain}
            onChange={(c) => void onDefaultChainChange(c)}
            className="w-full"
          />
        </section>

        <footer className="flex border-t-[1.5px] border-line">
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={BTN}>
            GitHub <ArrowOut />
          </a>
          <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className={BTN}>
            Report a Bug <ArrowOut />
          </a>
        </footer>
      </div>
    </div>
  )
}
