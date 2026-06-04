// Popup root (UX §7) in the Terminal pattern. Theme follows the OS preference —
// the popup is our own surface.
import { type Chain, DEFAULT_CHAIN } from '@alphapeek/shared'
import { useEffect, useState } from 'react'
import { ChainSelect } from '@/components/ChainSelect'
import { FearGreedBadge } from '@/components/FearGreedBadge'
import { ArrowOut, LogoMark } from '@/components/icons'
import { ManualLookup } from '@/components/ManualLookup'
import { RecentLookups } from '@/components/RecentLookups'
import { BTN, FOOT, LABEL } from '@/components/ui'
import { getDefaultChain, setDefaultChain, shouldShowSplash } from '@/services/settings'
import { Splash } from './Splash'

// Public links (the live remotes). Not secrets, safe to inline.
const REPO_URL = 'https://github.com/z-Amiryan/alphapeek'
const ISSUES_URL = 'https://github.com/z-Amiryan/alphapeek/issues'
const PRIVACY_URL = 'https://z-amiryan.github.io/alphapeek/privacy.html'
const COINSTATS_PUBLIC_API_URL = 'https://coinstats.app/api-docs/'
// Set once the extension is live on the Web Store and its id is known; until then the
// "Rate it" link is hidden rather than shipped broken.
const WEBSTORE_ID = ''
const REVIEW_URL = WEBSTORE_ID
  ? `https://chromewebstore.google.com/detail/${WEBSTORE_ID}/reviews`
  : ''

const SEC = 'border-b-[1.5px] border-line p-[13px]'

// Minimum time the open splash stays up — roughly one logo-draw — so the brand
// beat reads even when settings resolve instantly. The reveal still waits for
// settings too; this is just the floor. Lower it if the splash feels long.
const POPUP_SPLASH_MS = 900

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
  const [minElapsed, setMinElapsed] = useState(false)
  // null = still deciding whether this open is the session's first.
  const [showSplash, setShowSplash] = useState<boolean | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true
    getDefaultChain().then((chain) => {
      if (!active) return
      setChain(chain)
      setReady(true)
    })
    shouldShowSplash().then((show) => {
      if (active) setShowSplash(show)
    })
    const timer = setTimeout(() => {
      if (active) setMinElapsed(true)
    }, POPUP_SPLASH_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [])

  // Once-per-session gate (UX §7): only the first open of a browser session shows
  // the splash. While deciding (showSplash === null) the overlay stays up so content
  // never flashes; a non-first open reveals immediately; a first open holds until
  // settings load AND the brand beat plays.
  const revealed = showSplash === false || (showSplash === true && ready && minElapsed)

  const onDefaultChainChange = async (chain: Chain) => {
    setChain(chain)
    await setDefaultChain(chain)
  }

  return (
    <div className={`ap-root ${dark ? 'dark' : ''}`}>
      <div className="relative max-h-[600px] w-[360px] overflow-y-auto border-[1.5px] border-line bg-surface font-mono text-fg antialiased">
        <div className={revealed && showSplash ? 'motion-safe:animate-ap-fade-in' : undefined}>
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

          <footer className={FOOT}>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={BTN}>
              GitHub <ArrowOut />
            </a>
            <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className={BTN}>
              Report a Bug <ArrowOut />
            </a>
          </footer>

          <div className="border-t-[1.5px] border-line px-[13px] py-[10px] text-center">
            <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em] text-dim">
              <a
                href={PRIVACY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors duration-tm hover:text-fg"
              >
                Privacy
              </a>
              {REVIEW_URL ? (
                <>
                  <span aria-hidden="true">·</span>
                  <a
                    href={REVIEW_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors duration-tm hover:text-fg"
                  >
                    Rate it ★
                  </a>
                </>
              ) : null}
              <span aria-hidden="true">·</span>
              <a
                href={COINSTATS_PUBLIC_API_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors duration-tm hover:text-fg"
              >
                Powered by CoinStats Public API
              </a>
            </div>
            <p className="mt-1.5 text-[9px] leading-tight text-dim">
              Informational only — not financial advice.
            </p>
          </div>
        </div>
        {!revealed &&
          (showSplash ? <Splash /> : <div className="absolute inset-0 z-10 bg-surface" />)}
      </div>
    </div>
  )
}
