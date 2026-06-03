/**
 * Generates the extension's PNG icons (16/48/128) into `public/` with no
 * external dependencies — just Node's built-in `zlib`. Chrome's toolbar needs
 * raster icons, so we render the brand mark (electric-lime tile + an ink
 * stepped-sparkline glyph) directly to RGBA pixels and encode a PNG by hand.
 *
 * Run: `node scripts/make-icons.mjs` (or `pnpm icons`).
 * AGENT: keep this in sync with public/icon.svg, the human-editable source.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'public')

const LIME = [0xc6, 0xf4, 0x32] // #c6f432
const INK = [0x0d, 0x0d, 0x0d] // #0d0d0d
const SIZES = [16, 48, 128]

// Stepped-sparkline polyline + trailing pixel, in the icon.svg 40-unit space.
const GLYPH_PTS = [
  [7, 25],
  [13, 25],
  [13, 19],
  [19, 19],
  [19, 22],
  [25, 22],
  [25, 13],
  [33, 13],
]
const GLYPH_STROKE = 2.6
const GLYPH_PIXEL = { x: 31.5, y: 11.5, size: 3.4 }

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

function renderPixels(size) {
  const s = size
  const px = new Uint8Array(s * s * 4) // RGBA
  const k = s / 40 // design units → pixels
  const halfW = (GLYPH_STROKE * k) / 2
  const pts = GLYPH_PTS.map(([x, y]) => [x * k, y * k])
  const sqX1 = GLYPH_PIXEL.x * k
  const sqY1 = GLYPH_PIXEL.y * k
  const sqX2 = (GLYPH_PIXEL.x + GLYPH_PIXEL.size) * k
  const sqY2 = (GLYPH_PIXEL.y + GLYPH_PIXEL.size) * k

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4
      // Lime tile fills the whole canvas (hard square — no radius).
      px[i] = LIME[0]
      px[i + 1] = LIME[1]
      px[i + 2] = LIME[2]
      px[i + 3] = 255

      const cx = x + 0.5
      const cy = y + 0.5
      let ink = cx >= sqX1 && cx <= sqX2 && cy >= sqY1 && cy <= sqY2
      for (let seg = 0; seg < pts.length - 1 && !ink; seg++) {
        const d = distToSegment(cx, cy, pts[seg][0], pts[seg][1], pts[seg + 1][0], pts[seg + 1][1])
        if (d <= halfW) ink = true
      }
      if (ink) {
        px[i] = INK[0]
        px[i + 1] = INK[1]
        px[i + 2] = INK[2]
      }
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
