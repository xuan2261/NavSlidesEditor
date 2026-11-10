// @vitest-environment jsdom
// Synthetic render contract evidence, not native typography qualification.
import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ShapeRenderer } from '../../client/src/components/canvas/element-renderers/shape-element-renderer'
import tree from '../../shared/src/pptx-semantic-render-tree.js'
import shapes from '../../shared/src/shapeUtils.js'
import elements from '../../shared/src/element-renderers.js'
import geometryCore from '../../shared/src/pptx-geometry-document.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { inheritedGeometryStyleFixture } from './geometry-style-fixture.js'

const text = (value = 'Native <&> label') => ({
  schemaVersion: 1, componentId: 'body', body: {},
  paragraphs: [{ componentId: 'paragraph', runs: [{
    componentId: 'run', kind: 'text', text: value,
    properties: { fontSizePt: 5.125, bold: true, italic: true, language: 'vi-VN',
      fontLatin: { typeface: 'Arial' } },
  }] }],
})
function bindText(definition, document = text()) {
  definition.content.textDocument = document
  definition.components.push({ id: 'body', kind: 'property',
    locator: { path: [0, 0, 20], preconditionHash: 'a'.repeat(64) } })
}
function fixture() {
  const presentation = geometryProjectionFixture()
  const definition = presentation.pptxSemantic.definitions.definition
  bindText(definition)
  Object.assign(definition.content.geometry, {
    width: 914400, height: 457200,
    textRect: { l: -91440, t: 45720, r: 640080, b: 365760 },
  })
  for (const slide of presentation.slides) Object.assign(slide.elements[0], {
    width: 96, height: 48, text: 'STALE plain', textHtml: '<b>STALE html</b>',
    fontSize: 100, _pptxImportMeta: { fitFontSizePx: 1, textInsets: { left: 96 } },
  })
  return presentation
}
function dom(html) {
  const root = document.createElement('div')
  root.innerHTML = html
  return root
}
const label = (root) => root.querySelector('[data-pptx-shape-label="body"]')
const canvas = (element) => renderToStaticMarkup(React.createElement(ShapeRenderer, { element }))

