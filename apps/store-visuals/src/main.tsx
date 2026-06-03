import { createRoot } from 'react-dom/client'
import { Gallery } from './gallery'
import './store.css'

// Optional export helper mirroring the design bundle's __solo: isolate one asset
// at exact px so a capture tool (or Chrome DevTools "capture node screenshot")
// produces a Web-Store-ready PNG. Call e.g. window.__solo('shot-wallet', 1280, 800).
declare global {
  interface Window {
    __solo: (id: string, w: number, h: number) => void
    __all: () => void
  }
}

window.__solo = (id, w, h) => {
  for (const el of document.querySelectorAll<HTMLElement>('.asset-wrap')) {
    el.style.display = el.dataset.id === id ? 'block' : 'none'
  }
  const wrap = document.querySelector<HTMLElement>(`.asset-wrap[data-id="${id}"]`)
  const label = wrap?.querySelector<HTMLElement>('.asset-label')
  if (label) label.style.display = 'none'
  const gallery = document.querySelector<HTMLElement>('.gallery')
  if (gallery)
    Object.assign(gallery.style, { padding: '0', gap: '0', display: 'block', width: `${w}px` })
  Object.assign(document.body.style, {
    margin: '0',
    background: '#0d0d0d',
    width: `${w}px`,
    height: `${h}px`,
    overflow: 'hidden',
  })
  Object.assign(document.documentElement.style, {
    width: `${w}px`,
    height: `${h}px`,
    overflow: 'hidden',
  })
  window.scrollTo(0, 0)
}
window.__all = () => location.reload()

const root = document.getElementById('root')
if (root) createRoot(root).render(<Gallery />)
