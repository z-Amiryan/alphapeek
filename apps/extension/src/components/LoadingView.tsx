import { Loader2 } from 'lucide-react'

export function LoadingView() {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-6 text-neutral-500">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span className="text-sm">Loading…</span>
    </div>
  )
}
