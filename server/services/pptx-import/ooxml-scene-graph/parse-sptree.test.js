import { describe, expect, it } from 'vitest'
import { parseSpTree } from './parse-sptree.js'

const SLIDE_XML = `<?xml version="1.0"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr/><p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Rect 1"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1000000" cy="1000000"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:p/></p:txBody>
      </p:sp>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="3" name="Picture 1"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rId2"/></p:blipFill>
        <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="500000" cy="500000"/></a:xfrm></p:spPr>
      </p:pic>
      <p:grpSp>
        <p:nvGrpSpPr><p:cNvPr id="10" name="Group 1"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
        <p:grpSpPr/>
        <p:sp>
          <p:nvSpPr><p:cNvPr id="11" name="Child A"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
          <p:spPr/>
        </p:sp>
        <p:sp>
          <p:nvSpPr><p:cNvPr id="12" name="Child B"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
          <p:spPr/>
        </p:sp>
      </p:grpSp>
      <p:graphicFrame>
        <p:nvGraphicFramePr><p:cNvPr id="20" name="Chart 1"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"/>
        </a:graphic>
      </p:graphicFrame>
    </p:spTree>
  </p:cSld>
</p:sld>`

describe('parseSpTree (T3.1 T3.2 T3.3)', () => {
  it('T3.1 fixture with rect + pic → kinds shape and pic', () => {
    const nodes = parseSpTree(SLIDE_XML)
    const kinds = nodes.map((n) => n.kind)
    expect(kinds).toContain('shape')
    expect(kinds).toContain('pic')
    const pic = nodes.find((n) => n.kind === 'pic')
    expect(pic.rels.blipEmbed).toBe('rId2')
  })

  it('T3.2 group with 2 children lists children with depth', () => {
    const nodes = parseSpTree(SLIDE_XML)
    const group = nodes.find((n) => n.kind === 'grpSp')
    expect(group).toBeTruthy()
    const children = nodes.filter((n) => n.parentId === group.id)
    expect(children.length).toBe(2)
    expect(children.every((c) => c.depth === 1)).toBe(true)
  })

  it('T3.3 chart graphicFrame node present', () => {
    const nodes = parseSpTree(SLIDE_XML)
    const chart = nodes.find((n) => n.kind === 'graphicFrame')
    expect(chart).toBeTruthy()
    expect(chart.graphicKind).toBe('chart')
  })

  it('T3.4 SmartArt diagram graphicFrame → diagram evidence node', () => {
    const xml = `<?xml version="1.0"?>
    <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
     xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <p:cSld><p:spTree>
        <p:nvGrpSpPr/><p:grpSpPr/>
        <p:graphicFrame>
          <p:nvGraphicFramePr><p:cNvPr id="5" name="Diagram 1"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
          <a:graphic>
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram"/>
          </a:graphic>
        </p:graphicFrame>
      </p:spTree></p:cSld>
    </p:sld>`
    const nodes = parseSpTree(xml)
    const diagram = nodes.find((n) => n.kind === 'graphicFrame')
    expect(diagram).toBeTruthy()
    expect(diagram.graphicKind).toBe('diagram')
  })
})
