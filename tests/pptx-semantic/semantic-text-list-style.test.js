import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { normalizeTextListStyle } = require('../../shared/src/pptx-text-list-style')
const entry = () => ({ componentId: 'declaration', source: { part: 'ppt/slides/slide1.xml', path: '0.0.2' },
  properties: { bold: false } })
const document = () => ({ schemaVersion: 1, componentId: 'list', entries: [
  { ...entry(), properties: { tabs: [] } },
  { ...entry(), componentId: 'level0', level: 0, properties: { level: 0 },
    defaultRunProperties: { bold: false, fontSizePt: 12, fontLatin: { typeface: '+mn-lt' },
      color: { kind: 'scheme', value: 'accent1' } } },
] })

describe('independent text list style normalizer', () => {
  it('keeps absent level distinct from zero, symbolic properties and JSON reopen', () => {
    const input = document(), before = JSON.stringify(input)
    const result = normalizeTextListStyle(input)
    expect(Object.hasOwn(result.entries[0], 'level')).toBe(false)
    expect(result.entries[1].level).toBe(0)
    expect(normalizeTextListStyle(JSON.parse(JSON.stringify(result)))).toEqual(input)
    result.entries[1].defaultRunProperties.fontSizePt = 24
    expect(JSON.stringify(input)).toBe(before)
  })

  it.each([
    (v) => { v.unknown = true },
    (v) => { v.entries[0].properties = { bold: false } },
    (v) => { v.entries[1].defaultRunProperties = { level: 0 } },
    (v) => { v.entries[1].level = 9 },
    (v) => { v.entries[1].level = null },
    (v) => { v.entries[1].componentId = v.entries[0].componentId },
    (v) => { v.entries.push({ ...v.entries[0], componentId: 'duplicate-default' }) },
    (v) => { v.entries[1].source.path = '0.bad' },
    (v) => { v.entries[1].properties = { level: 9 } },
    (v) => { Object.defineProperty(v, 'entries', { get() { throw new Error('getter ran') } }) },
  ])('rejects invalid contracts atomically %#', (mutate) => {
    const input = document()
    mutate(input)
    expect(() => normalizeTextListStyle(input)).toThrow()
  })
})
