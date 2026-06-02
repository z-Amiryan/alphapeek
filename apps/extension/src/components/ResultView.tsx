// Single source for the card body (idle/loading/token/wallet/unknown/error) with
// no positioning. HoverCard wraps it with Floating UI; the popup reuses it directly.
import type { Chain, LookupErrorCode, LookupResult } from '@alphapeek/shared'
import { ErrorView } from './ErrorView'
import { LoadingView } from './LoadingView'
import { TokenView } from './TokenView'
import { UnknownView } from './UnknownView'
import { WalletView } from './WalletView'

export type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: LookupResult }
  | { status: 'error'; code: LookupErrorCode }

type Props = {
  state: LookupState
  addr: string
  chain: Chain
  onRetry?: () => void
}

export function ResultView({ state, addr, chain, onRetry }: Props) {
  if (state.status === 'idle') return null
  if (state.status === 'loading') return <LoadingView />
  if (state.status === 'error') return <ErrorView code={state.code} onRetry={onRetry} />

  const { result } = state
  if (result.kind === 'token') return <TokenView token={result.data} chain={chain} addr={addr} />
  if (result.kind === 'wallet') return <WalletView wallet={result.data} />
  return <UnknownView addr={addr} chain={chain} />
}
