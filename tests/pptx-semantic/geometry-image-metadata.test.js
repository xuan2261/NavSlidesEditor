import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { extractGeometryImageMetadata } = require('../../server/services/pptx-import/geometry-image-metadata')

// Independent wire-format fixtures: these exercise headers, not a mocked decoder.
const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000030000000208020000001216f14d', 'hex')
const gif = Buffer.from('47494638396103000200800000000000ffffff', 'hex')
function jpeg(marker = 0xc0) {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 1, 2, 0xff, marker,
    0, 11, 8, 0, 2, 0, 3, 1, 1, 0x11, 0])
}
function bmp(dibSize = 40, height = 2) {
  const headerSize = 14 + dibSize
  const b = Buffer.alloc(headerSize + 24)
  b.write('BM')
  b.writeUInt32LE(b.length, 2)
  b.writeUInt32LE(headerSize, 10)
  b.writeUInt32LE(dibSize, 14)
  if (dibSize === 12) {
    b.writeUInt16LE(3, 18)
    b.writeUInt16LE(height, 20)
    b.writeUInt16LE(1, 22)
    b.writeUInt16LE(24, 24)
  } else {
    b.writeInt32LE(3, 18)
    b.writeInt32LE(height, 22)
    b.writeUInt16LE(1, 26)
    b.writeUInt16LE(24, 28)
    b.writeUInt32LE(24, 34)
  }
  return b
}
function webp(kind) {
  const payload = kind === 'VP8L'
    ? Buffer.from('2f02400000', 'hex') // 3 x 2, version 0
    : kind === 'VP8 '
      ? Buffer.from('1000009d012a03000200', 'hex') // key frame, show frame
      : Buffer.from('00000000020000010000', 'hex') // VP8X canvas 3 x 2
  const b = Buffer.alloc(20 + payload.length + (payload.length % 2))
  b.write('RIFF')
  b.writeUInt32LE(b.length - 8, 4)
  b.write('WEBP', 8)
  b.write(kind, 12)
  b.writeUInt32LE(payload.length, 16)
  payload.copy(b, 20)
  return b
}
const headers = [
  ['png', png], ['gif', gif], ['jpeg', jpeg()],
  ['jpeg', jpeg(0xc2)], ['bmp', bmp()], ['bmp', bmp(12)],
  ['bmp', bmp(108, -2)], ['bmp', bmp(124)], ['webp', webp('VP8 ')],
  ['webp', webp('VP8L')], ['webp', webp('VP8X')],
]
const changed = (b, mutate) => {
  const copy = Buffer.from(b)
  mutate(copy)
  return copy
}

describe('geometry image header metadata', () => {
  it.each(headers)('reads authored %s pixel dimensions without mutating bytes', (format, bytes) => {
    const before = Buffer.from(bytes)
    expect(extractGeometryImageMetadata(bytes)).toEqual({ width: 3, height: 2, format })
    expect(bytes).toEqual(before)
  })
  it.each(headers)('rejects every truncated %s header boundary', (_format, bytes) => {
    for (let length = 0; length < bytes.length; length++) {
      expect(() => extractGeometryImageMetadata(bytes.subarray(0, length))).toThrow(TypeError)
    }
  })
  it.each([undefined, null, {}, new Uint8Array(png), 'PNG', Buffer.from('unknown')])(
    'rejects unrecognized input %j', (bytes) => {
      expect(() => extractGeometryImageMetadata(bytes)).toThrow(TypeError)
    }
  )
  it.each([
    changed(png, b => b.writeUInt32BE(0, 16)),
    changed(png, b => b.writeUInt32BE(0, 20)),
    changed(png, b => b.writeUInt32BE(0x80000000, 16)),
    changed(png, b => b.writeUInt32BE(12, 8)),
    changed(png, b => b.write('IDAT', 12)),
    changed(png, b => { b[24] = 3 }),
    changed(png, b => { b[26] = 1 }),
    changed(png, b => { b[28] = 2 }),
    changed(gif, b => b.writeUInt16LE(0, 6)),
    changed(gif, b => b.writeUInt16LE(0, 8)),
    changed(gif, b => { b[10] = 0x81 }),
    changed(gif, b => { b[11] = 2 }),
    changed(jpeg(), b => b.writeUInt16BE(0, 13)),
    changed(jpeg(), b => b.writeUInt16BE(0, 15)),
    changed(jpeg(), b => b.writeUInt16BE(0xffff, 4)),
    changed(jpeg(), b => b.writeUInt16BE(10, 10)),
    changed(jpeg(), b => { b[17] = 0 }),
    changed(jpeg(), b => { b[19] = 0 }),
    changed(jpeg(), b => { b[8] = 0 }),
    changed(bmp(), b => b.writeInt32LE(0, 18)),
    changed(bmp(), b => b.writeInt32LE(0, 22)),
    changed(bmp(), b => b.writeInt32LE(-3, 18)),
    changed(bmp(), b => b.writeInt32LE(-2147483648, 22)),
    changed(bmp(), b => b.writeUInt32LE(39, 14)),
    changed(bmp(), b => b.writeUInt32LE(1, 10)),
    changed(bmp(), b => b.writeUInt32LE(9999, 2)),
    changed(bmp(), b => b.writeUInt16LE(0, 26)),
    changed(bmp(), b => b.writeUInt16LE(0, 28)),
    changed(webp('VP8 '), b => b.writeUInt16LE(0, 26)),
    changed(webp('VP8 '), b => b.writeUInt16LE(0, 28)),
    changed(webp('VP8 '), b => { b[23] = 0 }),
    changed(webp('VP8 '), b => { b[20] = 0x11 }),
    changed(webp('VP8 '), b => { b[22] = 0xff }),
    changed(webp('VP8L'), b => { b[20] = 0 }),
    changed(webp('VP8L'), b => { b[24] = 0x20 }),
    changed(webp('VP8X'), b => { b[20] = 1 }),
    changed(webp('VP8X'), b => { b[21] = 1 }),
    changed(webp('VP8X'), b => b.writeUInt32LE(9, 16)),
    changed(webp('VP8X'), b => b.writeUInt32LE(9999, 16)),
    changed(webp('VP8X'), b => b.writeUInt32LE(9999, 4)),
  ])('rejects malformed headers rather than accepting signatures %#', bytes => {
    expect(() => extractGeometryImageMetadata(bytes)).toThrow(TypeError)
  })
  it('reads GIF87a and the logical screen, not DPI or a frame rectangle', () => {
    const bytes = changed(gif, b => b.write('GIF87a'))
    expect(extractGeometryImageMetadata(bytes)).toEqual({ width: 3, height: 2, format: 'gif' })
  })
  it('skips bounded JPEG segments and marker fill bytes', () => {
    const bytes = Buffer.concat([jpeg().subarray(0, 8), Buffer.from([0xff]), jpeg().subarray(8)])
    expect(extractGeometryImageMetadata(bytes)).toEqual({ width: 3, height: 2, format: 'jpeg' })
  })
  it('does not promise a complete image decode from a valid header', () => {
    // PNG has no IDAT/IEND; VP8X has no frame payload. Metadata remains header-only.
    expect(extractGeometryImageMetadata(png).width).toBe(3)
    expect(extractGeometryImageMetadata(webp('VP8X')).width).toBe(3)
  })
})
