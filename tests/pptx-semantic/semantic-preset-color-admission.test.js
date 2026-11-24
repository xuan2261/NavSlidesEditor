import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { importTableFixture, tableFrame } from './table-import-fixture'
import { options } from './semantic-table-renderer-fixtures'

const require = createRequire(import.meta.url)
const { parseXml } = require('../../server/services/pptx-import/ooxml-text-run-xml')
const { tableSource } = require('../../server/services/pptx-import/ooxml-semantic-table-source')
const { readTableColor } = require('../../server/services/pptx-import/ooxml-semantic-table-properties')
const { normalizeTextProperties } = require('../../shared/src/pptx-text-document')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { resolveProperty } = require('../../shared/src/pptx-style-resolution')
const { resolveGeometryColorPaint } = require('../../shared/src/pptx-geometry-color')
const { renderSemanticTable } = require('../../shared/src/pptx-table-renderer')
const { shapeLabelSvgString } = require('../../shared/src/pptx-shape-label')
const { paint } = require('../../shared/src/pptx-table-render-paint')

function sourceColor(inner) {
  const xml = `<a:solidFill xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${inner}</a:solidFill>`
  const node = parseXml(xml)[0]
  const source = { id: 'table', partUri: 'ppt/slides/slide33.xml',
    preconditionHash: createHash('sha256').update(xml).digest('hex'), componentLocators: [{ path: [0] }] }
  return readTableColor(node.children[0], tableSource({ source, node, xml,
    components: [], nodes: new Map([[source.id, node]]) }))
}
const resolve = (color, theme) => resolveProperty({ property: 'color', scope: 'run',
  ...(theme ? { theme } : {}), layers: { target: {}, entries: [{ id: 'source', kind: 'run',
    source: { part: 'ppt/slides/slide33.xml', path: '0.0.0.6.2.7.37.0.0.0' }, properties: { color } }] } })

describe('typed DrawingML preset source color admission and production paint', () => {
  it('preserves preset identity and ordered transforms instead of converting source to RGB', () => {
    const color = sourceColor('<a:prstClr val="black"><a:tint val="50000"/><a:alpha val="25000"/></a:prstClr>')
    expect(color).toEqual({ kind: 'preset', value: 'black', transforms: [
      { kind: 'tint', value: 50000 }, { kind: 'alpha', value: 25000 },
    ] })
    const saved = normalizeTextProperties(JSON.parse(JSON.stringify({ color })), 'run')
    expect(saved.color).toEqual(color)
    saved.color.transforms[0].value = 0
    expect(color.transforms[0].value).toBe(50000)
    expect(resolve(color).resolved).toEqual({ rgb: '808080', alpha: 0.25 })
    expect(resolve(color).authored).toEqual(color)
  })

  it.each(['black', 'dkBlue', 'ltGoldenrodYellow', 'red'])('reuses the geometry preset resolver for %s', (value) => {
    const color = { kind: 'preset', value }
    expect(resolve(color).resolved).toEqual(resolveGeometryColorPaint(color))
  })

  it('leaves scheme remapping and alpha behavior intact', () => {
    const theme = { id: 'theme', source: { part: 'ppt/theme/theme1.xml', path: '0' }, colors: { dk1: '123456' }, colorMap: { tx1: 'dk1' } }
    expect(resolve({ kind: 'scheme', value: 'tx1', transforms: [{ kind: 'alpha', value: 50000 }] }, theme).resolved)
      .toEqual({ rgb: '123456', alpha: 0.5 })
    expect(resolve({ kind: 'scheme', value: 'accent6' }, theme).unsupportedReason).toBe('missing-theme-color')
  })

  it.each([
    '<a:prstClr/>', '<a:prstClr val="Black"/>', '<a:prstClr val="rebeccapurple"/>',
    '<a:prstClr val="toString"/>', '<a:prstClr val="black" unexpected="1"/>',
    '<a:prstClr val="black"><a:alpha val="100001"/></a:prstClr>',
    '<a:prstClr val="black"><a:tint/></a:prstClr>',
    '<a:prstClr val="black"><a:unknown/></a:prstClr>',
    '<a:prstClr val="black"><bad:alpha xmlns:bad="urn:wrong" val="1"/></a:prstClr>',
  ])('rejects malformed source declarations with located errors: %s', (xml) => {
    expect(() => sourceColor(xml)).toThrow()
    try { sourceColor(xml) } catch (error) {
      expect(error).toMatchObject({ code: 'PPTX_SEMANTIC_ADMISSION_FAILED',
        sourceLocation: { partUri: 'ppt/slides/slide33.xml' } })
    }
  })

  it('projects, saves/reopens, and paints preset cell text/fill/border through the production SVG renderer', async () => {
    const graphic = tableFrame()
      .replaceAll('<a:rPr sz="1200"/>', '<a:rPr sz="1200"><a:solidFill><a:prstClr val="red"><a:alpha val="50000"/></a:prstClr></a:solidFill></a:rPr>')
      .replace('<a:tcPr/>', '<a:tcPr><a:solidFill><a:prstClr val="dkBlue"/></a:solidFill><a:lnT w="19050"><a:solidFill><a:prstClr val="black"/></a:solidFill></a:lnT></a:tcPr>')
    const { presentation } = await importTableFixture({ graphic })
    const definition = Object.values(presentation.pptxSemantic.definitions).find((d) => d.content.tableDocument)
    const table = definition.content.tableDocument
    expect(table.rows[0].cells[0].textDocument.paragraphs[0].runs[0].properties.color)
      .toEqual({ kind: 'preset', value: 'red', transforms: [{ kind: 'alpha', value: 50000 }] })
    const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(presentation)))
    expect(reopened.pptxSemantic.definitions[definition.id].content.tableDocument).toEqual(table)
    const before = JSON.stringify(table)
    const svg = renderSemanticTable(table, options())
    expect(svg).toContain('fill="#FF0000" fill-opacity="0.5"')
    expect(svg).toContain('fill="#00008B"')
    expect(svg).toContain('stroke="#000000"')
    expect(renderSemanticTable(reopened.pptxSemantic.definitions[definition.id].content.tableDocument, options())).toBe(svg)
    expect(JSON.stringify(table)).toBe(before)
  })

  it('paints preset shape text and resolves table non-text transforms without mutating source', () => {
    const color = { kind: 'preset', value: 'red', transforms: [{ kind: 'alpha', value: 50000 }] }
    const text = { schemaVersion: 1, componentId: 'body', paragraphs: [{ componentId: 'p', runs: [
      { componentId: 'r', kind: 'text', text: 'Preset', properties: { color } },
    ] }] }
    const before = JSON.stringify(text)
    const markup = shapeLabelSvgString({ width: 100, height: 40, pptxTextDocument: text })
    expect(markup).toContain('color:rgba(255,0,0,0.5)')
    expect(paint(color, {}, 'cell', 'fill.color')).toEqual({ value: '#FF0000', alpha: 0.5 })
    expect(JSON.stringify(text)).toBe(before)
  })
})
