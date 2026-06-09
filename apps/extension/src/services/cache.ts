// Per-user IndexedDB cache. The background SW and the popup share it because they
// run on the same chrome-extension origin (UX edge case #6: two tabs share it).
import type { Chain, LookupResult } from '@alphapeek/shared'
import { type DBSchema, type IDBPDatabase, openDB } from 'idb'

export type CacheEntry = {
  key: string
  // Address lookups only; coin ($TICKER) entries are keyed by coinId and omit it.
  chain?: Chain
  addr: string
  result: LookupResult
  ts: number // Date.now() when stored
}

interface AlphaPeekDB extends DBSchema {
  lookups: {
    key: string
    value: CacheEntry
    indexes: { 'by-ts': number }
  }
}

const DB_NAME = 'alphapeek-cache'
const STORE = 'lookups'

// Background-side TTLs, slightly longer than the Worker's (SPEC §5). SPEC is
// silent on `unknown`; 1h is a deliberate middle ground — long enough to avoid
// re-burning ~45 credits on a dead address, short enough that a freshly funded
// wallet surfaces within the hour.
const TTL_MS: Record<LookupResult['kind'], number> = {
  token: 90 * 1000,
  wallet: 10 * 60 * 1000,
  unknown: 60 * 60 * 1000,
}

let dbPromise: Promise<IDBPDatabase<AlphaPeekDB>> | null = null

function db(): Promise<IDBPDatabase<AlphaPeekDB>> {
  if (!dbPromise) {
    dbPromise = openDB<AlphaPeekDB>(DB_NAME, 1, {
      upgrade(database) {
        const store = database.createObjectStore(STORE, { keyPath: 'key' })
        store.createIndex('by-ts', 'ts')
      },
    })
  }
  return dbPromise
}

function keyOf(chain: Chain, addr: string): string {
  return `${chain}:${addr.toLowerCase()}`
}

// $TICKER lookups are keyed by coinId, not chain+addr. Prefixed so they're easy to
// keep out of the address-shaped recent list (see recentLookups).
function coinKeyOf(coinId: string): string {
  return `coin:${coinId.toLowerCase()}`
}

// Read + TTL-evict by key. Dropping expired entries on read keeps the cache bounded
// and matches the privacy policy (no retention past TTL); we're about to hit the
// network anyway, so the extra IndexedDB delete adds no perceptible latency.
async function readEntry(key: string): Promise<LookupResult | null> {
  const entry = await (await db()).get(STORE, key)
  if (!entry) return null
  if (Date.now() - entry.ts > TTL_MS[entry.result.kind]) {
    await (await db()).delete(STORE, key)
    return null
  }
  return entry.result
}

export async function getCached(chain: Chain, addr: string): Promise<LookupResult | null> {
  return readEntry(keyOf(chain, addr))
}

export async function putCached(chain: Chain, addr: string, result: LookupResult): Promise<void> {
  const entry: CacheEntry = {
    key: keyOf(chain, addr),
    chain,
    addr: addr.toLowerCase(),
    result,
    ts: Date.now(),
  }
  await (await db()).put(STORE, entry)
}

export async function getCachedCoin(coinId: string): Promise<LookupResult | null> {
  return readEntry(coinKeyOf(coinId))
}

export async function putCachedCoin(coinId: string, result: LookupResult): Promise<void> {
  const entry: CacheEntry = {
    key: coinKeyOf(coinId),
    addr: coinId.toLowerCase(),
    result,
    ts: Date.now(),
  }
  await (await db()).put(STORE, entry)
}

// Newest-first; powers the popup's recent list. Ignores per-kind TTL, so prices
// shown here may be staler than a fresh lookup.
export async function recentLookups(limit = 5): Promise<CacheEntry[]> {
  // Walk the by-ts index in reverse and stop at `limit` so popup open stays O(limit)
  // instead of loading the entire (unbounded) cache into memory.
  const out: CacheEntry[] = []
  let cursor = await (await db()).transaction(STORE).store.index('by-ts').openCursor(null, 'prev')
  while (cursor && out.length < limit) {
    // Coin ($TICKER) entries are keyed by coinId, not an address — keep them out of the
    // address-shaped recent list.
    if (!cursor.value.key.startsWith('coin:')) out.push(cursor.value)
    cursor = await cursor.continue()
  }
  return out
}
