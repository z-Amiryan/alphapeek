import type { ReactNode } from 'react'
import { TokenView } from '@/components/TokenView'
import { CARD } from '@/components/ui'
import { WalletView } from '@/components/WalletView'
import { TOKEN, WALLET } from './data'

// The hover card in production is TokenView/WalletView wrapped by HoverCard in a
// `.ap-root` themed shell + the CARD shadow box. We reproduce that shell here so
// the store assets render the REAL components, not a mock.
function Card({ dark = true, children }: { dark?: boolean; children: ReactNode }) {
  return (
    <div className={`ap-root ${dark ? 'dark' : ''}`}>
      <div className={CARD}>{children}</div>
    </div>
  )
}

// ---- brand lockup ---------------------------------------------------------
function LogoMark({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const px = size === 'lg' ? 72 : 40
  return (
    <span className={`logo-mark ${size === 'lg' ? 'lm-lg' : 'lm-sm'}`}>
      <svg viewBox="0 0 40 40" width={px} height={px} aria-hidden="true">
        <path
          d="M7 25 H13 V19 H19 V22 H25 V13 H33"
          fill="none"
          stroke="#0d0d0d"
          strokeWidth="2.6"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        <rect x="31.5" y="11.5" width="3.4" height="3.4" fill="#0d0d0d" />
      </svg>
    </span>
  )
}

function Puzzle() {
  return (
    <svg className="puzzle" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M10 3a2 2 0 0 1 4 0v1h3a1 1 0 0 1 1 1v3h1a2 2 0 0 1 0 4h-1v3a1 1 0 0 1-1 1h-3v1a2 2 0 0 1-4 0v-1H7a1 1 0 0 1-1-1v-3H5a2 2 0 0 1 0-4h1V5a1 1 0 0 1 1-1h3V3z" />
    </svg>
  )
}

function Eng() {
  return (
    <div className="sc-eng">
      <span>
        <i className="sc-ic" />
        128
      </span>
      <span>
        <i className="sc-ic sq" />
        2.4K
      </span>
      <span>
        <i className="sc-ic" />
        19K
      </span>
    </div>
  )
}

function Browser({
  w,
  h,
  url = 'x.com/home',
  live,
  children,
}: {
  w: number
  h: number
  url?: string
  live?: boolean
  children: ReactNode
}) {
  return (
    <div className="bw" style={{ width: w }}>
      <div className="bw-bar">
        <div className="bw-dots">
          <span className="bw-dot" />
          <span className="bw-dot" />
          <span className="bw-dot" />
        </div>
        <div className="bw-url">
          <span className="lock" />
          {url}
        </div>
        <div className="bw-actions">
          <div className="bw-ext">
            <Puzzle />
          </div>
          <div className={`bw-ext${live ? ' live' : ''}`}>
            <span className="bw-ext-mark" />
          </div>
        </div>
      </div>
      <div className="bw-body" style={{ height: h }}>
        {children}
      </div>
    </div>
  )
}

type Tweet = {
  name: string
  handle: string
  pre: string
  addr: string
  post: string
  name2: string
  handle2: string
  tx2: string
}

const FILLER: { name: string; handle: string; tx: string; op: number }[] = [
  {
    name: 'degen jane',
    handle: '@degenjane',
    tx: 'new pair just deployed — small bag, high conviction. dyor.',
    op: 0.32,
  },
  {
    name: 'vault notes',
    handle: '@vaultnotes',
    tx: 'rotation out of memes into majors continuing into the weekend.',
    op: 0.2,
  },
  {
    name: 'alpha leaks',
    handle: '@alphaleaks',
    tx: 'watching three wallets accumulate the same low-cap since monday.',
    op: 0.12,
  },
]

// A faint lime connector from the cued address to the card's top-left corner —
// this is the actual hover relationship the extension draws attention to.
function Connector({ from, to }: { from: [number, number]; to: [number, number] }) {
  const [fx, fy] = from
  const [tx, ty] = to
  const midX = (fx + tx) / 2
  return (
    <svg className="sc-link" viewBox="0 0 1040 560" preserveAspectRatio="none">
      <title>hover connector</title>
      <path
        d={`M${fx},${fy} C${midX},${fy} ${midX},${ty} ${tx},${ty}`}
        fill="none"
        stroke="#c6f432"
        strokeWidth="1.5"
        strokeDasharray="5 5"
        opacity="0.6"
      />
      <circle cx={tx} cy={ty} r="3.5" fill="#c6f432" />
    </svg>
  )
}

function Scene({
  tweet,
  light,
  dim,
  card,
  cardPos,
  connector,
}: {
  tweet: Tweet
  light?: boolean
  dim?: boolean
  card?: ReactNode
  cardPos?: { left: number; top: number }
  connector?: { from: [number, number]; to: [number, number] }
}) {
  return (
    <div className={`sc${light ? ' light' : ''}`}>
      <div className="sc-tabs">
        <div className="sc-tab on">For you</div>
        <div className="sc-tab">Following</div>
      </div>
      <div className="sc-tweet">
        <div className="sc-av" />
        <div className="sc-bd">
          <div className="sc-nr">
            <span className="sc-nm">{tweet.name}</span>
            <span className="sc-hd">{tweet.handle} · 2h</span>
          </div>
          <div className="sc-tx">
            {tweet.pre}
            <span className={`sc-addr${connector ? ' cued' : ''}`}>{tweet.addr}</span>
            {tweet.post}
          </div>
          <Eng />
        </div>
      </div>
      <div className="sc-tweet" style={{ opacity: 0.5 }}>
        <div className="sc-av" />
        <div className="sc-bd">
          <div className="sc-nr">
            <span className="sc-nm">{tweet.name2}</span>
            <span className="sc-hd">{tweet.handle2} · 5h</span>
          </div>
          <div className="sc-tx">{tweet.tx2}</div>
          <Eng />
        </div>
      </div>
      {FILLER.map((f) => (
        <div className="sc-tweet" key={f.handle} style={{ opacity: f.op }}>
          <div className="sc-av" />
          <div className="sc-bd">
            <div className="sc-nr">
              <span className="sc-nm">{f.name}</span>
              <span className="sc-hd">{f.handle} · 9h</span>
            </div>
            <div className="sc-tx">{f.tx}</div>
            <Eng />
          </div>
        </div>
      ))}
      {dim ? <div className="sc-dim" /> : null}
      {connector ? <Connector from={connector.from} to={connector.to} /> : null}
      {card && cardPos ? (
        <div className="sc-card" style={{ left: cardPos.left, top: cardPos.top }}>
          {card}
        </div>
      ) : null}
    </div>
  )
}

function Shot({
  id,
  w,
  h,
  label,
  l1,
  l2,
  sub,
  children,
}: {
  id: string
  w: number
  h: number
  label: string
  l1: string
  l2: string
  sub: string
  children: ReactNode
}) {
  return (
    <div className="asset-wrap" data-id={id}>
      <div className="asset-label">
        {label} ·{' '}
        <b>
          {w}×{h}
        </b>
      </div>
      <div className="asset shot bg-ink" id={id} style={{ width: w, height: h }}>
        <div className="shot-cap">
          <span className="shot-cap-mark" />
          <div>
            <h2 className="shot-h">
              {l1} <span className="em">{l2}</span>
            </h2>
            <p className="shot-sub">{sub}</p>
          </div>
        </div>
        <div className="shot-stage">{children}</div>
      </div>
    </div>
  )
}

// Stepped sparkline for the chart feature panel (shot 3), matching the design.
function featPath(w: number, h: number): string {
  const pts = [
    0.42, 0.4, 0.46, 0.44, 0.52, 0.49, 0.58, 0.55, 0.62, 0.7, 0.66, 0.74, 0.82, 0.78, 0.9,
  ]
  const lo = Math.min(...pts)
  const hi = Math.max(...pts)
  const range = hi - lo || 1
  const x = (i: number) => 4 + (i / (pts.length - 1)) * (w - 8)
  const y = (p: number) => 4 + (1 - (p - lo) / range) * (h - 8)
  const first = pts[0] ?? lo
  let d = `M${x(0).toFixed(1)},${y(first).toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    d += ` H${x(i).toFixed(1)} V${y(pts[i] ?? lo).toFixed(1)}`
  }
  return d
}

const TWEET_TOKEN: Tweet = {
  name: 'frog dealer',
  handle: '@frogdoteth',
  pre: 'aping the new meta. ca: ',
  addr: '0x6982…1933',
  post: ' — send it',
  name2: 'gm capital',
  handle2: '@gmcapital',
  tx2: 'liquidity looking healthy across majors this week. staying long.',
}

const TWEET_WALLET: Tweet = {
  name: 'Bankr',
  handle: '@bankrbot',
  pre: 'whale alert — this wallet just moved size: ',
  addr: '0xce37…7d93',
  post: '',
  name2: 'onchain lens',
  handle2: '@onchainlens',
  tx2: 'tracking smart money rotations into L2 ecosystems.',
}

export function Gallery() {
  return (
    <div className="gallery">
      {/* 1 — WALLET BALANCE (light mode, shows first-class light theme) */}
      <Shot
        id="shot-wallet"
        w={1280}
        h={800}
        label="Screenshot 1"
        l1="Hover any wallet —"
        l2="see its balance"
        sub="Point at any address on X and AlphaPeek surfaces its total balance, allocation, and top holdings — without leaving the timeline."
      >
        <Browser w={1040} h={560} url="x.com/home" live>
          <Scene
            tweet={TWEET_WALLET}
            light
            card={
              <Card dark={false}>
                <WalletView wallet={WALLET} />
              </Card>
            }
            cardPos={{ left: 470, top: 150 }}
            connector={{ from: [372, 122], to: [470, 158] }}
          />
        </Browser>
      </Shot>

      {/* 2 — SPOT THE TOKEN (dark) */}
      <Shot
        id="shot-token"
        w={1280}
        h={800}
        label="Screenshot 2"
        l1="Spot the token"
        l2="instantly"
        sub="Every contract address becomes a live quote — symbol, price, 24-hour move, market cap and volume — read it at a glance."
      >
        <Browser w={1040} h={560} url="x.com/home" live>
          <Scene
            tweet={TWEET_TOKEN}
            card={
              <Card>
                <TokenView token={TOKEN} chain="base" addr={WALLET.address} />
              </Card>
            }
            cardPos={{ left: 360, top: 150 }}
            connector={{ from: [232, 122], to: [360, 158] }}
          />
        </Browser>
      </Shot>

      {/* 3 — 7-DAY PRICE */}
      <Shot
        id="shot-chart"
        w={1280}
        h={800}
        label="Screenshot 3"
        l1="7-day price"
        l2="at a glance"
        sub="A clean stepped sparkline rides inside every token card — the week's trend, no chart app required."
      >
        <div className="feat">
          <Card>
            <TokenView token={TOKEN} chain="base" addr={WALLET.address} />
          </Card>
          <div className="feat-chart">
            <div className="feat-chart-hd">
              <span className="m" />
              <span className="t">PEPE / USD</span>
              <span className="p">PAST 7D</span>
            </div>
            <div className="feat-chart-body">
              <svg viewBox="0 0 332 132" preserveAspectRatio="none">
                <title>7-day price</title>
                <path d={featPath(332, 132)} fill="none" stroke="#c6f432" strokeWidth="2" />
              </svg>
              <div className="feat-chart-ax">
                <span>
                  LOW <b>$0.0₅21</b>
                </span>
                <span>
                  HIGH <b>$0.0₅26</b>
                </span>
              </div>
            </div>
          </div>
        </div>
      </Shot>

      {/* 4 — FEAR & GREED popup */}
      <Shot
        id="shot-fng"
        w={1280}
        h={800}
        label="Screenshot 4"
        l1="Fear & Greed,"
        l2="in one click"
        sub="Open the toolbar popup for the live market mood index, a quick address lookup, and your recent peeks."
      >
        <Browser w={1040} h={560} url="x.com/home" live>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Scene tweet={TWEET_TOKEN} dim />
            <div
              className="sc-pop"
              style={{ right: 16, top: 8, transform: 'scale(0.92)', transformOrigin: 'top right' }}
            >
              <PopupMock />
            </div>
          </div>
        </Browser>
      </Shot>

      {/* 5 — PROMO TILE */}
      <div className="asset-wrap" data-id="tile">
        <div className="asset-label">
          Small promo tile · <b>440×280</b>
        </div>
        <div className="asset tile bg-ink" id="tile">
          <div className="logo">
            <LogoMark size="sm" />
            <span className="logo-word">ALPHAPEEK</span>
          </div>
          <div className="tile-rule" />
          <p className="tagline">
            Peek any wallet or token,
            <br />
            <span className="em">right on X.</span>
          </p>
        </div>
      </div>

      {/* 6 — MARQUEE (cards axis-aligned with offset shadows) */}
      <div className="asset-wrap" data-id="marquee">
        <div className="asset-label">
          Marquee promo tile · <b>1400×560</b>
        </div>
        <div className="asset marquee bg-ink" id="marquee">
          <div className="mq-left">
            <div className="logo">
              <LogoMark size="lg" />
              <span className="logo-word lg">ALPHAPEEK</span>
            </div>
            <div className="mq-rule" />
            <p className="tagline lg">
              Peek any wallet or token, <span className="em">right on X.</span>
            </p>
            <span className="mq-badge">Hover · Peek · Done</span>
          </div>
          <div className="mq-right">
            <div style={{ position: 'absolute', left: 30, top: 40 }}>
              <Card>
                <TokenView token={TOKEN} chain="base" addr={WALLET.address} />
              </Card>
            </div>
            <div style={{ position: 'absolute', right: 0, top: 168 }}>
              <Card>
                <WalletView wallet={WALLET} />
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Faithful static recreation of the popup for the store shot. The real popup
// (FearGreedBadge) is coupled to chrome.runtime messaging, so we mirror its
// markup here rather than mounting the live component.
function PopupMock() {
  const value = 30
  const on = Math.round((value / 100) * 20)
  return (
    <div className="ap-root dark">
      <div className="w-[360px] overflow-hidden border-[1.5px] border-line bg-surface font-mono text-fg antialiased shadow-tm">
        <header className="flex items-center gap-[9px] border-b-[1.5px] border-line p-[13px]">
          <LogoMark size="sm" />
          <span className="text-[16px] font-bold tracking-[0.02em]">ALPHAPEEK</span>
          <span className="ml-auto text-[10px] font-bold tracking-[0.08em] text-dim">v0.1</span>
        </header>

        <section className="border-b-[1.5px] border-line p-[13px]">
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-dim">
            Market Mood
          </div>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-[20px] font-bold tabular-nums">{value}</span>
            <span className="text-[12px] font-bold uppercase tracking-[0.06em]">Fear</span>
          </div>
          <div className="mt-[10px] flex h-[14px] gap-0.5">
            {Array.from({ length: 20 }).map((_, i) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length gauge mirror; segments have no identity beyond position
                key={i}
                className={`flex-1 border-[1.5px] ${i < on ? 'border-acc bg-acc' : 'border-line'}`}
              />
            ))}
          </div>
        </section>

        <section className="border-b-[1.5px] border-line p-[13px]">
          <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-dim">
            Look Up Address
          </span>
          <div className="mt-2 flex gap-1.5">
            <input
              readOnly
              value="0xce37…7d93"
              className="min-w-0 flex-1 border-[1.5px] border-line bg-bg px-2 py-[11px] text-[12px] tabular-nums text-fg"
            />
            <button
              type="button"
              className="flex h-[38px] items-center justify-center bg-acc px-3 text-[11px] font-bold uppercase tracking-[0.06em] text-acc-ink"
            >
              Look Up
            </button>
          </div>
        </section>

        <section className="border-b-[1.5px] border-line p-[13px]">
          <span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-dim">
            Recent Lookups
          </span>
          <div className="flex justify-between py-[6px] text-[12px]">
            <span className="font-bold">PEPE</span>
            <span className="tabular-nums text-dim">$0.0₅31</span>
          </div>
          <div className="flex justify-between border-t border-line py-[6px] text-[12px]">
            <span className="tabular-nums font-bold">0xce37…7d93</span>
            <span className="tabular-nums text-dim">$48.2M</span>
          </div>
        </section>

        <footer className="flex border-t-[1.5px] border-line">
          <span className="flex-1 px-1.5 py-[11px] text-center text-[11px] font-bold uppercase tracking-[0.06em] text-fg">
            GitHub
          </span>
          <span className="flex-1 border-l-[1.5px] border-line px-1.5 py-[11px] text-center text-[11px] font-bold uppercase tracking-[0.06em] text-fg">
            Report a Bug
          </span>
        </footer>
      </div>
    </div>
  )
}
