// Background SW: the single owner of the cache + Worker client (SPEC §1, §5).
// Content script and popup send LOOKUP / FEAR_GREED messages and get a typed
// RuntimeResponse back; they never touch the network or the CoinStats key.
import type {
  Chain,
  FearGreed,
  LookupResult,
  RuntimeRequest,
  RuntimeResponse,
} from '@alphapeek/shared'
import { browser } from 'wxt/browser'
import { debug, debugError } from '@/lib/debug'
import { getCached, putCached } from '@/services/cache'
import { fearGreed, lookup } from '@/services/worker-client'

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handle(message as RuntimeRequest)
      .then(sendResponse)
      .catch((err) => {
        debugError('background message handler failed', err)
        sendResponse({ ok: false, error: 'upstream_error' })
      })
    // Returning true keeps the message channel open for the async sendResponse.
    return true
  })
})

async function handle(
  req: RuntimeRequest,
): Promise<RuntimeResponse<LookupResult> | RuntimeResponse<FearGreed>> {
  switch (req.type) {
    case 'LOOKUP':
      return handleLookup(req.addr, req.chain)
    case 'FEAR_GREED':
      return fearGreed()
    default:
      return { ok: false, error: 'upstream_error' }
  }
}

async function handleLookup(addr: string, chain: Chain): Promise<RuntimeResponse<LookupResult>> {
  const hit = await getCached(chain, addr)
  if (hit) {
    debug('cache hit', chain, addr, hit.kind)
    return { ok: true, data: hit }
  }

  const res = await lookup(addr, chain)
  if (res.ok) {
    await putCached(chain, addr, res.data)
  }
  return res
}
