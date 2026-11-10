import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import sourceModule from './table-source-properties.js'
import tableMapper from './map-table.js'
import { tableCellText } from 'revealjs-shared'

const { applyTableSourceProperties } = sourceModule
const context = { scale: { x: 1, y: 1 }, zIndex: 1, slideIndex: 0, warnings: [], stats: { tableCount: 0 } }
const frame = (id, margins, x = 0) => `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Table ${id}"/></p:nvGraphicFramePr><p:xfrm><a:off x="${x}" y="0"/><a:ext cx="2540000" cy="1016000"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tr h="1016000"><a:tc><a:txBody><a:bodyPr/><a:p/></a:txBody><a:tcPr ${margins}/></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
const part = (...frames) => `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>${frames.join('')}</p:spTree></p:cSld></p:sld>`
const table = (props = {}) => ({ type: 'table', left: 0, top: 0, width: 200, height: 80, data: [[{ text: '<p><span style="font-size:11pt;color:#000000;font-weight:bold">Header</span></p>', vAlign: 'up' }]], ...props })

async function supplement(elements, zip = new JSZip()) {
  const slide = { elements }
  return applyTableSourceProperties({ slide, zip, slideIndex: 0 })
}

describe('exact OOXML table cell properties', () => {
  it('restores source 45720 EMU margins and parser-rich typography in the canonical table model', async () => {
    const zip = new JSZip().file('ppt/slides/slide1.xml', part(frame(7, 'marL="45720" marR="45720" marT="45720" marB="45720"')))
    const original = table()
    const result = await supplement([original], zip)
    const projected = tableMapper.mapTable(result.elements[0], { ...context, stats: { tableCount: 0 } })[0]
    expect(projected.data.map((row) => row.map(tableCellText))).toEqual([['Header']])
    expect(projected.cellStyles).toMatchObject({ fontSizes: [[11]], textColors: [['#000000']], isBold: [[true]], vAligns: [['top']], insets: [[{ top: 3.6, right: 3.6, bottom: 3.6, left: 3.6 }]] })
    expect(original.data[0][0].insets).toBeUndefined()
  })

  it('uses explicit source identity even when parser order differs, and never borrows a conflicting ID', async () => {
    const zip = new JSZip().file('ppt/slides/slide1.xml', part(frame(7, 'marL="12700"'), frame(8, 'marL="25400"')))
    const result = await supplement([table({ sourceId: '8' }), table({ sourceId: '7' }), table({ sourceId: '99' })], zip)
    expect(result.elements[0].data[0][0].insets.left).toBe(2)
    expect(result.elements[1].data[0][0].insets.left).toBe(1)
    expect(result.elements[2].data[0][0].insets).toBeUndefined()
  })

  it('uses a proven ordered bijection for duplicate table geometry and rejects mismatched structure', async () => {
    const zip = new JSZip().file('ppt/slides/slide1.xml', part(frame(7, 'marL="12700"'), frame(8, 'marL="25400"')))
    const result = await supplement([table({ order: 20 }), table({ order: 10 })], zip)
    expect(result.elements.map((element) => element.data[0][0].insets.left)).toEqual([2, 1])
    const mismatch = await supplement([table({ sourceId: '7', data: [[{ text: 'A' }, { text: 'B' }]] })], zip)
    expect(mismatch.elements[0].data[0][0].insets).toBeUndefined()
  })

  it('follows presentation relationship order and keeps explicit parser zero sides and alignment', async () => {
    const zip = new JSZip()
      .file('ppt/presentation.xml', '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId9"/></p:sldIdLst></p:presentation>')
      .file('ppt/_rels/presentation.xml.rels', '<Relationships><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/custom.xml"/></Relationships>')
      .file('ppt/slides/custom.xml', part(frame(7, 'marL="45720" marR="45720" marT="45720" marB="45720" anchor="b"')))
    const result = await supplement([table({ sourceId: '7', data: [[{ text: 'A', insetLeft: 0, vAlign: 'top', insets: { top: 0 } }]] })], zip)
    const projected = tableMapper.mapTable(result.elements[0], { ...context, scale: { x: 2, y: 3 }, stats: { tableCount: 0 } })[0]
    expect(projected.cellStyles.insets[0][0]).toEqual({ top: 0, right: 7.2, bottom: 10.8, left: 0 })
    expect(projected.cellStyles.vAligns[0][0]).toBe('top')
  })

  it('reads inherited tables from their own source part and propagates source read failures', async () => {
    const zip = new JSZip().file('ppt/slideLayouts/slideLayout4.xml', part(frame(7, 'marL="0" marR="12700" anchor="b"')))
    const result = await supplement([table({ _pptxNativePartUri: 'ppt/slideLayouts/slideLayout4.xml', _pptxNativeSource: { nodeId: '7' }, data: [[{ text: 'A' }]] })], zip)
    expect(result.elements[0].data[0][0]).toMatchObject({ insets: { left: 0, right: 1 }, vAlign: 'bottom' })
    const broken = { file: (name) => name === 'ppt/slides/slide1.xml' ? { async: async () => { throw new Error('read failed') } } : null }
    await expect(supplement([table()], broken)).rejects.toThrow('Unable to read table source part')
  })
})
