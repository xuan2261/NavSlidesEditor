import { describe, expect, it } from 'vitest'
import { attachSourceNodes, collectMappedNodeIds, navKindHint } from './attach-source-nodes.js'
import { parseSpTree } from './parse-sptree.js'

describe('attach-source-nodes', () => {
  it('assigns nodeId in document order preferring kind', () => {
    const graphNodes = [
      { id: '2', kind: 'shape' },
      { id: '3', kind: 'pic' },
      { id: '10', kind: 'grpSp' },
      { id: '11', kind: 'shape', parentId: '10' },
    ]
    const elements = [{ type: 'shape' }, { type: 'image' }, { type: 'text' }]
    const { assigned, unassignedLeaves } = attachSourceNodes(elements, graphNodes, 0)
    expect(assigned).toBe(3)
    expect(elements[0]._pptxSource.nodeId).toBe('2')
    expect(elements[1]._pptxSource.nodeId).toBe('3')
    expect(elements[1]._pptxSource.kind).toBe('pic')
    expect(elements[2]._pptxSource.nodeId).toBe('11')
    expect(unassignedLeaves).toHaveLength(0)
  })

  it('collectMappedNodeIds keys slideIndex:nodeId', () => {
    const ids = collectMappedNodeIds({
      slides: [
        { elements: [{ _pptxSource: { nodeId: '2', slideIndex: 0 } }] },
        { elements: [{ _pptxSource: { nodeId: '2', slideIndex: 1 } }] },
      ],
    })
    expect(ids.has('0:2')).toBe(true)
    expect(ids.has('1:2')).toBe(true)
    expect(ids.size).toBe(2)
  })

  it('preserves pre-stamped layout placeholder source', () => {
    const elements = [
      {
        type: 'text',
        _pptxSource: { nodeId: '2', kind: 'shape', fromLayoutPlaceholder: true, phType: 'title' },
      },
    ]
    attachSourceNodes(elements, [{ id: '2', kind: 'shape' }, { id: '3', kind: 'pic' }], 0)
    expect(elements[0]._pptxSource.fromLayoutPlaceholder).toBe(true)
    expect(elements[0]._pptxSource.nodeId).toBe('2')
  })

  it('navKindHint maps chart/table to graphicFrame', () => {
    expect(navKindHint({ type: 'chart' })).toBe('graphicFrame')
    expect(navKindHint({ type: 'table' })).toBe('graphicFrame')
    expect(navKindHint({ type: 'image' })).toBe('pic')
  })

  it('keeps order and kind fallbacks tentative and out of authoritative coverage', () => {
    const elements = [{ type: 'shape' }, { type: 'image' }]
    attachSourceNodes(
      elements,
      [{ id: '2', kind: 'shape' }, { id: '3', kind: 'pic' }],
      0
    )
    expect(elements[0]._pptxSource).toMatchObject({
      nodeId: '2',
      matchedBy: 'kind',
      authoritative: false,
    })
    expect(elements[1]._pptxSource).toMatchObject({
      nodeId: '3',
      matchedBy: 'kind',
      authoritative: false,
    })
    expect(collectMappedNodeIds({ slides: [{ elements }] }).size).toBe(0)
  })

  it('does not promote ambiguous source-name matches [cap:import.pptx]', () => {
    const elements = [{ type: 'shape', name: 'Duplicate' }]
    attachSourceNodes(elements, [{ id: '2', kind: 'shape', name: 'Duplicate' }, { id: '3', kind: 'shape', name: 'Duplicate' }], 0)
    expect(elements[0]._pptxSource).toMatchObject({ matchedBy: 'kind', authoritative: false })
  })

  it('counts source-id and name matches as authoritative', () => {
    const elements = [{ type: 'shape', sourceId: '2' }, { type: 'image', name: 'Photo' }]
    attachSourceNodes(
      elements,
      [{ id: '2', kind: 'shape' }, { id: '3', kind: 'pic', name: 'Photo' }],
      0
    )
    expect(elements.every((element) => element._pptxSource.authoritative === true)).toBe(true)
    expect(collectMappedNodeIds({ slides: [{ elements }] }).size).toBe(2)
  })

  it('counts a unique exact geometry match as authoritative', () => {
    const elements = [{ type: 'image', x: 10, y: 20, width: 30, height: 40 }]
    attachSourceNodes(elements, [
      { id: '2', kind: 'pic', xfrm: { x: 100, y: 200, cx: 300, cy: 400 } },
      { id: '3', kind: 'pic', xfrm: { x: 10.4, y: 19.6, cx: 30.2, cy: 40.1 } },
    ], 0)

    expect(elements[0]._pptxSource).toMatchObject({
      nodeId: '3',
      matchedBy: 'geometry',
      authoritative: true,
    })
  })

  it('matches parsed OOXML point geometry to pptxtojson element coordinates', () => {
    const [node] = parseSpTree(`<p:sld xmlns:p="p" xmlns:a="a"><p:cSld><p:spTree>
      <p:pic><p:nvPicPr><p:cNvPr id="2" name="Picture 1"/></p:nvPicPr>
        <p:spPr><a:xfrm><a:off x="914400" y="457200"/><a:ext cx="1828800" cy="914400"/></a:xfrm></p:spPr>
      </p:pic>
    </p:spTree></p:cSld></p:sld>`)
    const elements = [{ type: 'image', x: 72, y: 36, width: 144, height: 72 }]

    attachSourceNodes(elements, [node], 0)

    expect(elements[0]._pptxSource).toMatchObject({
      nodeId: '2',
      matchedBy: 'geometry',
      authoritative: true,
    })
  })

  it('keeps duplicate geometry matches tentative', () => {
    const elements = [{ type: 'shape', x: 10, y: 20, width: 30, height: 40 }]
    const xfrm = { x: 10, y: 20, cx: 30, cy: 40 }
    attachSourceNodes(elements, [
      { id: '2', kind: 'shape', xfrm },
      { id: '3', kind: 'shape', xfrm },
    ], 0)

    expect(elements[0]._pptxSource).toMatchObject({ matchedBy: 'kind', authoritative: false })
  })

  it('reserves a later exact geometry match before an earlier kind fallback', () => {
    const elements = [
      { type: 'image' },
      { type: 'image', x: 10, y: 20, width: 30, height: 40 },
    ]
    attachSourceNodes(elements, [
      { id: '2', kind: 'pic', xfrm: { x: 10, y: 20, cx: 30, cy: 40 } },
      { id: '3', kind: 'pic', xfrm: { x: 100, y: 200, cx: 300, cy: 400 } },
    ], 0)

    expect(elements[1]._pptxSource).toMatchObject({
      nodeId: '2',
      matchedBy: 'geometry',
      authoritative: true,
    })
    expect(elements[0]._pptxSource).toMatchObject({ nodeId: '3', authoritative: false })
  })

  it('promotes a complete named-node document-order bijection', () => {
    const elements = [{ type: 'shape' }, { type: 'image' }]
    attachSourceNodes(elements, [
      { id: '2', kind: 'shape', name: 'Rectangle 1' },
      { id: '3', kind: 'pic', name: 'Picture 1' },
    ], 0)

    expect(elements.every((element) => element._pptxSource.authoritative === true)).toBe(true)
    expect(elements.every((element) => element._pptxSource.matchedBy === 'documentOrder')).toBe(true)
  })

  it('does not let preserved OLE frames claim editable source identity', () => {
    const ole = {
      id: '2',
      kind: 'graphicFrame',
      name: 'Object 1',
      graphicUri: 'http://schemas.openxmlformats.org/presentationml/2006/ole',
    }
    const pic = { id: '3', kind: 'pic', name: 'Picture 1' }
    const preStamped = [{ type: 'image', _pptxSource: { nodeId: '2', authoritative: true } }]
    attachSourceNodes(preStamped, [ole, pic], 0)
    expect(preStamped[0]._pptxSource).toMatchObject({ nodeId: '2', authoritative: false })

    const sourceStamped = [{ type: 'image', sourceId: '2', name: 'Object 1' }]
    attachSourceNodes(sourceStamped, [ole, pic], 0)
    expect(sourceStamped[0]._pptxSource).toMatchObject({ nodeId: '3', authoritative: false })
  })

  it('does not let preserved OLE frames steal editable-node fallback coverage', () => {
    const elements = [{ type: 'image' }]
    attachSourceNodes(elements, [
      {
        id: '2',
        kind: 'graphicFrame',
        name: 'Object 1',
        graphicUri: 'http://schemas.openxmlformats.org/presentationml/2006/ole',
      },
      { id: '3', kind: 'pic', name: 'Picture 1' },
    ], 0)

    expect(elements[0]._pptxSource).toMatchObject({
      nodeId: '3',
      matchedBy: 'documentOrder',
      authoritative: true,
    })
  })
})
