const { PNG } = require('pngjs')
const { extractGeometryImageMetadata } = require('./geometry-image-metadata')
const { MAX_MEDIA_SIZE } = require('./media')
function fail(detail) {
  throw Object.assign(new TypeError(`Unsupported geometry blip source: ${detail}`), {
    code: 'PPTX_BLIP_SOURCE_UNSUPPORTED',
  })
}
function inspectGeometryBlipSource(bytes, remainingBytes = MAX_MEDIA_SIZE) {
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_MEDIA_SIZE) fail('source byte budget')
  let metadata
  try { metadata = extractGeometryImageMetadata(bytes) } catch { fail('image header') }
  const { width, height, format } = metadata
  const rgbaBytes = width * height * 4
  if (!Number.isSafeInteger(rgbaBytes) || rgbaBytes > MAX_MEDIA_SIZE) fail('decoded pixel budget')
  let workingBytes
  if (format === 'png') {
    // pngjs interlace inflation is not bounded; tRNS normalization clears hidden RGB.
    // Reject color declarations rather than silently dropping them from derived PNGs.
    if (bytes[24] !== 8 || ![2, 6].includes(bytes[25]) || bytes[28] !== 0)
      fail('PNG requires noninterlaced 8-bit RGB/RGBA')
    let offset = 8, idat = false, ended = false, dataEnded = false
    while (offset < bytes.length) {
      if (offset + 12 > bytes.length) fail('PNG chunk bounds')
      const length = bytes.readUInt32BE(offset), kind = bytes.toString('ascii', offset + 4, offset + 8)
      if (length > bytes.length - offset - 12) fail('PNG chunk bounds')
      if (!['IHDR', 'IDAT', 'IEND'].includes(kind)) fail(`PNG unsupported chunk ${kind}`)
      if (kind === 'IHDR' && (offset !== 8 || length !== 13)) fail('PNG header order')
      if (kind === 'IDAT') {
        if (dataEnded) fail('PNG data order')
        idat = true
      } else if (idat) dataEnded = true
      offset += length + 12
      if (kind === 'IEND') {
        if (!idat || length || offset !== bytes.length) fail('PNG end bounds')
        ended = true
      }
    }
    if (!ended) fail('PNG missing end')
    const filteredBytes = (width * (bytes[25] === 6 ? 4 : 3) + 1) * height
    // Conservative peak for compressed aggregation, inflation/filter buffers,
    // RGBA normalization, one shaded buffer and PNG encoding temporaries.
    workingBytes = bytes.length * 2 + filteredBytes * 3 + rgbaBytes * 8
  } else if (format === 'bmp') {
    if (bytes.readUInt32LE(14) !== 40 || ![24, 32].includes(bytes.readUInt16LE(28)) ||
        bytes.readUInt32LE(30) !== 0 || bytes.readUInt32LE(46) !== 0)
      fail('BMP requires BITMAPINFOHEADER BI_RGB24/32 without palette')
    workingBytes = bytes.length + rgbaBytes * 8
  } else fail(`format ${format}`)
  if (!Number.isSafeInteger(workingBytes) || !Number.isFinite(remainingBytes) ||
      workingBytes > remainingBytes) fail('decode working byte budget')
  return { ...metadata, workingBytes }
}
function decodeGeometryBlipSource(bytes, remainingBytes) {
  const metadata = inspectGeometryBlipSource(bytes, remainingBytes)
  const { width, height, format } = metadata
  if (format === 'png') {
    let image
    try { image = PNG.sync.read(bytes, { checkCRC: true }) }
    catch (error) { fail(`PNG decode: ${error.message}`) }
    if (image.width !== width || image.height !== height || image.data.length !== width * height * 4)
      fail('PNG decoded extent')
    return { width, height, data: image.data }
  }
  const pixelOffset = bytes.readUInt32LE(10), bits = bytes.readUInt16LE(28)
  const stride = Math.ceil(width * bits / 32) * 4, topDown = bytes.readInt32LE(22) < 0
  const data = Buffer.allocUnsafe(width * height * 4)
  for (let y = 0; y < height; y++) {
    const row = pixelOffset + (topDown ? y : height - y - 1) * stride
    for (let x = 0; x < width; x++) {
      const from = row + x * (bits / 8), to = (y * width + x) * 4
      data[to] = bytes[from + 2]; data[to + 1] = bytes[from + 1]; data[to + 2] = bytes[from]
      // BI_RGB32's fourth byte is reserved, not an authored alpha channel.
      data[to + 3] = 255
    }
  }
  return { width, height, data }
}
module.exports = { inspectGeometryBlipSource, decodeGeometryBlipSource }
