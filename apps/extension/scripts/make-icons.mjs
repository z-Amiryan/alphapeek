/**
 * Generates the extension's PNG icons (16/48/128) into `public/` with no
 * external dependencies — just Node's built-in `zlib`. Chrome's toolbar needs
 * raster icons, so we render the brand mark (indigo rounded tile + a white
 * magnifier "lens") directly to RGBA pixels and encode a PNG by hand.
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

const ACCENT = [0x63, 0x66, 0xf1] // #6366F1
const WHITE = [0xff, 0xff, 0xff]
const SIZES = [16, 48, 128]

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

/** Alpha-blend `src` (with alpha 0-1) over `dst` in place. */
function blend(dst, i, src, alpha) {
  for (let c = 0; c < 3; c++) {
    dst[i + c] = Math.round(src[c] * alpha + dst[i + c] * (1 - alpha))
  }
  dst[i + 3] = 255
}

function renderPixels(size) {
  const s = size
  const px = new Uint8Array(s * s * 4) // RGBA, transparent by default
  const radius = s * 0.22
  const cx = s * 0.42
  const cy = s * 0.42
  const ringR = s * 0.2
  const ringW = s * 0.065
  const dotR = s * 0.07
  // Magnifier handle: a thick line from the ring edge toward bottom-right.
  const hx1 = cx + ringR * 0.7
  const hy1 = cy + ringR * 0.7
  const hx2 = s * 0.78
  const hy2 = s * 0.78
  const handleW = s * 0.08

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4
      // Rounded-rect tile background.
      if (insideRoundedRect(x + 0.5, y + 0.5, s, radius)) {
        px[i] = ACCENT[0]
        px[i + 1] = ACCENT[1]
        px[i + 2] = ACCENT[2]
        px[i + 3] = 255
      } else {
        continue
      }
      const dRing = Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - ringR)
      const dDot = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      const dHandle = distToSegment(x + 0.5, y + 0.5, hx1, hy1, hx2, hy2)
      if (dRing <= ringW / 2 || dDot <= dotR || dHandle <= handleW / 2) {
        blend(px, i, WHITE, 1)
      }
    }
  }
  return px
}

function insideRoundedRect(x, y, size, r) {
  const minX = r
  const minY = r
  const maxX = size - r
  const maxY = size - r
  const qx = Math.max(minX - x, 0, x - maxX)
  const qy = Math.max(minY - y, 0, y - maxY)
  return Math.hypot(qx, qy) <= r
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
