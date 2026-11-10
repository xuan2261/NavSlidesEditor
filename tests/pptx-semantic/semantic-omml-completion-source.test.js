import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { doc, node, run, A, M, options } from './omml-rendering-fixtures.js'

const require = createRequire(import.meta.url)
const { renderOmmlDocument } = require('../../shared/src/pptx-omml-renderer')
const api = () => require('../../shared/src/pptx-omml-source-style.js')
const attr = (name, value, namespaceUri = '') => ({ name, value, namespaceUri })
const textDefaults = { run: {
  fontLatin: { typeface: 'Declared Math' }, fontSizePt: 18,
  color: { kind: 'srgb', value: '123456' }, bold: false, italic: false,
} }
it('uses the same effective source declarations for inventory and layout without a fallback face', () => {
  const input = doc(run('x'))
  expect(api().collectOmmlFontRequests(input, { textDefaults })).toEqual([{
    componentId: input.root.children[0].children[0].componentId, path: [0, 0],
    fontFamily: 'Declared Math', bold: false, italic: false,
  }])
  expect(api().resolveOmmlSourceStyle({ textDefaults })).toMatchObject({
    fontFamily: 'Declared Math', fontSize: 24, color: '#123456', italic: false,
  })
  expect(() => api().collectOmmlFontRequests(input)).toThrow(/font declaration/)
})
it('resolves run and control declarations and paragraph defaults with precise identities', () => {
  const styled = run('x', [node('rPr', [
    node('latin', [], [attr('typeface', '+mj-lt')], A),
  ], [attr('b', '1'), attr('i', '0')], A)])
  const input = doc(node('f', [
    node('fPr', [node('ctrlPr', [node('rPr', [
      node('latin', [], [attr('typeface', 'Control Math')], A),
    ], [attr('i', '0')], A)])]),
    node('num', [styled]), node('den', [run('y')]),
  ]))
  const requests = api().collectOmmlFontRequests(input, {
    textDefaults, mathFrame: { paragraph: { defaultRunProperties: {
      fontLatin: { typeface: 'Paragraph Math' },
    } }, endParagraphProperties: { fontLatin: { typeface: 'Not a paragraph default' } } },
    theme: { fonts: { major: { latin: 'Theme Math' } } },
  })
  expect(requests.map(({ fontFamily, bold, italic }) => ({ fontFamily, bold, italic }))).toEqual([
    { fontFamily: 'Control Math', bold: false, italic: false },
    { fontFamily: 'Theme Math', bold: true, italic: false },
    { fontFamily: 'Paragraph Math', bold: false, italic: false },
  ])
})
it('accepts explicit run-only source fonts and fails unresolved themes at the source node', () => {
  const input = doc(run('x', [node('rPr', [
    node('latin', [], [attr('typeface', '+mn-lt')], A),
  ], [], A)]))
  const runId = input.root.children[0].children[0].children[0].componentId
  expect(() => api().collectOmmlFontRequests(input)).toThrow(/theme font/)
  try { api().collectOmmlFontRequests(input) } catch (error) {
    expect(error.componentId).toBe(runId)
    expect(error.path).toEqual([0, 0, 0])
  }
  expect(api().collectOmmlFontRequests(input, {
    theme: { fonts: { minor: { latin: 'Explicit Theme Face' } } },
  })[0].fontFamily).toBe('Explicit Theme Face')
})
it('retains explicit math style in font inventory instead of silently resetting to italic', () => {
  const input = doc(run('A', [node('rPr', [
    node('sty', [], [attr('val', 'p', M)]),
  ])]))
  expect(api().collectOmmlFontRequests(input, { textDefaults })[0]).toMatchObject({
    bold: false, italic: false,
  })
})
it('keeps physical requests independent from color, size and non-font rendering support', () => {
  const input = doc(run('x', [node('rPr', [
    node('solidFill', [node('schemeClr', [], [attr('val', 'accent1')], A)], [], A),
  ], [attr('sz', '2400'), attr('spc', '100')], A)]))
  const plain = doc(run('x'))
  const defaults = { run: { ...textDefaults.run, fontSizePt: undefined,
    color: { kind: 'scheme', value: 'accent1', transforms: [{ kind: 'alpha', value: 50000 }] } } }
  const request = api().collectOmmlFontRequests(input, { textDefaults: defaults })[0]
  const baseline = api().collectOmmlFontRequests(plain, { textDefaults })[0]
  expect(request).toMatchObject({ fontFamily: baseline.fontFamily, bold: baseline.bold, italic: baseline.italic })
  expect(() => api().resolveOmmlSourceStyle({ textDefaults: defaults })).toThrow(/color/)
})
it('does not request a shadowed inherited theme declaration', () => {
  const input = doc(run('x', [node('rPr', [
    node('latin', [], [attr('typeface', 'Explicit Face')], A),
  ], [], A)]))
  const defaults = { run: { fontLatin: { typeface: '+mj-lt' } } }
  expect(api().collectOmmlFontRequests(input, { textDefaults: defaults })[0].fontFamily).toBe('Explicit Face')
})

it.each([
  ['1C5E29', [['lumMod', '50000']], '#0E2F15'],
  ['808080', [['lumMod', '50000'], ['lumOff', '25000']], '#808080'],
  ['808080', [['lumOff', '25000'], ['lumMod', '50000']], '#606060'],
  ['1C5E29', [['lumMod', '50000'], ['alpha', '50000'], ['alphaMod', '50000']], 'rgba(14,47,21,0.25)'],
])('paints ordered source OMML color %s transforms %j without mutating declarations', (hex, transforms, expected) => {
  const color = node('srgbClr', transforms.map(([type, value]) => node(type, [], [attr('val', value)], A)), [attr('val', hex)], A)
  const input = doc(run('x', [node('rPr', [node('solidFill', [color], [], A)], [], A)]))
  const before = structuredClone(input)
  const result = renderOmmlDocument(input, options)
  expect(result.svg).toContain(`fill="${expected}"`)
  expect(input).toEqual(before)
})

it.each(['dirty', 'err', 'smtClean'])('keeps proofing %s in the source without changing glyph geometry or paint', name => {
  const input = doc(run('x', [node('rPr', [], [attr(name, '0')], A)]))
  const plain = structuredClone(input)
  plain.root.children[0].children[0].attributes = []
  const before = structuredClone(input)
  expect(renderOmmlDocument(input, options).svg).toBe(renderOmmlDocument(plain, options).svg)
  expect(input).toEqual(before)
})
