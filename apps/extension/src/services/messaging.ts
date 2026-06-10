// Content script / popup → background SW. The background is the single owner of
// the cache + Worker client, so all data requests funnel through here (SPEC §1).
import type { Chain, FearGreedResponse, LookupResponse } from '@alphapeek/shared'
import { browser } from 'wxt/browser'
import { debugError } from '@/lib/debug'

export async function requestLookup(addr: string, chain: Chain): Promise<LookupResponse> {
  try {
    const res = await browser.runtime.sendMessage({ type: 'LOOKUP', addr, chain })
    return res as LookupResponse
  } catch (err) {
    debugError('LOOKUP message failed', err)
    return { ok: false, error: 'upstream_error' }
  }
}

export async function requestCoinLookup(coinId: string): Promise<LookupResponse> {
  try {
    const res = await browser.runtime.sendMessage({ type: 'COIN_LOOKUP', coinId })
    return res as LookupResponse
  } catch (err) {
    debugError('COIN_LOOKUP message failed', err)
    return { ok: false, error: 'upstream_error' }
  }
}

export async function requestSymbolLookup(symbol: string): Promise<LookupResponse> {
  try {
    const res = await browser.runtime.sendMessage({ type: 'SYMBOL_LOOKUP', symbol })
    return res as LookupResponse
  } catch (err) {
    debugError('SYMBOL_LOOKUP message failed', err)
    return { ok: false, error: 'upstream_error' }
  }
}

export async function requestSolLookup(mint: string): Promise<LookupResponse> {
  try {
    const res = await browser.runtime.sendMessage({ type: 'SOL_LOOKUP', mint })
    return res as LookupResponse
  } catch (err) {
    debugError('SOL_LOOKUP message failed', err)
    return { ok: false, error: 'upstream_error' }
  }
}

export async function requestFearGreed(): Promise<FearGreedResponse> {
  try {
    const res = await browser.runtime.sendMessage({ type: 'FEAR_GREED' })
    return res as FearGreedResponse
  } catch (err) {
    debugError('FEAR_GREED message failed', err)
    return { ok: false, error: 'upstream_error' }
  }
}
