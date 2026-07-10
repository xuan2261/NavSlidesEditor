import { describe, expect, it } from 'vitest'
import { attachSourceNodes, collectMappedNodeIds, navKindHint } from './attach-source-nodes.js'

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
})
