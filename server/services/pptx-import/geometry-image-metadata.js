function invalid() {
  throw new TypeError('Invalid or unsupported geometry image header')
}

function metadata(width, height, format) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) invalid()
  return { width, height, format }
}

function pngMetadata(b) {
  if (b.length < 33 || b.readUInt32BE(8) !== 13 || b.toString('latin1', 12, 16) !== 'IHDR') invalid()
  const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] }
  if (!depths[b[25]]?.includes(b[24]) || b[26] !== 0 || b[27] !== 0 || b[28] > 1) invalid()
  const width = b.readUInt32BE(16)
  const height = b.readUInt32BE(20)
  if (width > 0x7fffffff || height > 0x7fffffff) invalid()
  return metadata(width, height, 'png')
}

function gifMetadata(b) {
  if (b.length < 13) invalid()
  if (b[10] & 0x80) {
    const colors = 2 ** ((b[10] & 7) + 1)
    if (b.length < 13 + 3 * colors || b[11] >= colors) invalid()
  }
  return metadata(b.readUInt16LE(6), b.readUInt16LE(8), 'gif')
}

function jpegMetadata(b) {
  let offset = 2
  while (offset < b.length) {
    if (b[offset++] !== 0xff) invalid()
    while (offset < b.length && b[offset] === 0xff) offset++
    if (offset >= b.length) invalid()
    const marker = b[offset++]
    if (marker === 1) continue // TEM has no segment length.
    if (marker === 0 || marker === 0xd8 || marker >= 0xd0 && marker <= 0xda) invalid()
    if (offset + 2 > b.length) invalid()
    const length = b.readUInt16BE(offset)
    if (length < 2 || length > b.length - offset) invalid()
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      if (length < 11) invalid()
      const components = b[offset + 7]
      const precision = b[offset + 2]
      const lossless = [0xc3, 0xc7, 0xcb, 0xcf].includes(marker)
      if (components === 0 || length !== 8 + 3 * components ||
          (lossless ? precision < 2 || precision > 16 : ![8, 12].includes(precision)) ||
          marker === 0xc0 && precision !== 8) invalid()
      const ids = new Set()
      for (let i = 0; i < components; i++) {
        const at = offset + 8 + 3 * i
        const sampling = b[at + 1]
        if (ids.has(b[at]) || (sampling >> 4) < 1 || (sampling >> 4) > 4 ||
            (sampling & 15) < 1 || (sampling & 15) > 4 ||
            b[at + 2] > 3 || lossless && b[at + 2] !== 0) invalid()
        ids.add(b[at])
      }
      return metadata(b.readUInt16BE(offset + 5), b.readUInt16BE(offset + 3), 'jpeg')
    }
    offset += length
  }
  invalid()
}

function bmpMetadata(b) {
  if (b.length < 26) invalid()
  const fileSize = b.readUInt32LE(2)
  const pixelOffset = b.readUInt32LE(10)
  const dibSize = b.readUInt32LE(14)
  if (![12, 40, 52, 56, 108, 124].includes(dibSize) || b.length < 14 + dibSize ||
      fileSize > b.length || pixelOffset < 14 + dibSize || pixelOffset >= fileSize ||
      b.readUInt32LE(6) !== 0) invalid()
  const core = dibSize === 12
  const width = core ? b.readUInt16LE(18) : b.readInt32LE(18)
  const signedHeight = core ? b.readUInt16LE(20) : b.readInt32LE(22)
  const height = Math.abs(signedHeight)
  const planes = b.readUInt16LE(core ? 22 : 26)
  const bits = b.readUInt16LE(core ? 24 : 28)
  const compression = core ? 0 : b.readUInt32LE(30)
  if (planes !== 1 || ![1, 4, 8, 16, 24, 32].includes(bits) || height > 0x7fffffff ||
      compression > 6 || compression === 1 && bits !== 8 ||
      compression === 2 && bits !== 4 ||
      [3, 6].includes(compression) && ![16, 32].includes(bits) ||
      signedHeight < 0 && ![0, 3, 6].includes(compression)) invalid()
  if (!core && b.readUInt32LE(34) > fileSize - pixelOffset) invalid()
  if ([0, 3, 6].includes(compression)) {
    const pixelBytes = Math.ceil(width * bits / 32) * 4 * height
    if (pixelBytes > fileSize - pixelOffset) invalid()
  }
  return metadata(width, height, 'bmp')
}

function webpMetadata(b) {
  if (b.length < 20) invalid()
  const end = b.readUInt32LE(4) + 8
  if (end > b.length || end < 20 || end % 2 !== 0) invalid()
  let result
  for (let offset = 12; offset < end;) {
    if (offset + 8 > end) invalid()
    const kind = b.toString('latin1', offset, offset + 4)
    const length = b.readUInt32LE(offset + 4)
    const start = offset + 8
    const next = start + length + length % 2
    if (next > end || length % 2 && b[next - 1] !== 0) invalid()
    if (!result && kind === 'VP8X') {
      if (offset !== 12 || length !== 10 || (b[start] & 0xc1) !== 0 ||
          b.readUIntLE(start + 1, 3) !== 0) invalid()
      result = metadata(1 + b.readUIntLE(start + 4, 3), 1 + b.readUIntLE(start + 7, 3), 'webp')
    } else if (!result && kind === 'VP8L') {
      if (length < 5 || b[start] !== 0x2f || b[start + 4] >> 5 !== 0) invalid()
      const packed = b.readUInt32LE(start + 1)
      result = metadata(1 + (packed & 0x3fff), 1 + ((packed >>> 14) & 0x3fff), 'webp')
    } else if (!result && kind === 'VP8 ') {
      if (length < 10 || (b[start] & 1) !== 0 || ((b[start] >> 1) & 7) > 3 ||
          (b[start] & 0x10) === 0 || b.readUIntLE(start + 3, 3) !== 0x2a019d ||
          (b.readUIntLE(start, 3) >>> 5) > length - 3) invalid()
      result = metadata(b.readUInt16LE(start + 6) & 0x3fff, b.readUInt16LE(start + 8) & 0x3fff, 'webp')
    }
    offset = next
  }
  if (!result) invalid()
  return result
}

/**
 * Read authored pixel dimensions using Node Buffers only.
 * PNG IHDR, GIF87a/89a logical screens, JPEG SOF, BMP CORE/INFO/V2/V3/V4/V5,
 * and WebP VP8/VP8L/VP8X headers are supported. All reads and segment/chunk
 * traversal are bounded by supplied bytes and declared lengths.
 * Header-only: no pixel decompression, PNG CRC checks, or verification of later
 * PNG/GIF/JPEG image data. WebP checks RIFF chunk bounds, not frame decoding;
 * VP8X alone establishes canvas metadata, not the presence of an image frame.
 * BMP checks declared file/pixel bounds, not compressed data or color masks.
 * Successful metadata extraction never establishes successful image decoding.
 */
function extractGeometryImageMetadata(buffer) {
  if (!Buffer.isBuffer(buffer)) invalid()
  if (buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return pngMetadata(buffer)
  const signature = buffer.toString('latin1', 0, 6)
  if (signature === 'GIF87a' || signature === 'GIF89a') return gifMetadata(buffer)
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return jpegMetadata(buffer)
  if (buffer.toString('latin1', 0, 2) === 'BM') return bmpMetadata(buffer)
  if (buffer.toString('latin1', 0, 4) === 'RIFF' &&
      buffer.toString('latin1', 8, 12) === 'WEBP') return webpMetadata(buffer)
  invalid()
}

module.exports = { extractGeometryImageMetadata }
