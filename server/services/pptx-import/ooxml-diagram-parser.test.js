import { describe, expect, it } from 'vitest'
import {
  parseOoxmlDiagramData,
  layoutNodesLinear,
  stampDiagramModelOnFlattened,
  injectDiagramsFromSceneGraph,
} from './ooxml-diagram-parser.js'
import JSZip from 'jszip'
import { buildOoxmlSceneGraph } from './ooxml-scene-graph/index.js'

const DATA_XML = `<?xml version="1.0"?>
<dgm:dataModel xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"
 xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <dgm:ptLst>
    <dgm:pt modelId="{DOC}" type="doc"/>
    <dgm:pt modelId="{N1}" type="node">
      <dgm:t><a:p><a:r><a:t>Step One</a:t></a:r></a:p></dgm:t>
    </dgm:pt>
    <dgm:pt modelId="{N2}" type="node">
      <dgm:t><a:p><a:r><a:t>Step Two</a:t></a:r></a:p></dgm:t>
    </dgm:pt>
    <dgm:pt modelId="{N3}" type="node">
      <dgm:t><a:p><a:r><a:t>Step Three</a:t></a:r></a:p></dgm:t>
    </dgm:pt>
  </dgm:ptLst>
  <dgm:cxnLst>
    <dgm:cxn modelId="{C1}" srcId="{N1}" destId="{N2}"/>
    <dgm:cxn modelId="{C2}" srcId="{N2}" destId="{N3}"/>
  </dgm:cxnLst>
</dgm:dataModel>`

describe('ooxml-diagram-parser (T6.1 T6.3 T6.4)', () => {
  it('T6.1 parse data.xml → N text nodes', () => {
    const parsed = parseOoxmlDiagramData(DATA_XML)
    expect(parsed.nodes).toHaveLength(3)
    expect(parsed.nodes.map((n) => n.text)).toEqual(['Step One', 'Step Two', 'Step Three'])
    expect(parsed.connections).toHaveLength(2)
  })

  it('T6.3 layout produces editable positions and text', () => {
    const parsed = parseOoxmlDiagramData(DATA_XML)
    const laid = layoutNodesLinear(parsed.nodes)
    expect(laid.every((n) => n.width > 0 && n.text)).toBe(true)
  })

  it('T6.4 mutate node text in model serializes', () => {
    const shapes = [
      { id: 'a', type: 'shape', text: 'A' },
      { id: 'b', type: 'shape', text: 'B' },
    ]
    stampDiagramModelOnFlattened(shapes, { type: 'diagram' }, 0)
    expect(shapes[0]._pptxDiagram.nodes).toHaveLength(2)
    shapes[0]._pptxDiagram.nodes[0].text = 'Changed'
    const json = JSON.parse(JSON.stringify(shapes[0]._pptxDiagram))
    expect(json.nodes[0].text).toBe('Changed')
  })

  it('injects shapes from scene graph diagram rels', async () => {
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
          <p:graphicFrame>
            <p:nvGraphicFramePr><p:cNvPr id="5" name="Diagram 1"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
            <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/diagram">
              <dgm:relIds xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram" r:dm="rId2"/>
            </a:graphicData></a:graphic>
          </p:graphicFrame>
        </p:spTree></p:cSld>
      </p:sld>`
    )
    zip.file(
      'ppt/slides/_rels/slide1.xml.rels',
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData" Target="../diagrams/data1.xml"/>
      </Relationships>`
    )
    zip.file('ppt/diagrams/data1.xml', DATA_XML)
    const graph = await buildOoxmlSceneGraph(zip)
    const stats = {}
    const elements = await injectDiagramsFromSceneGraph({
      elements: [],
      graphSlide: graph.slides[0],
      zip,
      slideIndex: 0,
      stats,
      warnings: [],
      scale: { x: 1, y: 1 },
    })
    expect(elements.length).toBe(3)
    expect(elements.every((e) => e._pptxDiagram?.nodes?.length === 3)).toBe(true)
    expect(elements[0].text).toBe('Step One')
    expect(stats.diagramCount).toBe(1)
  })
})
