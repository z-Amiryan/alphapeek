/**
 * Generates the extension's PNG icons (16/48/128) into `src/public/` with no
 * external dependencies — just Node's built-in `zlib`. Chrome's toolbar needs
 * raster icons, so we render the brand mark (a lime data-card on an ink field
 * with an ink stepped-sparkline glyph) directly to RGBA pixels and encode a PNG
 * by hand.
 *
 * The 48/128 icons render the full offset two-card motif; the 16px badge uses a
 * simplified single-card variant (the offset + 6-step sparkline turn to mush at
 * that size). Run: `node scripts/make-icons.mjs` (or `pnpm icons`).
 * AGENT: keep the full motif in sync with src/public/icon.svg, the human-editable
 * source.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'src', 'public')

const LIME = [0xc6, 0xf4, 0x32] // #c6f432
const INK = [0x0d, 0x0d, 0x0d] // #0d0d0d
// 32 is the retina (2×) toolbar size — without it Chrome scales the 48px full
// motif down to the badge slot, undoing the simplified variant on 2× displays.
const SIZES = [16, 32, 48, 128]

// Full motif (48/128) — offset "data card" + inner stepped sparkline, in the
// icon.svg 40-unit space. On the ink field: a lime-outlined card peeks out
// behind a solid lime front-card; an ink sparkline lives inside the front-card.
// Keep these in sync with icon.svg.
const BACK_CARD = { x: 13, y: 13, w: 20, h: 20 }
const FRONT_CARD = { x: 7, y: 7, w: 20, h: 20 }
const CARD_STROKE = 2.2
const GLYPH_PTS = [
  [10.5, 21],
  [14, 21],
  [14, 16.5],
  [17.5, 16.5],
  [17.5, 18.5],
  [21, 18.5],
  [21, 12.5],
]
const GLYPH_STROKE = 2

// Simplified badge variant (≤32px) — a single centered lime card (no offset)
// with a bolder 2-step sparkline. The full motif's offset edge and 6-step glyph
// collapse to noise at badge size, so we trade detail for legibility.
const MINI_CARD = { x: 9, y: 9, w: 22, h: 22 }
const MINI_GLYPH_PTS = [
  [13, 26],
  [18, 19],
  [22, 23],
  [27, 14],
]
const MINI_GLYPH_STROKE = 2.6

/** CRC32 (PNG chunk checksum). */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

function inRect(cx, cy, r, k) {
  return cx >= r.x * k && cx <= (r.x + r.w) * k && cy >= r.y * k && cy <= (r.y + r.h) * k
}

/** Distance from a point to a rectangle's outline (its 4 edge segments). */
function distToRectOutline(cx, cy, r, k) {
  const x1 = r.x * k
  const y1 = r.y * k
  const x2 = (r.x + r.w) * k
  const y2 = (r.y + r.h) * k
  return Math.min(
    distToSegment(cx, cy, x1, y1, x2, y1),
    distToSegment(cx, cy, x2, y1, x2, y2),
    distToSegment(cx, cy, x2, y2, x1, y2),
    distToSegment(cx, cy, x1, y2, x1, y1),
  )
}

function renderPixels(size) {
  const s = size
  const px = new Uint8Array(s * s * 4) // RGBA
  const k = s / 40 // design units → pixels
  const mini = size <= 32
  const card = mini ? MINI_CARD : FRONT_CARD
  const glyphHalf = ((mini ? MINI_GLYPH_STROKE : GLYPH_STROKE) * k) / 2
  const cardHalf = (CARD_STROKE * k) / 2
  const pts = (mini ? MINI_GLYPH_PTS : GLYPH_PTS).map(([x, y]) => [x * k, y * k])

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4
      const cx = x + 0.5
      const cy = y + 0.5

      // Paint order mirrors the SVG: ink field → lime back-card outline (full
      // motif only) → solid lime front-card face (covers the back-card overlap)
      // → ink sparkline.
      let rgb = INK
      if (!mini && distToRectOutline(cx, cy, BACK_CARD, k) <= cardHalf) rgb = LIME
      if (inRect(cx, cy, card, k)) rgb = LIME
      for (let seg = 0; seg < pts.length - 1; seg++) {
        const d = distToSegment(cx, cy, pts[seg][0], pts[seg][1], pts[seg + 1][0], pts[seg + 1][1])
        if (d <= glyphHalf) {
          rgb = INK
          break
        }
      }

      px[i] = rgb[0]
      px[i + 1] = rgb[1]
      px[i + 2] = rgb[2]
      px[i + 3] = 255
    }
  }
  return px
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}

function encodePng(size, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  // Add a filter byte (0 = none) at the start of every scanline.
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    Buffer.from(pixels.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }
  const idat = deflateSync(raw)

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUT_DIR, { recursive: true })
for (const size of SIZES) {
  const png = encodePng(size, renderPixels(size))
  const file = join(OUT_DIR, `icon-${size}.png`)
  writeFileSync(file, png)
  console.info(`wrote ${file} (${png.length} bytes)`)
}
