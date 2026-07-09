/**
 * Minimal 8-bit RGB/RGBA PNG encode/decode (no external deps).
 * Enough for oracle golden fixtures and SSIM gates.
 */
const zlib = require('node:zlib')
const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function u32be(n) {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n >>> 0, 0)
  return b
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = u32be(data.length)
  const crc = u32be(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

/**
 * Encode raw RGBA (width*height*4) to PNG buffer.
 */
function encodePngRgba(width, height, rgba) {
  if (rgba.length !== width * height * 4) throw new Error('RGBA length mismatch')
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * stride
    raw[rowStart] = 0 // filter none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }
  const compressed = zlib.deflateSync(raw)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

const MAX_PNG_DIM = 4096
const MAX_INFLATE_BYTES = 64 * 1024 * 1024

/**
 * Decode 8-bit RGB/RGBA PNG → { width, height, data: Buffer RGBA }
 */
function decodePng(pngBuffer, options = {}) {
  const maxDim = options.maxDim ?? MAX_PNG_DIM
  const maxInflate = options.maxInflateBytes ?? MAX_INFLATE_BYTES
  const buf = Buffer.isBuffer(pngBuffer) ? pngBuffer : Buffer.from(pngBuffer)
  if (buf.length < 8 || buf[0] !== 137 || buf[1] !== 80) throw new Error('Not a PNG')
  let offset = 8
  let width = 0
  let height = 0
  let colorType = 0
  let bitDepth = 0
  const idat = []
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset)
    const type = buf.toString('ascii', offset + 4, offset + 8)
    const data = buf.subarray(offset + 8, offset + 8 + len)
    offset += 12 + len
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') break
  }
  if (!width || !height) throw new Error('PNG missing IHDR')
  if (width > maxDim || height > maxDim) {
    throw new Error(`PNG dimensions ${width}x${height} exceed max ${maxDim}`)
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG colorType=${colorType} bitDepth=${bitDepth}`)
  }
  const inflated = zlib.inflateSync(Buffer.concat(idat), { maxOutputLength: maxInflate })
  const channels = colorType === 6 ? 4 : 3
  const stride = width * channels + 1
  if (inflated.length < stride * height) throw new Error('PNG data truncated')
  const rgba = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    const row = y * stride
    if (inflated[row] !== 0) throw new Error('Only filter type 0 supported')
    for (let x = 0; x < width; x += 1) {
      const src = row + 1 + x * channels
      const dst = (y * width + x) * 4
      rgba[dst] = inflated[src]
      rgba[dst + 1] = inflated[src + 1]
      rgba[dst + 2] = inflated[src + 2]
      rgba[dst + 3] = channels === 4 ? inflated[src + 3] : 255
    }
  }
  return { width, height, data: rgba }
}

module.exports = {
  encodePngRgba,
  decodePng,
}
