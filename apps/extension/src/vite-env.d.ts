/// <reference types="vite/client" />

// Optional because a dev build may run before `.env` exists; consumers must default.
interface ImportMetaEnv {
  readonly VITE_WORKER_URL?: string
}
