import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { fixture, slide } from './semantic-text-style-context-fixture'
import { requestTextFonts } from '../../shared/src/pptx-source-font-request-text'
import { requestChartFonts } from '../../shared/src/pptx-source-font-request-chart'
import { doc, node, run, val, W } from './omml-rendering-fixtures.js'

const require = createRequire(import.meta.url)
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { readSemanticTextStyleContext } = require('../../server/services/pptx-import/ooxml-semantic-text-context')
const source = { instanceId: 'i', componentId: 'body', part: slide, path: 'body' }
function capture() {
  const faces = [], issues = []
  return { source, faces, issues,
    add: (typeface, bold, italic, location) => faces.push({ typeface, bold, italic, location }),
    issue: (code, location) => issues.push({ code, location }) }
}
const text = (properties = {}) => ({ componentId: 'body', paragraphs: [{
  componentId: 'p', defaultRunProperties: {}, properties: {}, runs: [{
    componentId: 'r', kind: 'text', text: 'Source', properties,
  }],
}] })

describe('shared effective source font request boundary', () => {
  it('uses actual relationship-bound theme declarations and preserves explicit false', async () => {
    const zip = await fixture(), inventory = await buildSemanticInventory(zip)
    const occurrenceId = inventory.occurrences.find((o) => o.definitionId === `${slide}#shape:2`).id
    const context = await readSemanticTextStyleContext({ zip, inventory, occurrenceId })
    const result = capture()
    requestTextFonts(text({ italic: false }), { ...result, context })
    expect(result.issues).toEqual([])
    expect(result.faces).toEqual([expect.objectContaining({
      typeface: 'Minor', bold: false, italic: false,
    })])
    const explicit = capture()
    requestTextFonts(text({ fontLatin: { typeface: 'Exact Local' }, bold: true }), {
      ...explicit, context,
    })
    expect(explicit.faces[0]).toMatchObject({ typeface: 'Exact Local', bold: true, italic: false })
  })

  it('preserves paragraph/run identities rather than binding new runs to stale source indices', () => {
    const original = text({ fontLatin: { typeface: 'Original' } })
    const changed = structuredClone(original)
    changed.paragraphs[0].runs.unshift({ componentId: 'new', kind: 'text', text: 'Inserted', properties: {} })
    const context = { theme: { id: 'theme', source: { part: 'ppt/theme/theme1.xml', path: '0' } },
      paragraphs: [{ run: { target: {}, entries: [{
      id: 'list', kind: 'shapeList', source: { part: slide, path: '0' },
      properties: { fontLatin: { typeface: 'Inherited' } },
    }] }, runs: [{ layers: { target: {}, entries: [{
      id: 'old', kind: 'run', source: { part: slide, path: '0.0' },
      properties: { fontLatin: { typeface: 'Original' } },
    }, { id: 'list', kind: 'shapeList', source: { part: slide, path: '0' },
      properties: { fontLatin: { typeface: 'Inherited' } } }] } }] }] }
    const result = capture()
    requestTextFonts(changed, { ...result, sourceText: original, context })
    expect(result.faces.map((f) => f.typeface)).toEqual(['Inherited', 'Original'])
  })

  it('selects neutral characters across run boundaries using the source script font', () => {
    const document = text()
    document.paragraphs[0].defaultRunProperties = { fontComplexScript: { typeface: 'Declared Arabic' } }
    document.paragraphs[0].runs = [
      { componentId: 'neutral', text: '(', properties: {} },
      { componentId: 'arabic', text: 'مرحبا', properties: {} },
    ]
    const result = capture()
    requestTextFonts(document, result)
    expect(result.issues).toEqual([])
    expect(result.faces.map((f) => f.typeface)).toEqual(['Declared Arabic', 'Declared Arabic'])
  })

  it('includes an inherited source bullet face without substituting the text face', () => {
    const context = { theme: { id: 'theme', source: { part: 'ppt/theme/theme1.xml', path: '0' } },
      paragraphs: [{ runs: [], paragraph: { target: {}, entries: [{
        id: 'list', kind: 'shapeList', source: { part: slide, path: '0' },
        properties: { bullet: { kind: 'character', character: '\u2022' },
          bulletFont: { typeface: 'Bullet Source' } },
      }] } }] }
    const result = capture()
    requestTextFonts(text({ fontLatin: { typeface: 'Body Source' } }), { ...result, context })
    expect(result.issues).toEqual([])
    expect(result.faces.map((f) => f.typeface)).toEqual(['Body Source', 'Bullet Source'])
  })

  it('requests math AST faces and styles instead of treating an equation as empty ordinary text', () => {
    const document = text({ fontLatin: { typeface: 'Body' } })
    const math = doc(run('x', [node('rPr', [val('sty', 'bi')])]),
      run('y', [node('rPr', [val('nor', '1')]), node('rPr', [
        node('rFonts', [], [{ namespaceUri: W, name: 'ascii', value: 'Direct Math' }], W),
      ], [], W)]))
    document.paragraphs[0].runs.push({ componentId: 'equation', kind: 'equation',
      properties: { fontLatin: { typeface: 'Math Source' } }, ommlDocument: math })
    const result = capture()
    requestTextFonts(document, result)
    expect(result.issues).toEqual([])
    expect(result.faces.map(({ typeface, bold, italic }) => [typeface, bold, italic])).toEqual([
      ['Body', false, false], ['Math Source', true, true], ['Direct Math', false, false],
    ])
    expect(result.faces[1].location.componentId).toBe(math.root.children[0].children[1].componentId)
    expect(result.faces[2].location.componentId).toBe(math.root.children[1].children[2].componentId)
  })

  it('collects exact chart label cascade without inheriting unrelated title or axis fonts', () => {
    const document = { textStyle: { fontFamily: 'Root', bold: false, italic: false },
      title: { textStyle: { fontFamily: 'Title' } },
      axes: [{ id: 'x', textStyle: { fontFamily: 'Axis' }, title: { textStyle: { italic: true } } }],
      plots: [{ dataLabels: { textStyle: { fontFamily: 'Plot Labels', bold: true },
        labels: [{ index: 0, textStyle: { italic: true } }] },
      series: [{ id: 'series', dataLabels: { textStyle: { bold: false },
        labels: [{ index: 0, textStyle: { fontFamily: 'Point' } }] } }] }],
    }
    const result = capture()
    requestChartFonts(document, result)
    expect(result.issues).toEqual([])
    expect(result.faces.map(({ typeface, bold, italic }) => [typeface, bold, italic])).toEqual([
      ['Root', false, false], ['Title', false, false], ['Axis', false, false],
      ['Root', false, true], ['Plot Labels', false, false], ['Point', false, true],
    ])
  })
})
