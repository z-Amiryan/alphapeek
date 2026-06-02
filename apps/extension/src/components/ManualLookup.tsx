// Popup manual lookup (UX §7): renders the same card body as the hover, via the
// background SW so it shares the cache.
import { type Chain, CHAIN_LABELS, SUPPORTED_CHAINS } from '@alphapeek/shared'
import { useState } from 'react'
import { isAddress } from '@/lib/regex'
import { requestLookup } from '@/services/messaging'
import { type LookupState, ResultView } from './ResultView'

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
      <label htmlFor="cl-addr" className="mb-1 block text-sm font-medium">
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
        placeholder="0x…"
        spellCheck={false}
        autoComplete="off"
        className="w-full rounded-lg border border-neutral-100 bg-neutral-50 px-2 py-1.5 font-mono text-sm text-neutral-900 outline-none focus:border-accent dark:border-surface-dark-100 dark:bg-surface-dark dark:text-neutral-50"
      />

      <div className="mt-2 flex items-center gap-2">
        <select
          aria-label="Chain"
          value={chain}
          onChange={(e) => setChain(e.target.value as Chain)}
          className="rounded-lg border border-neutral-100 bg-neutral-50 px-2 py-1.5 text-sm text-neutral-900 dark:border-surface-dark-100 dark:bg-surface-dark dark:text-neutral-50"
        >
          {SUPPORTED_CHAINS.map((c) => (
            <option key={c} value={c}>
              {CHAIN_LABELS[c]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void run()}
          disabled={state.status === 'loading'}
          className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Look up
        </button>
      </div>

      {state.status !== 'idle' ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-neutral-100 dark:border-surface-dark-100">
          <ResultView state={state} addr={normalized} chain={chain} onRetry={() => void run()} />
        </div>
      ) : null}
    </div>
  )
}
