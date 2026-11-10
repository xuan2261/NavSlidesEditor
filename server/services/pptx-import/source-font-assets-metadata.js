const { readFontCoverage } = require('../../../shared/src/pptx-text-layout-font')

// Only physical single-face SFNT is admitted by the consuming browser runtime.
// Identity comes from name/OS2/head tables, never the containing file's name.
function inspectSourceFont(bytes) {
  const v = new DataView(bytes)
  const fail = () => {
    throw new TypeError('Malformed or unsupported SFNT metadata')
  }
  const u16 = (at) => {
    if (at < 0 || at + 2 > v.byteLength) fail()
    return v.getUint16(at)
  }
  const u32 = (at) => {
    if (at < 0 || at + 4 > v.byteLength) fail()
    return v.getUint32(at)
  }
  if (![0x00010000, 0x4f54544f].includes(u32(0))) return { reason: 'font-container-unsupported' }
  const count = u16(4),
    tables = new Map()
  if (!count || count > 256 || 12 + count * 16 > v.byteLength) fail()
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16,
      tag = u32(at),
      offset = u32(at + 8),
      length = u32(at + 12)
    if (offset < 12 + count * 16 || offset + length > v.byteLength || tables.has(tag)) fail()
    tables.set(tag, { offset, length })
  }
  const name = tables.get(0x6e616d65),
    os2 = tables.get(0x4f532f32),
    head = tables.get(0x68656164)
  if (!name || name.length < 6 || !os2 || os2.length < 64 || !head || head.length < 54) fail()
  const records = u16(name.offset + 2),
    storage = u16(name.offset + 4)
  if (u16(name.offset) > 1 || records > 4096 || storage < 6 + records * 12 || storage > name.length)
    fail()
  const names = new Map(),
    styleNames = [],
    localizedStyles = []
  const languageTags = []
  if (u16(name.offset) === 1) {
    const at = name.offset + 6 + records * 12
    if (at + 2 > name.offset + storage) fail()
    const count = u16(at)
    if (count > 4096 || at + 2 + count * 4 > name.offset + storage) fail()
    for (let index = 0; index < count; index++) {
      const length = u16(at + 2 + index * 4),
        relative = u16(at + 4 + index * 4)
      if (!length || length > 2048 || length % 2 || storage + relative + length > name.length)
        fail()
      languageTags.push(
        new TextDecoder('utf-16be', { fatal: true }).decode(
          new Uint8Array(bytes, name.offset + storage + relative, length)
        )
      )
    }
  }
  for (let i = 0; i < records; i++) {
    const at = name.offset + 6 + i * 12
    const platform = u16(at),
      encoding = u16(at + 2),
      language = u16(at + 4),
      id = u16(at + 6)
    const length = u16(at + 8),
      relative = u16(at + 10)
    if (storage + relative + length > name.length) fail()
    if (![1, 2, 4, 6, 16, 17].includes(id)) continue
    const unicode = platform === 0 || (platform === 3 && [0, 1, 10].includes(encoding))
    if (!unicode && !(platform === 1 && encoding === 0)) continue
    if (length > 2048 || (unicode && length % 2)) fail()
    const raw = new Uint8Array(bytes, name.offset + storage + relative, length)
    const value = new TextDecoder(unicode ? 'utf-16be' : 'macintosh', { fatal: true }).decode(raw)
    if (
      !value ||
      value.length > 1024 ||
      [...value].some((c) => c.codePointAt(0) < 32 || c.codePointAt(0) === 127)
    )
      fail()
    if (!names.has(id)) names.set(id, new Set())
    names.get(id).add(value)
    if (id === 2 || id === 17) {
      // Name strings are localized UI labels, not language-independent style
      // enums. Interpret the standard tokens only in English or neutral records;
      // retain every localized string without inventing its translation.
      const tagged = language >= 0x8000 ? languageTags[language - 0x8000] : null
      const standard = tagged
        ? /^en(?:-|$)/i.test(tagged)
        : language < 0x8000 &&
          ((platform === 3 && (language & 0x3ff) === 9) ||
            (platform === 1 && language === 0) ||
            (platform === 0 && language === 0))
      if (standard) styleNames.push(value)
      else if (language < 0x8000 || tagged) localizedStyles.push(value)
    }
  }
  const values = (...ids) => [...new Set(ids.flatMap((id) => [...(names.get(id) || [])]))].sort()
  const families = values(1, 16),
    subfamilies = values(2, 17)
  if (!families.length || !subfamilies.length) fail()
  const selection = u16(os2.offset + 62),
    macStyle = u16(head.offset + 44)
  // Require explicit, consistent standard subfamily declarations plus OS/2
  // weight. Unset style flags do not add evidence; affirmative flags (including
  // REGULAR) contradicting the declared subfamily make the face unsupported.
  const styles = new Map([
    ['regular', [false, false]],
    ['roman', [false, false]],
    ['normal', [false, false]],
    ['bold', [true, false]],
    ['italic', [false, true]],
    ['oblique', [false, true]],
    ['bold italic', [true, true]],
    ['bold oblique', [true, true]],
  ])
  const declared = styleNames.map((s) => styles.get(s.toLowerCase()))
  // A recognized conflicting standard token still contradicts the physical
  // face, even when stored in a non-English record.
  declared.push(...localizedStyles.map((s) => styles.get(s.toLowerCase())).filter(Boolean))
  const [bold, italic] = declared[0] || [false, false]
  const styleUnsupported =
    !styleNames.length ||
    declared.some((s) => !s || s[0] !== bold || s[1] !== italic) ||
    (!!(selection & 32 || macStyle & 1) && !bold) ||
    (!!(selection & 1 || macStyle & 2) && !italic) ||
    (!!(selection & 64) && (bold || italic))
  const metadata = {
    families,
    subfamilies,
    fullNames: values(4),
    postscriptNames: values(6),
    bold,
    italic,
    weight: u16(os2.offset + 4),
    width: u16(os2.offset + 6),
    fsSelection: selection,
    macStyle,
  }
  let reason = null
  if (tables.has(0x66766172)) reason = 'font-variable-unsupported'
  else if (
    styleUnsupported ||
    metadata.weight !== (bold ? 700 : 400) ||
    metadata.width !== 5 ||
    selection & 512
  )
    reason = 'font-style-unsupported'
  else {
    try {
      readFontCoverage(bytes)
    } catch {
      reason = 'font-coverage-unsupported'
    }
  }
  return { metadata, reason }
}

module.exports = { inspectSourceFont }
