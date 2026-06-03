// Popup manual lookup (UX §7): renders the same card body as the hover, via the
// background SW so it shares the cache.
import type { Chain } from '@alphapeek/shared'
import { useState } from 'react'
import { isAddress } from '@/lib/regex'
import { requestLookup } from '@/services/messaging'
import { ChainSelect } from './ChainSelect'
import { type LookupState, ResultView } from './ResultView'
import { BTN_SOLID, LABEL } from './ui'

type Props = {
  defaultChain: Chain
  onLookupComplete: () => void
}

export function ManualLookup({ defaultChain, onLookupComplete }: Props) {
  const [addr, setAddr] = useState('')
  const [chain, setChain] = useState<Chain>(defaultChain)
  const [state, setState] = useState<LookupState>({ status: 'idle' })

  const normalized = addr.trim().toLowerCase()

  const run = async () => {
    if (!isAddress(normalized)) {
      setState({ status: 'error', code: 'invalid_address' })
      return
    }
    setState({ status: 'loading' })
    const res = await requestLookup(normalized, chain)
    setState(res.ok ? { status: 'ready', result: res.data } : { status: 'error', code: res.error })
    if (res.ok) onLookupComplete()
  }

  return (
    <div>
      <label htmlFor="cl-addr" className={`mb-2 ${LABEL}`}>
        Look up an address
      </label>
      <input
        id="cl-addr"
        type="text"
        value={addr}
        onChange={(e) => setAddr(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void run()
        }}
        placeholder="0x… or token contract"
        spellCheck={false}
        autoComplete="off"
        className="h-[38px] w-full border-[1.5px] border-line bg-bg px-[11px] text-[13px] font-bold text-fg outline-none transition-colors duration-tm placeholder:font-normal placeholder:text-dim focus:border-acc"
      />

      <div className="mt-2 flex gap-2">
        <ChainSelect ariaLabel="Chain" value={chain} onChange={setChain} />
        <button
          type="button"
          onClick={() => void run()}
          disabled={state.status === 'loading'}
          className={`${BTN_SOLID} h-[38px] py-0 disabled:opacity-50`}
        >
          Look Up
        </button>
      </div>

      {state.status !== 'idle' ? (
        <div className="mt-3 border-[1.5px] border-line bg-surface">
          <ResultView state={state} addr={normalized} chain={chain} onRetry={() => void run()} />
        </div>
      ) : null}
    </div>
  )
}
