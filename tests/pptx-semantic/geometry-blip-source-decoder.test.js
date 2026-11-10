import { createRequire } from 'node:module'
import { expect, it } from 'vitest'
const require = createRequire(import.meta.url)
const { PNG } = require('pngjs')
function decode(bytes) {
  return require('../../server/services/pptx-import/geometry-blip-source-decoder').decodeGeometryBlipSource(bytes)
}
function bmp(bits, topDown = false) {
  const stride = 4, bytes = Buffer.alloc(54 + 2 * stride)
  bytes.write('BM'); bytes.writeUInt32LE(bytes.length, 2); bytes.writeUInt32LE(54, 10)
  bytes.writeUInt32LE(40, 14); bytes.writeInt32LE(1, 18); bytes.writeInt32LE(topDown ? -2 : 2, 22)
  bytes.writeUInt16LE(1, 26); bytes.writeUInt16LE(bits, 28); bytes.writeUInt32LE(8, 34)
  Buffer.from([30, 20, 10, 0, 60, 50, 40, 127]).copy(bytes, 54)
  return bytes
}
it.each([24, 32])('reads bounded BI_RGB%s rows without interpreting reserved bytes as alpha', bits => {
  expect(decode(bmp(bits))).toMatchObject({ width: 1, height: 2, data: Buffer.from([40, 50, 60, 255, 10, 20, 30, 255]) })
  expect(decode(bmp(bits, true)).data).toEqual(Buffer.from([10, 20, 30, 255, 40, 50, 60, 255]))
})
it('preserves hidden RGB at zero alpha without canvas premultiplication', () => {
  const data = Buffer.from([100, 150, 200, 0, 1, 2, 3, 1])
  const bytes = PNG.sync.write({ width: 2, height: 1, data }, { colorType: 6 })
  expect(decode(bytes)).toMatchObject({ width: 2, height: 1, data })
})
it('rejects unsupported BMP encodings and truncated rows before pixel reads', () => {
  const compressed = bmp(32); compressed.writeUInt32LE(3, 30)
  expect(() => decode(compressed)).toThrow(/BMP|bmp/)
  expect(() => decode(bmp(24).subarray(0, 60))).toThrow()
  const huge = bmp(24); huge.writeInt32LE(0x7fffffff, 18)
  expect(() => decode(huge)).toThrow()
})
it('rejects unsupported PNG depth, interlace and damaged CRC instead of returning source pixels', () => {
  const png = PNG.sync.write({ width: 1, height: 1, data: Buffer.from([10, 20, 30, 0]) })
  const depth = Buffer.from(png); depth[24] = 16
  const interlace = Buffer.from(png); interlace[28] = 1
  const crc = Buffer.from(png); crc[29] ^= 1
  for (const bytes of [depth, interlace, crc]) expect(() => decode(bytes)).toThrow(/Unsupported geometry blip source: PNG/)
})
it.each(['sRGB', 'gAMA', 'cHRM', 'iCCP', 'tRNS', 'acTL'])('refuses PNG %s rather than dropping source declarations', kind => {
  const png = PNG.sync.write({ width: 1, height: 1, data: Buffer.from([10, 20, 30, 0]) })
  const declaration = Buffer.alloc(13); declaration.writeUInt32BE(1, 0); declaration.write(kind, 4)
  expect(() => decode(Buffer.concat([png.subarray(0, 33), declaration, png.subarray(33)])))
    .toThrow(`Unsupported geometry blip source: PNG unsupported chunk ${kind}`)
})
it('checks decoded and peak working bytes before entering pngjs', () => {
  const png = PNG.sync.write({ width: 1, height: 1, data: Buffer.from([10, 20, 30, 0]) })
  const module = require('../../server/services/pptx-import/geometry-blip-source-decoder')
  expect(() => module.decodeGeometryBlipSource(png, 1)).toThrow(/decode working byte budget/)
  const huge = Buffer.from(png); huge.writeUInt32BE(0x7fffffff, 16)
  expect(() => decode(huge)).toThrow(/decoded pixel budget/)
})
