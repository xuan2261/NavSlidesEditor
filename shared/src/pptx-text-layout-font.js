// Keep source text independent of Reveal themes, inspector typography and host
// document defaults. Both the isolated shaper and the actual painter use this
// reset before applying canonical run declarations; it never alters source data.
const TEXT_SHAPING_RESET = 'font-stretch:normal;font-variant:normal;font-feature-settings:normal;' +
  'font-variation-settings:normal;font-optical-sizing:none;font-size-adjust:none;' +
  'word-spacing:0;text-transform:none;text-indent:0;text-rendering:auto;' +
  'writing-mode:horizontal-tb;text-orientation:mixed;text-combine-upright:none;'

// Font coverage is checked from the same SFNT bytes loaded into FontFace. A
// successful FontFaceSet.check alone does not exclude per-glyph system fallback.
function readFontCoverage(bytes) {
  const view = new DataView(bytes)
  const fail = () => { throw new TypeError('Unsupported or malformed SFNT font coverage') }
  const u16 = (at) => { if (at < 0 || at + 2 > view.byteLength) fail(); return view.getUint16(at) }
  const u32 = (at) => { if (at < 0 || at + 4 > view.byteLength) fail(); return view.getUint32(at) }
  if (![0x00010000, 0x4f54544f].includes(u32(0)) || u16(4) > 256) fail()
  const tables = {}
  for (let i = 0; i < u16(4); i++) {
    const at = 12 + i * 16, tag = u32(at), offset = u32(at + 8), length = u32(at + 12)
    if (offset + length > bytes.byteLength || tables[tag]) fail()
    tables[tag] = { offset, length }
  }
  if (tables[0x66766172]) fail() // fvar needs an axis/variation contract.
  const cmap = tables[0x636d6170], maxp = tables[0x6d617870]
  if (!cmap || !maxp || cmap.length < 4 || maxp.length < 6) fail()
  const glyphs = u16(maxp.offset + 4), start = cmap.offset, end = start + cmap.length
  const candidates = []
  for (let i = 0; i < u16(start + 2); i++) {
    const at = start + 4 + i * 8
    if (at + 8 > end) fail()
    const platform = u16(at), encoding = u16(at + 2), sub = start + u32(at + 4)
    if (!(platform === 0 || (platform === 3 && [1, 10].includes(encoding)))) continue
    if (sub < start || sub + 2 > end) fail()
    const format = u16(sub)
    if (![4, 12].includes(format)) continue
    const length = format === 4 ? u16(sub + 2) : u32(sub + 4)
    if (sub + length > end || length < (format === 4 ? 16 : 16)) fail()
    if (format === 12) {
      const count = u32(sub + 12)
      if (16 + count * 12 > length) fail()
      let previous = -1
      const groups = []
      for (let g = 0; g < count; g++) {
        const p = sub + 16 + g * 12, lo = u32(p), hi = u32(p + 4), first = u32(p + 8)
        if (lo > hi || lo <= previous || hi > 0x10ffff) fail()
        previous = hi
        groups.push([lo, hi, first])
      }
      candidates.push({ rank: 2, glyph: (cp) => {
        let low = 0, high = groups.length - 1
        while (low <= high) {
          const mid = (low + high) >> 1, [lo, hi, first] = groups[mid]
          if (cp < lo) high = mid - 1
          else if (cp > hi) low = mid + 1
          else return first + cp - lo
        }
        return 0
      } })
    } else {
      const count = u16(sub + 6) / 2
      if (!Number.isInteger(count) || !count || 16 + count * 8 > length) fail()
      let previous = -1
      const segments = []
      for (let s = 0; s < count; s++) {
        const hi = u16(sub + 14 + s * 2), lo = u16(sub + 16 + count * 2 + s * 2)
        const delta = u16(sub + 16 + count * 4 + s * 2), pointer = sub + 16 + count * 6 + s * 2
        const offset = u16(pointer)
        if (lo > hi || hi <= previous || (offset && pointer + offset + (hi - lo) * 2 + 2 > sub + length)) fail()
        previous = hi
        segments.push([lo, hi, delta, pointer, offset])
      }
      candidates.push({ rank: 1, glyph: (cp) => {
        if (cp > 0xffff) return 0
        const segment = segments.find(([lo, hi]) => cp >= lo && cp <= hi)
        if (!segment) return 0
        const [lo, , delta, pointer, offset] = segment
        const raw = offset ? u16(pointer + offset + (cp - lo) * 2) : cp
        return offset && raw === 0 ? 0 : (raw + delta) & 0xffff
      } })
    }
  }
  if (!candidates.length) fail()
  const selected = candidates.sort((a, b) => b.rank - a.rank)[0]
  return (cp) => { const glyph = selected.glyph(cp); return glyph > 0 && glyph < glyphs }
}

function scriptSlot(character) {
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Bopomofo}]/u.test(character)) return 'fontEastAsian'
  if (/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(character)) return 'fontComplexScript'
  if (/[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}]/u.test(character)) return 'fontLatin'
  if (/[\p{Script=Common}\p{Script=Inherited}]/u.test(character)) return null
  return 'unsupported'
}
function scriptSegments(text, start = 0, precedingSlot) {
  const points = [...text], slots = points.map(scriptSlot), result = []
  let previous = precedingSlot ?? slots.find(Boolean) ?? 'fontLatin', offset = start
  for (let i = 0; i < points.length; i++) {
    const slot = slots[i] ?? previous, character = points[i]
    previous = slot
    const last = result.at(-1)
    if (last?.slot === slot) { last.text += character; last.end += character.length }
    else result.push({ text: character, start: offset, end: offset + character.length, slot })
    offset += character.length
  }
  return result
}
module.exports = { readFontCoverage, scriptSegments, TEXT_SHAPING_RESET }
