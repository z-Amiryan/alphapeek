// Mirrors wrangler.toml. The API key is a `wrangler secret put` secret and must
// never appear in code, logs, or committed files.
export type Env = {
  CACHE: KVNamespace
  RATELIMIT: KVNamespace
  DAILY_CAP: string
  COINSTATS_BASE_URL: string
  COINSTATS_API_KEY: string
}

// Surfaced at /health; bump on each deploy.
export const WORKER_VERSION = 'v2026.05.29'
