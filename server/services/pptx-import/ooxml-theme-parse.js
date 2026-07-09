/**
 * Parse OOXML theme1.xml → scheme colors + major/minor fonts (Phase 08a).
 */
const { DEFAULT_SCHEME } = require('./mapper/theme-resolve')

function extractSchemeColors(themeXml) {
  const scheme = { ...DEFAULT_SCHEME }
  const xml = String(themeXml || '')
  const names = [
    'dk1',
    'lt1',
    'dk2',
    'lt2',
    'accent1',
    'accent2',
    'accent3',
    'accent4',
    'accent5',
    'accent6',
    'hlink',
    'folHlink',
  ]
  for (const name of names) {
    const block = xml.match(new RegExp(`<(?:[a-z0-9]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-z0-9]+:)?${name}>`, 'i'))
    if (!block) continue
    const srgb = block[1].match(/<(?:[a-z0-9]+:)?srgbClr\b[^>]*val=(["'])([0-9A-Fa-f]{6})\1/i)
    if (srgb) {
      scheme[name] = `#${srgb[2].toUpperCase()}`
      continue
    }
    const sys = block[1].match(/<(?:[a-z0-9]+:)?sysClr\b[^>]*lastClr=(["'])([0-9A-Fa-f]{6})\1/i)
    if (sys) scheme[name] = `#${sys[2].toUpperCase()}`
  }
  // aliases used by some parsers
  scheme.tx1 = scheme.dk1
  scheme.tx2 = scheme.dk2
  scheme.bg1 = scheme.lt1
  scheme.bg2 = scheme.lt2
  return scheme
}

function extractFontScheme(themeXml) {
  const xml = String(themeXml || '')
  const major = xml.match(
    /<(?:[a-z0-9]+:)?majorFont\b[\s\S]*?<(?:[a-z0-9]+:)?latin\b[^>]*typeface=(["'])(.*?)\1/i
  )
  const minor = xml.match(
    /<(?:[a-z0-9]+:)?minorFont\b[\s\S]*?<(?:[a-z0-9]+:)?latin\b[^>]*typeface=(["'])(.*?)\1/i
  )
  return {
    major: major ? major[2] : null,
    minor: minor ? minor[2] : null,
  }
}

async function readZipText(zip, entry) {
  const file = zip?.file?.(entry)
  if (!file) return ''
  try {
    return await file.async('string')
  } catch {
    return ''
  }
}

/**
 * @param {import('jszip')} zip
 * @returns {Promise<{ scheme: object, fonts: { major: string|null, minor: string|null }, themePath: string|null }>}
 */
async function parseThemeFromZip(zip) {
  const entries = Object.keys(zip?.files || {})
    .map((e) => e.replace(/\\/g, '/'))
    .filter((e) => /^ppt\/theme\/theme\d+\.xml$/i.test(e))
    .sort((a, b) => a.localeCompare(b))
  const themePath = entries[0] || null
  if (!themePath) {
    return { scheme: { ...DEFAULT_SCHEME }, fonts: { major: null, minor: null }, themePath: null }
  }
  const xml = await readZipText(zip, themePath)
  return {
    scheme: extractSchemeColors(xml),
    fonts: extractFontScheme(xml),
    themePath,
  }
}

module.exports = {
  extractSchemeColors,
  extractFontScheme,
  parseThemeFromZip,
}
