// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { layoutTextDocument } from '../../shared/src/pptx-text-layout.js'
const require = createRequire(import.meta.url)
const { renderMeasuredTextLines } = require('../../shared/src/pptx-text-layout-render.js')

const face = { id: 'main', typeface: 'Fixture Main', assetHash: 'd0332f52868370fd83ae7fa46470f90c8f2eab2fcf12bc4f88080b340c95a830' }
function measuredDocument() {
  const input = {
    document: { schemaVersion: 1, componentId: 'body',
      body: { insetLeftEmu: 0, insetRightEmu: 0, insetTopEmu: 0, insetBottomEmu: 0,
        wrap: false, verticalText: 'horz', verticalAlign: 't', autofit: { mode: 'none' } },
      paragraphs: [{ componentId: 'p', defaultRunProperties: { fontSizePt: 12,
        fontLatin: { typeface: face.typeface } }, runs: [
        { componentId: 'r1', kind: 'text', text: 'M' },
        { componentId: 'br', kind: 'break' },
        { componentId: 'r2', kind: 'field', text: '42', field: { id: 'slide', type: 'sldNum' }, properties: { fontSizePt: 24 } },
      ] }],
    },
    shape: { widthEmu: 1905000, heightEmu: 952500,
      textRectEmu: { l: 9525, t: 19050, r: 1809750, b: 933450 } },
    fontProfile: { schemaVersion: 1, faces: [face] },
    rendererProfile: { id: 'pptx-explicit-lines-v1', sessionId: 'fixture', userAgent: 'fixture',
      platform: 'fixture', language: 'en-US', devicePixelRatio: 1 },
  }
  const measurement = {
    validate: () => null,
    measureLine: ({ items }) => {
      const text = items.filter((item) => item.kind !== 'strut')
      const runs = text.map((item, index) => ({ ...item, faceId: 'main', sourceFontSizePt: item.properties.fontSizePt,
        fontSizePt: item.properties.fontSizePt, baseline: 12, rects: [{ x: index * 8, y: 0, width: 8, height: 16 }] }))
      return { issues: [], width: runs.length * 8, height: 16, baseline: 12, startX: 0, runs }
    },
  }
  return { input, layout: layoutTextDocument(input, measurement) }
}

describe('measured text line projection', () => {
  it('paints explicit lines at measured positions and retains source run and field identities', () => {
    const { input, layout } = measuredDocument()
    expect(layout).toMatchObject({ status: 'measured', qualified: false, issues: [] })
    const markup = renderMeasuredTextLines(input, layout, (run, source) =>
      `<span data-component="${run.componentId}" data-field="${source?.field?.id ?? ''}" ` +
      `style="font-size:${run.fontSizePt}pt">${run.text}</span>`)
    
    const root = document.createElement('div')
    root.innerHTML = markup
    const lines = [...root.querySelectorAll('[data-pptx-text-layout-line]')]
    expect(lines).toHaveLength(2)
    expect(lines[0].style.left).toBe('0px')
    expect(lines[0].style.top).toBe('0px')
    expect(lines[0].querySelector('[data-component="r1"]').style.fontSize).toBe('12pt')
    expect(lines[1].querySelector('[data-component="r2"]').dataset.field).toBe('slide')
    expect(lines[1].querySelector('[data-component="r2"]').style.fontSize).toBe('24pt')
    expect(lines[1].querySelector('[data-pptx-text-run="br"]')).toBeNull()
  })

  it('rejects stale layout identities rather than painting coordinates from a different source document', () => {
    const { input, layout } = measuredDocument()
    input.document.paragraphs[0].runs[0].text = 'changed'
    expect(() => renderMeasuredTextLines(input, layout, () => 'stale')).toThrow(/identity/i)
  })

  it('refuses layouts claiming native qualification', () => {
    const { input, layout } = measuredDocument()
    const forged = { ...layout, qualified: true }
    expect(() => renderMeasuredTextLines(input, forged, () => 'span')).toThrow(TypeError)
  })

  it('renders measured tabs and bullets with exact offsets and baseline markers', () => {
    const input = {
      document: {
        schemaVersion: 1, componentId: 'body',
        body: { insetLeftEmu: 0, insetRightEmu: 0, insetTopEmu: 0, insetBottomEmu: 0,
          wrap: false, verticalText: 'horz', verticalAlign: 't', autofit: { mode: 'none' } },
        paragraphs: [{
          componentId: 'p1',
          properties: { marginLeftEmu: 95250, indentEmu: -95250, bullet: { kind: 'character', character: '\u2022' },
            tabs: [{ positionEmu: 914400, alignment: 'l' }] },
          defaultRunProperties: { fontSizePt: 12, fontLatin: { typeface: face.typeface } },
          runs: [{ componentId: 'r1', kind: 'text', text: 'A\tB' }],
        }],
      },
      shape: { widthEmu: 1905000, heightEmu: 952500,
        textRectEmu: { l: 0, t: 0, r: 1905000, b: 952500 } },
      fontProfile: { schemaVersion: 1, faces: [face] },
      rendererProfile: { id: 'pptx-explicit-lines-v1', sessionId: 'fixture', userAgent: 'fixture',
        platform: 'fixture', language: 'en-US', devicePixelRatio: 1 },
    }
    const measurement = {
      validate: () => null,
      measureLine: ({ items, startX }) => {
        const runs = items.map((item, idx) => ({
          ...item, faceId: 'main', sourceFontSizePt: 12, fontSizePt: 12, baseline: 10,
          rects: [{ x: startX + idx * 20, y: 0, width: item.kind === 'tab' ? 30 : 10, height: 12 }],
        }))
        return { issues: [], width: 50, height: 14, baseline: 10, startX, runs }
      },
    }
    const layout = layoutTextDocument(input, measurement)
    expect(layout.status).toBe('measured')
    expect(layout.lines[0].bullet).toBeDefined()
    const markup = renderMeasuredTextLines(input, layout, (run) =>
      `<span data-component="${run.componentId}">${run.text}</span>`)
    const root = document.createElement('div')
    root.innerHTML = markup
    const bullet = root.querySelector('[data-pptx-text-bullet="p1"]')
    expect(bullet).not.toBeNull()
    expect(bullet.textContent).toContain('\u2022')
    const tab = root.querySelector('[data-pptx-text-offset="1:2"]')
    expect(tab).not.toBeNull()
    expect(tab.style.width).toBe('30px')
  })

  it('rejects layout containing non-finite line coordinates', () => {
    const { input, layout } = measuredDocument()
    const corrupt = structuredClone(layout)
    corrupt.lines[0].x = NaN
    expect(() => renderMeasuredTextLines(input, corrupt, () => 'span')).toThrow(TypeError)
  })
})
