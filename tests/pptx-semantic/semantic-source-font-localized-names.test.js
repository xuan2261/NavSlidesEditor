// @vitest-environment node
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { beforeAll, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  inspectSourceFont,
} = require('../../server/services/pptx-import/source-font-assets-metadata')
let regular
beforeAll(async () => {
  regular = await readFile('server/vendor/katex/dist/fonts/KaTeX_Main-Regular.ttf')
})

// Replace only the name table in memory. Coverage and outlines remain genuine;
// these are metadata parser fixtures, not physical-font qualification evidence.
function font(names, { bold = false, italic = false, tags = [] } = {}) {
  const records = [
    { id: 1, text: 'KaTeX_Main', language: 0x409 },
    ...names.map((item) => ({ id: 2, platform: 3, language: 0x409, ...item })),
  ]
  const header = 6 + records.length * 12 + (tags.length ? 2 + tags.length * 4 : 0)
  const strings = [...records.map((r) => r.text), ...tags].map((text, i) => {
    if (i < records.length && records[i].platform === 1) return Buffer.from(text, 'latin1')
    const bytes = Buffer.from(text, 'utf16le')
    return bytes.swap16()
  })
  const table = Buffer.alloc(header + strings.reduce((sum, bytes) => sum + bytes.length, 0))
  table.writeUInt16BE(tags.length ? 1 : 0, 0)
  table.writeUInt16BE(records.length, 2)
  table.writeUInt16BE(header, 4)
  let offset = 0
  records.forEach((record, index) => {
    const at = 6 + index * 12
    table.writeUInt16BE(record.platform ?? 3, at)
    table.writeUInt16BE(record.platform === 1 ? 0 : 1, at + 2)
    table.writeUInt16BE(record.language, at + 4)
    table.writeUInt16BE(record.id, at + 6)
    table.writeUInt16BE(strings[index].length, at + 8)
    table.writeUInt16BE(offset, at + 10)
    strings[index].copy(table, header + offset)
    offset += strings[index].length
  })
  if (tags.length) {
    const at = 6 + records.length * 12
    table.writeUInt16BE(tags.length, at)
    tags.forEach((_, index) => {
      const bytes = strings[records.length + index]
      table.writeUInt16BE(bytes.length, at + 2 + index * 4)
      table.writeUInt16BE(offset, at + 4 + index * 4)
      bytes.copy(table, header + offset)
      offset += bytes.length
    })
  }
  const start = Math.ceil(regular.length / 4) * 4
  const bytes = Buffer.alloc(start + table.length)
  regular.copy(bytes)
  table.copy(bytes, start)
  for (let index = 0; index < bytes.readUInt16BE(4); index++) {
    const at = 12 + index * 16
    const tag = bytes.toString('ascii', at, at + 4)
    const data = bytes.readUInt32BE(at + 8)
    if (tag === 'name') {
      bytes.writeUInt32BE(start, at + 8)
      bytes.writeUInt32BE(table.length, at + 12)
    } else if (tag === 'OS/2') {
      bytes.writeUInt16BE(bold ? 700 : 400, data + 4)
      bytes.writeUInt16BE(
        (bold ? 32 : 0) | (italic ? 1 : 0) | (!bold && !italic ? 64 : 0),
        data + 62
      )
    } else if (tag === 'head') bytes.writeUInt16BE((bold ? 1 : 0) | (italic ? 2 : 0), data + 44)
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length)
}

describe('language-bound physical font style declarations', () => {
  it.each([
    ['Regular', 'Normalny', false, false],
    ['Bold', 'Gras', true, false],
    ['Italic', 'Kursiv', false, true],
    ['Bold Italic', 'Gras italique', true, true],
  ])('retains localized metadata without translating %s', (text, localized, bold, italic) => {
    const result = inspectSourceFont(
      font([{ text }, { text: localized, language: 0x415 }], { bold, italic })
    )
    expect(result.reason).toBeNull()
    expect(result.metadata).toMatchObject({ bold, italic })
    expect(result.metadata.subfamilies).toContain(localized)
  })

  it.each([
    { text: 'Regular', language: 0x809 },
    { text: 'Regular', platform: 1, language: 0 },
    { text: 'Regular', platform: 0, language: 0 },
  ])('recognizes declared regional, Macintosh and neutral standard names %#', (record) => {
    expect(
      inspectSourceFont(font([record, { text: 'Normale', language: 0x410 }])).reason
    ).toBeNull()
  })

  it('resolves version one BCP47 language tags rather than guessing from translated text', () => {
    const result = inspectSourceFont(
      font(
        [
          { text: 'Regular', platform: 0, language: 0x8000 },
          { text: 'Normale', language: 0x8001 },
        ],
        { tags: ['en-GB', 'it'] }
      )
    )
    expect(result.reason).toBeNull()
    expect(result.metadata.subfamilies).toEqual(['Normale', 'Regular'])
  })

  it.each([
    [{ text: 'Normale', language: 0x410 }],
    [
      { text: 'Unknown', language: 0x409 },
      { text: 'Regular', language: 0x410 },
    ],
    [{ text: 'Regular' }, { text: 'Bold', language: 0x809 }],
    [{ text: 'Regular' }, { text: 'Bold', language: 0x407 }],
    [{ text: 'Regular' }, { text: 'Unknown', platform: 0, language: 0 }],
    [{ text: 'Regular', language: 0x8000 }],
  ])('rejects unproven, conflicting or unknown-language declarations %#', (...names) => {
    expect(inspectSourceFont(font(names)).reason).toBe('font-style-unsupported')
  })

  it('does not erase affirmative physical flags when localized names coexist', () => {
    expect(
      inspectSourceFont(
        font([{ text: 'Regular' }, { text: 'Normalny', language: 0x415 }], { bold: true })
      ).reason
    ).toBe('font-style-unsupported')
  })
})
