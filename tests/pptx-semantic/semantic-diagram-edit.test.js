import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { fixture } from './smartart-layout-fixture.js'
import { familyDocumentsFixture } from './family-documents-fixture.js'
import { familyCompatibilityElement } from '../../shared/src/pptx-family-operations.js'
import { applyPresentationProjectionOperation } from '../../shared/src/pptx-projection-operation.js'
import { normalizeSemanticPresentation } from '../../shared/src/pptx-semantic-presentation.js'

const require = createRequire(import.meta.url)
const { applySmartArtOperation } = require('../../shared/src/pptx-smartart-operations')
const { evaluateSmartArtLayout } = require('../../shared/src/pptx-smartart-layout')
const bounds = { x: 0, y: 0, width: 200, height: 100 }

describe('semantic diagram edit acceptance', () => {
  it('reparents a 51-node source diagram and reevaluates the authored layout without losing node identities', async () => {
    const { document } = await fixture({ count: 51 })
    const before = JSON.stringify(document)
    const moved = applySmartArtOperation(document, {
      type: 'reparent', pointId: 'p3', parentId: 'p1', connectionId: 'c2',
    })
    const persisted = JSON.parse(JSON.stringify(moved))
    const layout = evaluateSmartArtLayout(persisted, bounds)
    expect(persisted.points.filter(({ type }) => type === 'node')).toHaveLength(51)
    expect(persisted.points.map(({ componentId }) => componentId)).toEqual(
      document.points.map(({ componentId }) => componentId)
    )
    expect(persisted.connections.find(({ componentId }) => componentId === 'c2'))
      .toMatchObject({ sourceId: '1', destinationId: '3' })
    expect(layout.layoutStatus).toBe('authored-layout-evaluated')
    expect(layout.placements).toHaveLength(51)
    expect(JSON.stringify(document)).toBe(before)
  })

  it('replays inserted and reparented nodes on presentation reload without changing source or sibling occurrences', async () => {
    const document = (await familyDocumentsFixture()).diagram
    document.instances.sibling = { ...structuredClone(document.instances.occurrence), id: 'sibling' }
    const input = normalizeSemanticPresentation({
      pptxSemantic: document,
      slides: [{ id: 's1', elements: ['occurrence', 'sibling'].map((id) => ({
        id, type: 'diagram', pptxInstanceId: id,
      })) }],
    })
    const before = JSON.stringify(input)
    const effective = (presentation, index = 0) => familyCompatibilityElement(
      presentation.pptxSemantic, presentation.slides[0].elements[index]
    ).smartArtDocument
    const source = effective(input)
    const parent = source.points.find(({ type }) => type === 'doc')
    const child = source.points.find(({ type }) => type === 'node')
    const incoming = source.connections.find(({ destinationId }) => destinationId === child.modelId)
    const addedPoint = {
      componentId: `${source.componentId}~authored:inserted`, modelId: '100', type: 'node', properties: [],
    }
    const edit = (presentation, command) => applyPresentationProjectionOperation(presentation, {
      type: 'smartart.edit', instanceId: 'occurrence', componentId: source.componentId, command,
    })
    const inserted = edit(input, {
      type: 'add', point: addedPoint,
      connection: { componentId: `${source.componentId}~authored:edge`, modelId: '101', type: 'parOf',
        sourceId: parent.modelId, destinationId: addedPoint.modelId, sourceOrder: 1, destinationOrder: 0 },
    })
    const saved = edit(inserted, {
      type: 'reparent', pointId: child.componentId, parentId: addedPoint.componentId,
      connectionId: incoming.componentId,
    })
    const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(saved)))
    const changed = effective(reopened)
    expect(changed.points).toEqual([...source.points, addedPoint])
    expect(changed.connections.find(({ componentId }) => componentId === incoming.componentId))
      .toMatchObject({ sourceId: addedPoint.modelId, destinationId: child.modelId })
    expect(effective(reopened, 1)).toEqual(source)
    expect(reopened.pptxSemantic.definitions).toEqual(input.pptxSemantic.definitions)
    expect(reopened.pptxSemantic.instances.sibling).toEqual(input.pptxSemantic.instances.sibling)
    expect(reopened.slides[0].elements[1]).toEqual(input.slides[0].elements[1])
    expect(JSON.stringify(input)).toBe(before)
    const snapshot = JSON.stringify(reopened)
    expect(() => edit(reopened, {
      type: 'reparent', pointId: addedPoint.componentId, parentId: child.componentId,
      connectionId: `${source.componentId}~authored:edge`,
    })).toThrow(TypeError)
    expect(JSON.stringify(reopened)).toBe(snapshot)
  })

  it('rejects a reparent cycle and unknown layout algorithm without partial mutation or node loss', async () => {
    const { document } = await fixture({ count: 51 })
    const before = JSON.stringify(document)
    expect(() => applySmartArtOperation(document, {
      type: 'reparent', pointId: 'p1', parentId: 'p51', connectionId: 'c0',
    })).toThrow(TypeError)
    expect(JSON.stringify(document)).toBe(before)
    const unsupported = structuredClone(document)
    unsupported.layout.declarations.find(({ type }) => type === 'alg').attributes.type = 'unknownRule'
    const unsupportedBefore = JSON.stringify(unsupported)
    expect(() => evaluateSmartArtLayout(unsupported, bounds)).toThrow(TypeError)
    expect(JSON.stringify(unsupported)).toBe(unsupportedBefore)
    expect(unsupported.points.filter(({ type }) => type === 'node')).toHaveLength(51)
  })
})
