// Compact skeleton shown while the lookup fires (UX §3A). No looping motion; the
// caret blink is gated behind motion-safe so it honors reduced-motion.
export function LoadingView() {
  return (
    <div className="p-[13px]">
      <div className="flex items-center gap-2">
        <span className="h-[13px] w-[13px] shrink-0 bg-acc" />
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-dim">
          Querying chain
        </span>
        <span className="ml-px inline-block h-[13px] w-2 -translate-y-px bg-acc motion-safe:animate-ap-blink" />
      </div>
      <div className="mt-[12px] flex gap-0.5">
        <span className="block h-[13px] w-[88px] bg-line" />
        <span className="ml-auto block h-[13px] w-[52px] bg-line" />
      </div>
      <span className="mt-[12px] block h-[36px] w-full bg-line" />
    </div>
  )
}
