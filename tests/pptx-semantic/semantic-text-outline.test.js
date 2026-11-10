// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { normalizeTextProperties } from '../../shared/src/pptx-text-document'
import { resolveProperty } from '../../shared/src/pptx-style-resolution'
import { textBoxSvgString } from '../../shared/src/pptx-textbox-svg'
import { sanitizeRichTextHtml } from '../../shared/src/content-safety'
import { textDocumentHtml } from '../../shared/src/pptx-shape-label'
import { textOutlinePaint } from '../../shared/src/pptx-text-outline'

const ink = { kind: 'srgb', value: 'FF0000', transforms: [{ kind: 'alpha', value: 50000 }] }
const outline = { width: 19050, fill: 'solid', color: ink, compound: 'sng', alignment: 'ctr', dash: { kind: 'preset', value: 'solid' } }
const source = (properties = {}, defaults = {}) => ({ schemaVersion: 1, componentId: 'body', body: {}, paragraphs: [
  { componentId: 'p', defaultRunProperties: defaults, runs: [{ componentId: 'r', kind: 'text', text: 'Editable M', properties }] },
] })
const markup = (properties, defaults, body = {}) => textBoxSvgString({ width: 300, height: 100,
  pptxTextDocument: { ...source(properties, defaults), body } })

describe('editable text outline paint contract', () => {
  it('retains bounded outline CSS through compatibility sanitization and rejects unpaintable values', () => {
    const safe = sanitizeRichTextHtml(textDocumentHtml(source({ outline })))
    expect(safe).toContain('-webkit-text-stroke-width')
    expect(safe).toContain('-webkit-text-stroke-color')
    for (const value of ['-1px', '2113px', 'url(x)', '999999999999999999px'])
      expect(sanitizeRichTextHtml(`<span style="-webkit-text-stroke-width:${value}">M</span>`))
        .not.toContain('-webkit-text-stroke-width')
    for (const value of ['url(x)', 'rgba(999,0,0,1)', 'rgba(1,2,3,4)'])
      expect(sanitizeRichTextHtml(`<span style="-webkit-text-stroke-color:${value}">M</span>`))
        .not.toContain('-webkit-text-stroke-color')
  })
  it('paints a centered solid outline on retained text, scales EMU with autofit and retains fill', () => {
    const html = markup({ outline, color: { kind: 'srgb', value: '0000FF' } }, {},
      { autofit: { mode: 'normal', fontScale: 50000 } })
    expect(html).toContain('-webkit-text-stroke-width:1px')
    expect(html).toContain('-webkit-text-stroke-color:rgba(255,0,0,0.5)')
    expect(html).toContain('color:rgba(0,0,255,1)')
    expect(html).toContain('Editable M</span>')
    expect(html).not.toMatch(/<image|<path/)
  })
  it('preserves noFill and authored absence/zero; direct noFill defeats inherited stroke', () => {
    const none = { fill: 'none', color: { kind: 'none' } }
    expect(markup({ outline: none }, { outline })).toContain('-webkit-text-stroke-width:0px')
    expect(markup({ outline: { color: ink } })).toContain('-webkit-text-stroke-width:0px')
    expect(markup({ outline: { ...outline, width: 0 } })).toContain('-webkit-text-stroke-width:0px')
    expect(normalizeTextProperties({ outline: {} }, 'run')).toEqual({ outline: {} })
    expect(normalizeTextProperties({ outline: none }, 'run')).toEqual({ outline: none })
  })
  it.each([
    { fill: { kind: 'solid', surprise: true } }, { dash: 'nonsense' },
    { dash: { kind: 'preset', value: 'solid', surprise: true } },
    { dash: { kind: 'custom', stops: [{ dash: 1, space: 1 }] } },
    { compound: 'dbl' }, { alignment: 'in' },
    { join: { kind: 'round', limit: 10 } }, { headEnd: { type: 'triangle', w: 'med', len: 'med' } },
    { fill: 'none', color: ink }, { fill: 'solid', color: { kind: 'none' } },
  ])('rejects malformed or unadmitted outline declarations: %j', (declaration) => {
    expect(() => normalizeTextProperties({ outline: { ...outline, ...declaration } }, 'run')).toThrow(/text contract/)
  })
  it.each([
    [{ dash: { kind: 'preset', value: 'dash' } }, 'unsupported-text-outline-dash'],
    [{ join: { kind: 'bevel' } }, 'unsupported-text-outline-join'],
    [{ join: { kind: 'miter', limit: 80000 } }, 'unsupported-text-outline-join'],
  ])('fails closed only for visible unsupported outline ink: %j', (declaration, code) => {
    const authored = { ...outline, ...declaration }
    expect(normalizeTextProperties({ outline: authored }, 'run').outline).toEqual(authored)
    expect(() => textOutlinePaint(authored)).toThrow(expect.objectContaining({ code }))
    expect(() => markup({ outline: authored })).toThrow(expect.objectContaining({ code }))
    expect(textOutlinePaint({ ...authored, width: 0 })).toEqual({ width: 0, color: 'transparent' })
    expect(textOutlinePaint({ ...authored, fill: 'none', color: { kind: 'none' } }))
      .toEqual({ width: 0, color: 'transparent' })
  })
  it('deep-clones nested declarations and resolves scheme alpha with normal inherited precedence', () => {
    const normalized = normalizeTextProperties({ outline }, 'run')
    normalized.outline.color.transforms[0].value = 100
    expect(ink.transforms[0].value).toBe(50000)
    const inherited = { ...outline, color: { kind: 'scheme', value: 'accent1', transforms: [{ kind: 'alpha', value: 25000 }] } }
    const layers = { target: {}, entries: [
      { id: 'base', kind: 'paragraph', source: { part: 'master', path: 'p' }, properties: { outline: inherited } },
      { id: 'run', kind: 'run', source: { part: 'slide', path: 'r' }, properties: {} },
    ] }
    const theme = { id: 'theme', source: { part: 'theme', path: 't' }, colors: { accent1: '123456' } }
    expect(resolveProperty({ property: 'outline', scope: 'run', layers, theme }).resolved.color).toEqual({
      kind: 'srgb', value: '123456', transforms: [{ kind: 'alpha', value: 25000 }],
    })
    layers.entries[1].properties.outline = { fill: 'none', color: { kind: 'none' } }
    expect(resolveProperty({ property: 'outline', scope: 'run', layers, theme }).resolved).toEqual(layers.entries[1].properties.outline)
  })
})
