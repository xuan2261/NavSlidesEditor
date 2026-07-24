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

function paeth(left, up, upLeft) {
  const p = left + up - upLeft
  const leftDistance = Math.abs(p - left)
  const upDistance = Math.abs(p - up)
  const upLeftDistance = Math.abs(p - upLeft)
  return leftDistance <= upDistance && leftDistance <= upLeftDistance ? left : upDistance <= upLeftDistance ? up : upLeft
}

function filterRow(row, previous, bytesPerPixel, filterType) {
  const filtered = Buffer.alloc(row.length)
  for (let index = 0; index < row.length; index += 1) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0
    const up = previous?.[index] || 0
    const upLeft = index >= bytesPerPixel ? previous?.[index - bytesPerPixel] || 0 : 0
    const predictor = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, upLeft)][filterType]
    filtered[index] = (row[index] - predictor + 256) & 0xff
  }
  return filtered
}

/**
 * Encode raw RGBA (width*height*4) to PNG buffer.
 */
function encodePngRgba(width, height, rgba, { filterType = 0 } = {}) {
  if (rgba.length !== width * height * 4) throw new Error('RGBA length mismatch')
  if (!Number.isInteger(filterType) || filterType < 0 || filterType > 4) throw new Error('Unsupported PNG filter type')
  const stride = width * 4 + 1
  const raw = Buffer.alloc(stride * height)
  let previous = null
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * stride
    const pixels = rgba.subarray(y * width * 4, (y + 1) * width * 4)
    raw[rowStart] = filterType
    filterRow(pixels, previous, 4, filterType).copy(raw, rowStart + 1)
    previous = pixels
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
  let ended = false
  const idat = []
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset)
    if (len > buf.length - offset - 12) throw new Error('PNG chunk truncated')
    const type = buf.toString('ascii', offset + 4, offset + 8)
    const data = buf.subarray(offset + 8, offset + 8 + len)
    offset += 12 + len
    if (type === 'IHDR') {
      if (data.length !== 13) throw new Error('Invalid PNG IHDR')
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      ended = true
      break
    }
  }
  if (!ended) throw new Error('PNG missing IEND')
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
  if (inflated.length !== stride * height) throw new Error('PNG data length mismatch')
  const rgba = Buffer.alloc(width * height * 4)
  let previous = null
  for (let y = 0; y < height; y += 1) {
    const row = y * stride
    const filterType = inflated[row]
    if (filterType > 4) throw new Error('Unsupported PNG filter type')
    const pixels = Buffer.alloc(width * channels)
    for (let index = 0; index < pixels.length; index += 1) {
      const left = index >= channels ? pixels[index - channels] : 0
      const up = previous?.[index] || 0
      const upLeft = index >= channels ? previous?.[index - channels] || 0 : 0
      const predictor = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, upLeft)][filterType]
      pixels[index] = (inflated[row + 1 + index] + predictor) & 0xff
    }
    for (let x = 0; x < width; x += 1) {
      const src = x * channels
      const dst = (y * width + x) * 4
      rgba[dst] = pixels[src]
      rgba[dst + 1] = pixels[src + 1]
      rgba[dst + 2] = pixels[src + 2]
      rgba[dst + 3] = channels === 4 ? pixels[src + 3] : 255
    }
    previous = pixels
  }
  return { width, height, data: rgba }
}

module.exports = {
  encodePngRgba,
  decodePng,
}
