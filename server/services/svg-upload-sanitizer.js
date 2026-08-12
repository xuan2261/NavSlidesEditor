const fs = require('fs').promises
const createDOMPurify = require('dompurify')
const { JSDOM } = require('jsdom')

const MAX_SVG_BYTES = 5 * 1024 * 1024
const window = new JSDOM('').window
const DOMPurify = createDOMPurify(window)
const FORBIDDEN_TAGS = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video']
const FORBIDDEN_ATTR = ['onload', 'onclick', 'onerror', 'onbegin', 'onend', 'onrepeat']

function sanitizeSvgBuffer(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input || ''))
  if (buffer.length > MAX_SVG_BYTES) {
    const error = new Error('SVG exceeds the 5 MiB limit')
    error.code = 'svg-too-large'
    throw error
  }
  const source = buffer.toString('utf8')
  if (/<!DOCTYPE|<!ENTITY/i.test(source) || !/<svg(?:\s|>)/i.test(source)) {
    const error = new Error('File content is not valid SVG')
    error.code = 'invalid-svg'
    throw error
  }
  const clean = DOMPurify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: FORBIDDEN_TAGS,
    FORBID_ATTR: FORBIDDEN_ATTR,
    ALLOW_DATA_ATTR: false,
  })
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i.test(clean)) {
    const error = new Error('Sanitized SVG has no root element')
    error.code = 'invalid-svg'
    throw error
  }
  if (/(?:href|src|xlink:href)\s*=\s*["'](?:https?:|javascript:|data:|\/\/)/i.test(clean) ||
      /url\s*\(\s*["']?(?:https?:|data:|\/\/)/i.test(clean)) {
    const error = new Error('SVG contains an unsafe external reference')
    error.code = 'unsafe-svg'
    throw error
  }
  return Buffer.from(clean)
}

async function sanitizeSvgFile(filePath) {
  const handle = await fs.open(filePath, 'r')
  try {
    const { size } = await handle.stat()
    if (size > MAX_SVG_BYTES) {
      const error = new Error('SVG exceeds the 5 MiB limit')
      error.code = 'svg-too-large'
      throw error
    }
    return sanitizeSvgBuffer(await handle.readFile())
  } finally {
    await handle.close()
  }
}

module.exports = { MAX_SVG_BYTES, sanitizeSvgBuffer, sanitizeSvgFile }
