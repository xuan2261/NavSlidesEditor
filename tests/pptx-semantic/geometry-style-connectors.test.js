import { describe, expect, it } from 'vitest'
import semantic from '../../shared/src/pptx-semantic-document.js'
import connectors from '../../shared/src/pptx-semantic-connectors.js'
import operation from '../../shared/src/pptx-projection-operation.js'
import { linkedConnectorFixture as fixture } from './geometry-style-connector-fixture.js'
import { linkedCurveConnectorFixture } from './geometry-style-connector-fixture.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { semanticDeletion } from '../../client/src/components/canvas/canvas-semantic-group-commands.js'

const apply = (presentation, command) =>
  operation.applyPresentationProjectionOperation(presentation, {
    type: 'geometry.edit',
    instanceId: 'connector',
    componentId: 'connectorGeometry',
    command,
  })
describe('linked connector providers and sparse style lifecycle', () => {
  it('freezes only the terminal curve endpoint on detach and retains live start and sparse paint', () => {
    const presentation = geometryProjectionFixture()
    presentation.pptxSemantic = linkedCurveConnectorFixture()
    presentation.slides[0].elements.push({
      id: 'connector',
      pptxInstanceId: 'connector',
      type: 'shape',
      shape: 'rect',
    })
    const before = structuredClone(presentation)
    const capped = apply(presentation, { type: 'stroke-cap', cap: 'flat' })
    const resolved = connectors.deriveConnectorGeometry(capped.pptxSemantic, 'connector')
    const detached = apply(capped, { type: 'connector-detach', end: 'end' })
    const override =
      detached.pptxSemantic.instances.connector.overrides.components.connectorGeometry
    expect(override.geometryDocument.paths[0].commands[1].points[2]).toEqual(
      resolved.paths[0].commands[1].points[2]
    )
    expect(override.geometryDocument.paths[0].commands[1].points.slice(0, 2)).toEqual(
      before.pptxSemantic.definitions.connectorSource.content.geometry.paths[0].commands[1].points.slice(
        0,
        2
      )
    )
    expect(override.geometryDocument.paths[0].commands[0]).toEqual(
      before.pptxSemantic.definitions.connectorSource.content.geometry.paths[0].commands[0]
    )
    expect(override.geometryDocument.style).toBeUndefined()
    expect(override.geometryStyle).toEqual({ stroke: { cap: 'flat' } })
    const moved = structuredClone(detached)
    moved.pptxSemantic.instances.i1.localTransform[4] += 19050
    const afterMovement = connectors.deriveConnectorGeometry(moved.pptxSemantic, 'connector')
    expect(afterMovement.paths[0].commands[1].points[2]).toEqual(
      resolved.paths[0].commands[1].points[2]
    )
    expect(afterMovement.paths[0].commands[0].points[0]).not.toEqual(
      resolved.paths[0].commands[0].points[0]
    )
    const reattached = apply(moved, {
      type: 'connector-attach',
      end: 'end',
      targetInstanceId: 'i1',
      index: 0,
    })
    expect(
      connectors.deriveConnectorGeometry(reattached.pptxSemantic, 'connector').paths[0].commands[1]
        .points[2]
    ).not.toEqual(resolved.paths[0].commands[1].points[2])
    expect(reattached.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(reattached.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(reattached.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
    expect(presentation).toEqual(before)
  })

  it('rejects bound terminal edits but allows a curve control-point edit', () => {
    const presentation = geometryProjectionFixture()
    presentation.pptxSemantic = linkedCurveConnectorFixture()
    presentation.slides[0].elements.push({
      id: 'connector',
      pptxInstanceId: 'connector',
      type: 'shape',
      shape: 'rect',
    })
    const before = structuredClone(presentation)
    expect(() =>
      apply(presentation, {
        type: 'control-point',
        componentId: 'connectorEnd',
        x: 900,
      })
    ).toThrow(TypeError)
    const edited = apply(presentation, {
      type: 'control-point',
      componentId: 'curveControl1',
      x: 250,
    })
    expect(
      edited.pptxSemantic.instances.connector.overrides.components.connectorGeometry
        .geometryDocument.paths[0].commands[1].points[0].x
    ).toBe(250)
    expect(edited.pptxSemantic.instances.connector.connectorBindings).toEqual(
      before.pptxSemantic.instances.connector.connectorBindings
    )
    expect(presentation).toEqual(before)
  })

  it('compiles source-template target sites and connector geometry before binding and detach/reattach', () => {
    const input = fixture()
    for (const id of ['definition', 'connectorSource']) {
      const geometry = input.definitions[id].content.geometry
      geometry.schemaVersion = 2
      delete geometry.width
      delete geometry.height
    }
    const document = semantic.normalizePptxSemanticDocument(input)
    const before = structuredClone(document)
    const derived = connectors.deriveConnectorGeometry(document, 'connector')
    expect(derived.schemaVersion).toBe(1)
    const point = derived.paths[0].commands[0].points[0]
    expect((point.x * derived.width) / 1000).toBeCloseTo(952400, 8)
    expect((point.y * derived.height) / 800).toBeCloseTo(80, 8)
    const presentation = geometryProjectionFixture()
    presentation.pptxSemantic = document
    presentation.slides[0].elements.push({
      id: 'connector',
      pptxInstanceId: 'connector',
      type: 'shape',
      shape: 'rect',
    })
    const detached = apply(presentation, { type: 'connector-detach', end: 'start' })
    expect(
      detached.pptxSemantic.instances.connector.overrides.components.connectorGeometry
        .geometryDocument
    ).toMatchObject({ schemaVersion: 1, width: 100, height: 80 })
    const reattached = apply(detached, {
      type: 'connector-attach',
      end: 'start',
      targetInstanceId: 'i1',
      index: 0,
    })
    expect(reattached.pptxSemantic.definitions).toEqual(before.definitions)
    expect(reattached.pptxSemantic.styles).toEqual(before.styles)
    expect(reattached.pptxSemantic.instances.i1).toEqual(before.instances.i1)
    expect(
      semantic.normalizePptxSemanticDocument(JSON.parse(JSON.stringify(reattached.pptxSemantic)))
    ).toEqual(reattached.pptxSemantic)
    const invalid = structuredClone(input)
    invalid.definitions.connectorSource.content.geometry.connector.start.index = 1
    expect(() => semantic.normalizePptxSemanticDocument(invalid)).toThrow()
  })
  it('attaches to a visible inherited placeholder through the exact source provider and native site', () => {
    const document = semantic.normalizePptxSemanticDocument(fixture())
    const derived = connectors.deriveConnectorGeometry(document, 'connector')
    const point = derived.paths[0].commands[0].points[0]
    expect((point.x * derived.width) / 1000).toBeCloseTo(952400, 8)
    expect((point.y * derived.height) / 800).toBeCloseTo(80, 8)
    expect(derived.style.stroke.color.value).toBe('FF0000')
    expect(document.definitions.local1.content.geometry).toBeUndefined()
  })
  it('freezes detached endpoint position without inherited paint, then reattaches without losing sparse intent', () => {
    const document = fixture(),
      presentation = geometryProjectionFixture()
    presentation.pptxSemantic = document
    presentation.slides[0].elements.push({
      id: 'connector',
      pptxInstanceId: 'connector',
      type: 'shape',
      shape: 'rect',
    })
    const capped = apply(presentation, { type: 'stroke-cap', cap: 'flat' })
    const detached = apply(capped, { type: 'connector-detach', end: 'start' })
    const override =
      detached.pptxSemantic.instances.connector.overrides.components.connectorGeometry
    expect(override.geometryDocument.style).toBeUndefined()
    expect(override.geometryStyle).toEqual({ stroke: { cap: 'flat' } })
    expect(override.geometryDocument.connector).toEqual(
      document.definitions.connectorSource.content.geometry.connector
    )
    const reattached = apply(detached, {
      type: 'connector-attach',
      end: 'start',
      targetInstanceId: 'i1',
      index: 0,
    })
    expect(
      reattached.pptxSemantic.instances.connector.overrides.components.connectorGeometry
        .geometryStyle
    ).toEqual({ stroke: { cap: 'flat' } })
    expect(reattached.pptxSemantic.definitions).toEqual(document.definitions)
    expect(reattached.pptxSemantic.instances.i1).toEqual(document.instances.i1)
  })
  it('rejects another original host context even when placed on the same project slide', () => {
    const document = fixture()
    document.instances.i2.slideId = 's1'
    document.instances.connector.connectorBindings.start.targetInstanceId = 'i2'
    expect(() => semantic.normalizePptxSemanticDocument(document)).toThrow()
  })
  it('freezes a surviving connector endpoint before deleting its target occurrence', () => {
    const presentation = geometryProjectionFixture()
    presentation.pptxSemantic = fixture()
    presentation.slides[0].elements.push({
      id: 'connector',
      pptxInstanceId: 'connector',
      type: 'shape',
      shape: 'rect',
    })
    const before = structuredClone(presentation)
    const resolved = connectors.deriveConnectorGeometry(presentation.pptxSemantic, 'connector')
    const endpoint = connectors.connectorEndpointLocators(resolved).start

    const deletion = semanticDeletion(
      presentation.pptxSemantic,
      presentation.slides[0],
      ['i1']
    )
    const connector = deletion.document.instances.connector
    const frozen = connector.overrides.components.connectorGeometry.geometryDocument

    expect(connector.connectorBindings.start).toBeNull()
    expect(
      frozen.paths[endpoint.pathIndex].commands[endpoint.commandIndex].points[endpoint.pointIndex]
    ).toEqual(
      resolved.paths[endpoint.pathIndex].commands[endpoint.commandIndex].points[endpoint.pointIndex]
    )
    expect(deletion.document.instances.i1.lineage).toMatchObject({
      tombstone: true,
      deleted: true,
    })
    expect(deletion.document.definitions).toEqual(before.pptxSemantic.definitions)
    expect(presentation).toEqual(before)
  })
})
