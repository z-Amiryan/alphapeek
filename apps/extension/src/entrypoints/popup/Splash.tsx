import { LogoMark } from '@/components/icons'

// Brief branded loading overlay shown on popup open (UX §7). Rendered as an opaque
// layer on top of the already-mounted popup content, so the window is sized from
// first paint and the data underneath loads while the splash is up. The brand mark
// draws in; reduced-motion users get the finished mark and a still caret.
export function Splash() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 overflow-hidden bg-surface">
      <div
        className="ap-grid-bg pointer-events-none absolute inset-0 opacity-[0.06]"
        aria-hidden="true"
      />
      <LogoMark animated className="relative h-[56px] w-[56px]" />
      <span className="relative text-[26px] font-bold tracking-[0.04em]">ALPHAPEEK</span>
      <div className="relative flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-dim">
        <span>Initializing</span>
        <span className="ml-px inline-block h-[12px] w-1.5 bg-acc motion-safe:animate-ap-blink" />
      </div>
    </div>
  )
}