describe('canonical geometry label render seam', () => {
  it('selects only the occurrence text override and preserves source and sibling documents', () => {
    const presentation = fixture(), model = presentation.pptxSemantic
    model.instances.i1.overrides.components = { body: { textDocument: text('Edited') } }
    const before = JSON.stringify(presentation)
    expect(tree.semanticRenderTree(model, presentation.slides[0])[0].element.pptxTextDocument)
      .toEqual(text('Edited'))
    expect(tree.semanticRenderTree(model, presentation.slides[1])[0].element.pptxTextDocument)
      .toEqual(text())
    expect(JSON.stringify(presentation)).toBe(before)
  })
  it('resolves own text independently of the linked geometry provider in schema 2', () => {
    const presentation = fixture(), model = inheritedGeometryStyleFixture()
    bindText(model.definitions.definition, text('Provider must not supply label'))
    bindText(model.definitions.local1, text('Own source'))
    bindText(model.definitions.local2, text('Sibling source'))
    model.instances.i1.overrides.components = { body: { textDocument: text('Own override') } }
    const before = JSON.stringify(model)
    expect(tree.semanticRenderTree(model, presentation.slides[0])[0].element.pptxTextDocument)
      .toEqual(text('Own override'))
    expect(tree.semanticRenderTree(model, presentation.slides[1])[0].element.pptxTextDocument)
      .toEqual(text('Sibling source'))
    expect(JSON.stringify(model)).toBe(before)
  })
  it.each([['SVG', shapes.shapeSvgString], ['Canvas', canvas]])(
    '%s prefers canonical labels over stale caches without fitting or changing geometry', (_, render) => {
      const presentation = fixture()
      const element = tree.semanticRenderTree(presentation.pptxSemantic, presentation.slides[0])[0].element
      const before = JSON.stringify(element), root = dom(render(element))
      expect(label(root)).not.toBeNull()
      expect(label(root).textContent).toBe('Native <&> label')
      expect(root.textContent).not.toContain('STALE')
      expect(label(root).querySelector('span').style.fontSize).toBe('5.125pt')
      expect(label(root).querySelector('span').style.fontWeight).toBe('bold')
      expect(label(root).querySelector('span').style.fontStyle).toBe('italic')
      expect(label(root).querySelector('span').getAttribute('lang')).toBe('vi-VN')
      expect(label(root).innerHTML).not.toMatch(/<script|anywhere|font-size:\s*1px/)
      const rect = label(root).querySelector('foreignObject')
      for (const [key, value] of Object.entries({ x: -9.6, y: 4.8, width: 76.8, height: 33.6 }))
        expect(Number(rect.getAttribute(key))).toBeCloseTo(value, 10)
      expect(label(root).getAttribute('transform')).toBe('matrix(1 0 0 1 0 0)')
      expect(JSON.stringify(element)).toBe(before)
    })
  it('keeps nonuniform scale local and the occurrence reflection outside the label', () => {
    const presentation = fixture(), slide = presentation.slides[0]
    Object.assign(slide.elements[0], { width: 192, height: 144 })
    const root = dom(elements.renderSlideElements(slide, { pptxSemantic: presentation.pptxSemantic }))
    const transform = label(root)?.getAttribute('transform').slice(7, -1).split(' ').map(Number)
    expect(transform?.[0]).toBeCloseTo(2, 12)
    expect(transform?.[3]).toBeCloseTo(3, 12)
    expect(root.querySelector('[data-pptx-instance-id="i1"]').style.transform)
      .toBe('matrix(-1,0,0,1,100,0)')
    expect(label(root).querySelector('span').style.fontSize).toBe('5.125pt')
  })
  it.each([[0, 457200, 0, 48], [914400, 0, 96, 0], [0, 0, 0, 0]])(
    'preserves authored text ranges on zero geometry axes %i/%i', (gw, gh, width, height) => {
      const presentation = fixture()
      const element = { ...presentation.slides[0].elements[0], width, height,
        pptxTextDocument: text(),
        pptxGeometry: { ...presentation.pptxSemantic.definitions.definition.content.geometry,
          width: gw, height: gh } }
      const root = dom(shapes.shapeSvgString(element))
      expect(label(root)?.getAttribute('transform')).toBe('matrix(1 0 0 1 0 0)')
      expect(Number(label(root).querySelector('foreignObject').getAttribute('width'))).toBeCloseTo(76.8)
      expect(root.innerHTML).not.toMatch(/NaN|Infinity/)
    })
  it('renders typed native edits, breaks, fields and empty paragraphs without mutating metadata', () => {
    const document = text('<script>alert("x")</script>')
    document.body = { insetLeftEmu: -9525, insetTopEmu: 19050, wrap: false }
    document.paragraphs[0].properties = { alignment: 'r', lineSpacing: { unit: 'points', value: 9.125 } }
    document.paragraphs[0].runs[0].properties = { fontSizePt: 5.125, underline: 'sng',
      strike: 'sngStrike', color: { kind: 'srgb', value: '123456' },
      fontLatin: { typeface: 'A";color:red;/*' } }
    document.paragraphs[0].runs.push({ componentId: 'break', kind: 'break' },
      { componentId: 'field', kind: 'field', text: '42', field: { id: '{native}', type: 'slidenum' } })
    document.paragraphs.push({ componentId: 'empty', runs: [], endRunProperties: { fontSizePt: 7 } })
    const element = { width: 96, height: 48, pptxTextDocument: document,
      pptxGeometry: fixture().pptxSemantic.definitions.definition.content.geometry }
    const before = JSON.stringify(element), root = dom(shapes.shapeSvgString(element))
    expect(label(root)?.textContent).toBe('<script>alert("x")</script>42')
    expect(label(root).querySelector('script')).toBeNull()
    expect(label(root).querySelectorAll('br')).toHaveLength(2)
    expect(label(root).querySelector('p').style.textAlign).toBe('right')
    expect(label(root).querySelector('p').style.lineHeight).toBe('9.125pt')
    expect(label(root).querySelector('span').style.color).toBe('rgb(18, 52, 86)')
    expect(label(root).querySelector('span').style.textDecoration).toBe('underline line-through')
    expect(label(root).querySelector('[data-pptx-text-body]').style.left).toBe('-1px')
    expect(JSON.stringify(element)).toBe(before)
  })
  it.each([[[]], [[{ componentId: 'p', runs: [] }]]])('keeps an empty canonical label authoritative', (paragraphs) => {
    const element = { width: 96, height: 48, textHtml: '<b>STALE</b>',
      pptxTextDocument: { schemaVersion: 1, componentId: 'body', paragraphs } }
    expect(dom(shapes.shapeSvgString(element)).textContent).toBe('')
    expect(dom(canvas(element)).textContent).toBe('')
  })
  it.each([
    [{ kind: 'alpha', value: 50000 }, 'rgba(0, 0, 0, 0.5)'],
    [{ kind: 'tint', value: 50000 }, 'rgb(128, 128, 128)'],
  ])('uses text color transforms once per effective run: %j', (transform, expected) => {
    const document = text('styled')
    document.paragraphs[0].defaultRunProperties = {
      color: { kind: 'srgb', value: '000000', transforms: [transform] },
    }
    const root = dom(shapes.shapeSvgString({ width: 96, height: 48, pptxTextDocument: document }))
    expect(root.querySelector('p').style.opacity).toBe('')
    expect(root.querySelector('span').style.opacity).toBe('')
    expect(root.querySelector('span').style.color).toBe(expected)
  })
  it('lets an explicit run remove paragraph-default underline and strike', () => {
    const document = text('undecorated')
    document.paragraphs[0].defaultRunProperties = { underline: 'sng', strike: 'sngStrike' }
    document.paragraphs[0].runs[0].properties = { underline: 'none', strike: 'noStrike' }
    const root = dom(shapes.shapeSvgString({ width: 96, height: 48, pptxTextDocument: document }))
    expect(root.querySelector('p').style.textDecoration).toBe('')
    expect(root.querySelector('span').style.textDecoration).toBe('none')
  })
  it('uses the existing geometry domain when no source text rectangle was authored', () => {
    const presentation = fixture(), geometry = presentation.pptxSemantic.definitions.definition.content.geometry
    delete geometry.textRect
    const before = JSON.stringify(geometry)
    const root = dom(shapes.shapeSvgString({ width: 96, height: 48, pptxGeometry: geometry, pptxTextDocument: text() }))
    const rect = label(root)?.querySelector('foreignObject')
    expect(rect?.getAttribute('width')).toBe('96')
    expect(rect?.getAttribute('height')).toBe('48')
    expect(JSON.stringify(geometry)).toBe(before)
  })
  it('keeps geometry paths identical when only text changes and legacy labels unchanged', () => {
    const element = { width: 96, height: 48, textHtml: '<b>Legacy</b>',
      pptxGeometry: fixture().pptxSemantic.definitions.definition.content.geometry }
    const legacy = dom(shapes.shapeSvgString(element))
    const canonical = dom(shapes.shapeSvgString({ ...element, pptxTextDocument: text('Edited') }))
    expect(canonical.querySelector('path').outerHTML).toBe(legacy.querySelector('path').outerHTML)
    expect(legacy.querySelector('foreignObject b').textContent).toBe('Legacy')
    expect(label(legacy)).toBeNull()
    expect(geometryCore.deriveGeometryPaths(element.pptxGeometry).textRect)
      .toEqual(element.pptxGeometry.textRect)
  })
})
