import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { buildOoxmlSceneGraph, reconcileSceneGraph } from './index.js'

async function fixtureZip({ withChart = false } = {}) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types/>')
  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0"?>
    <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
     xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
     xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <p:cSld><p:spTree>
        <p:nvGrpSpPr/><p:grpSpPr/>
        <p:sp><p:nvSpPr><p:cNvPr id="2" name="Rect"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/></p:sp>
        <p:pic><p:nvPicPr><p:cNvPr id="3" name="Pic"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
          <p:blipFill><a:blip r:embed="rId2"/></p:blipFill><p:spPr/></p:pic>
        ${
          withChart
            ? `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Chart"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
            <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"/></a:graphic></p:graphicFrame>`
            : ''
        }
      </p:spTree></p:cSld>
    </p:sld>`
  )
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    `<Relationships>
      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
      ${
        withChart
          ? `<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>`
          : ''
      }
    </Relationships>`
  )
  zip.file('ppt/media/image1.png', Buffer.from([1, 2, 3]))
  if (withChart) zip.file('ppt/charts/chart1.xml', '<c:chart/>')
  return zip
}

describe('buildOoxmlSceneGraph + reconcile (T3.1 T3.6 T3.7 T3.8)', () => {
  it('builds graph with shape+pic nodes', async () => {
    const graph = await buildOoxmlSceneGraph(await fixtureZip())
    expect(graph.slides).toHaveLength(1)
    expect(graph.stats.nodeCount).toBeGreaterThanOrEqual(2)
    const kinds = graph.slides[0].nodes.map((n) => n.kind)
    expect(kinds).toContain('shape')
    expect(kinds).toContain('pic')
  })

  it('T3.6 reconciliation warns when mapped count < graph leaf count', async () => {
    const graph = await buildOoxmlSceneGraph(await fixtureZip())
    const presentation = { slides: [{ elements: [] }] }
    const { warnings, unmapped } = reconcileSceneGraph(graph, presentation)
    expect(unmapped.length).toBe(1)
    expect(warnings[0].type).toBe('scene-graph-unmapped')
  })

  it('T3.7 empty-mapped slide fails under strictCountGate', async () => {
    const graph = await buildOoxmlSceneGraph(await fixtureZip())
    const presentation = { slides: [{ elements: [] }] }
    expect(() => reconcileSceneGraph(graph, presentation, { strictCountGate: true })).toThrow(
      /PPTX_SLA_STRICT_COUNT|empty/
    )
  })

  it('count heuristic alone does not throw under default reconcile', async () => {
    const graph = await buildOoxmlSceneGraph(await fixtureZip())
    // One mapped element but graph has more leaves — warning only
    const presentation = { slides: [{ elements: [{ type: 'shape' }] }] }
    expect(() => reconcileSceneGraph(graph, presentation, { strictCountGate: true })).not.toThrow()
    const { warnings } = reconcileSceneGraph(graph, presentation)
    expect(warnings.some((w) => w.type === 'scene-graph-unmapped')).toBe(true)
  })

  it('nodeId stamps: unmapped leaves warn; strictNodeGate throws', async () => {
    const graph = await buildOoxmlSceneGraph(await fixtureZip())
    const leaf = graph.slides[0].nodes.find((n) => n.kind !== 'grpSp')
    const presentation = {
      slides: [
        {
          elements: [
            { type: 'shape', _pptxSource: { nodeId: leaf.id, kind: leaf.kind, slideIndex: 0 } },
          ],
        },
      ],
    }
    const soft = reconcileSceneGraph(graph, presentation)
    expect(soft.unmapped.some((u) => u.severity === 'node-unmapped')).toBe(true)
    expect(() => reconcileSceneGraph(graph, presentation, { strictNodeGate: true })).toThrow(
      /PPTX_SLA_STRICT_NODES/
    )
  })

  it('multi-slide reuses node ids without false coverage', async () => {
    const zip = new JSZip()
    zip.file('[Content_Types].xml', '<Types/>')
    for (const n of [1, 2]) {
      zip.file(
        `ppt/slides/slide${n}.xml`,
        `<?xml version="1.0"?>
        <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
         xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
          <p:cSld><p:spTree>
            <p:nvGrpSpPr/><p:grpSpPr/>
            <p:sp><p:nvSpPr><p:cNvPr id="2" name="Rect"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/></p:sp>
          </p:spTree></p:cSld>
        </p:sld>`
      )
      zip.file(`ppt/slides/_rels/slide${n}.xml.rels`, '<Relationships/>')
    }
    const graph = await buildOoxmlSceneGraph(zip)
    // Only slide 0 maps id 2; slide 1 must still report unmapped
    const presentation = {
      slides: [
        { elements: [{ type: 'shape', _pptxSource: { nodeId: '2', slideIndex: 0 } }] },
        { elements: [] },
      ],
    }
    const { unmapped } = reconcileSceneGraph(graph, presentation)
    expect(unmapped.some((u) => u.slideIndex === 1 && u.severity === 'empty-mapped')).toBe(true)
    // Map slide 1 with wrong cross-slide belief: node 2 on slide1 still missing if only slide0 stamped
    const withStampOn0Only = {
      slides: [
        { elements: [{ type: 'shape', _pptxSource: { nodeId: '2', slideIndex: 0 } }] },
        { elements: [{ type: 'shape', _pptxSource: { nodeId: '2', slideIndex: 0 } }] }, // wrong slideIndex stamp
      ],
    }
    const r2 = reconcileSceneGraph(graph, withStampOn0Only)
    expect(r2.unmapped.some((u) => u.slideIndex === 1 && u.severity === 'node-unmapped')).toBe(true)
  })

  it('T3.8 chart graph nodes ≥ inspectOoxmlCoverage chart count', async () => {
    const graph = await buildOoxmlSceneGraph(await fixtureZip({ withChart: true }))
    expect(graph.ooxml.nativeChartCount).toBeGreaterThanOrEqual(1)
    expect(graph.stats.chartNodes).toBeGreaterThanOrEqual(graph.ooxml.nativeChartCount)
  })
})
