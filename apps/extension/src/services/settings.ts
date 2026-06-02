// v0.1's only setting: the default chain used when keyword inference finds
// nothing. Persisted in chrome.storage.local, shared across tabs.
import { type Chain, DEFAULT_CHAIN, isChain } from '@alphapeek/shared'
import { browser } from 'wxt/browser'

// Exported so storage.onChanged listeners can match it.
export const DEFAULT_CHAIN_KEY = 'defaultChain'

export async function getDefaultChain(): Promise<Chain> {
  try {
    const stored = await browser.storage.local.get(DEFAULT_CHAIN_KEY)
    const value = stored[DEFAULT_CHAIN_KEY]
    return typeof value === 'string' && isChain(value) ? value : DEFAULT_CHAIN
  } catch {
    // Storage can throw if the context is torn down mid-read; fall back safely.
    return DEFAULT_CHAIN
  }
}

export async function setDefaultChain(chain: Chain): Promise<void> {
  await browser.storage.local.set({ [DEFAULT_CHAIN_KEY]: chain })
}
