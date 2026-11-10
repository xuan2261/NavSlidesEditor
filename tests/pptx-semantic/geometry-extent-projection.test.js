import { describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { extentProjectionFixture } from './geometry-extent-fixture.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { linkedConnectorFixture } from './geometry-style-connector-fixture.js'
import { authored } from './geometry-style-fixture.js'
import {
  semanticElement,
  semanticCompatibility,
} from '../../client/src/utils/pptx-semantic-geometry-bridge.js'

const require = createRequire(import.meta.url)
const {
  applyPresentationProjectionOperation,
} = require('../../shared/src/pptx-projection-operation.js')
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation.js')
const { semanticRenderTree } = require('../../shared/src/pptx-semantic-render-tree.js')
const { renderSlideElements } = require('../../shared/src/element-renderers.js')
const { materializeGeometry } = require('../../shared/src/pptx-geometry-style-resolution.js')
const { deriveGeometryPaths } = require('../../shared/src/pptx-geometry-document.js')
const { deriveConnectorGeometry } = require('../../shared/src/pptx-semantic-connectors.js')
import groups from '../../shared/src/pptx-semantic-groups.js'

const edit = (deck, command, instanceId = 'i1') =>
  applyPresentationProjectionOperation(deck, {
    type: 'geometry.edit',
    instanceId,
    componentId: 'geometry',
    command,
  })

describe('source-bound native extent projection', () => {
  it('uses one private instance reader for all descendants in a group bounds operation', () => {
    const model = extentProjectionFixture(1905000).pptxSemantic
    model.definitions.group = {
      id: 'group',
      kind: 'group',
      origin: 'project',
      source: null,
      components: [],
      content: {},
    }
    model.instances.group = {
      id: 'group',
      definitionId: 'group',
      slideId: 's1',
      parentInstanceId: null,
      localTransform: [-2, 0, 0, 0.5, 1905000, 952500],
      paintIndex: 0,
      overrides: {},
    }
    model.instances.i1.parentInstanceId = 'group'
    model.instances.i1.localTransform = [1, 0, 0, 1, 0, 0]
    const leaf = structuredClone(model.instances.i1)
    leaf.id = 'third'
    leaf.localTransform = [1, 0, 0, 1, 952500, 762000]
    model.instances.third = leaf
    const before = structuredClone(model)
    const reader = vi.spyOn(groups, 'createSemanticInstanceReader')
    try {
      expect(semanticElement(model, 'group')).toMatchObject({
        x: 0,
        y: 0,
        width: 300,
        height: 160,
      })
      expect(reader).toHaveBeenCalledTimes(1)
      expect(model).toEqual(before)
    } finally {
      reader.mockRestore()
    }
  })

  it.each([
    [{ width: 1905000 }, -1905000, 2190750],
    [{ height: 381000 }, 0, 1047750],
    [{ width: 0, height: 0 }, 1905000, -95250],
  ])(
    'rederives a bound site after native extent %j without changing its binding',
    (patch, x, y) => {
      const initial = geometryProjectionFixture()
      initial.pptxSemantic = linkedConnectorFixture()
      const model = initial.pptxSemantic
      for (const id of ['definition', 'connectorSource']) {
        const geometry = model.definitions[id].content.geometry
        geometry.schemaVersion = 2
        delete geometry.width
        delete geometry.height
      }
      model.styles.provider.payload.transform.value.ext = authored({
        cx: authored(952500),
        cy: authored(762000),
      })
      model.instances.i1.localTransform = [-2, 0, 0, 3, 1905000, -95250]
      initial.slides[0].elements.push({
        id: 'connector',
        pptxInstanceId: 'connector',
        type: 'shape',
        shape: 'rect',
      })
      const before = structuredClone(initial)
      const endpoint = (document) => {
        const geometry = deriveConnectorGeometry(document, 'connector')
        const path = geometry.paths[0]
        const point = path.commands[0].points[0]
        return {
          x: (point.x * geometry.width) / path.width,
          y: (point.y * geometry.height) / path.height,
        }
      }
      expect(endpoint(model)).toEqual({ x: 0, y: 2190750 })
      const next = edit(initial, { type: 'extent', ...patch })
      expect(endpoint(next.pptxSemantic).x).toBeCloseTo(x, 8)
      expect(endpoint(next.pptxSemantic).y).toBeCloseTo(y, 8)
      expect(next.pptxSemantic.instances.connector).toEqual(before.pptxSemantic.instances.connector)
      expect(next.pptxSemantic.instances.i1.localTransform).toEqual(
        before.pptxSemantic.instances.i1.localTransform
      )
      expect(next.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
      expect(next.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
      expect(next.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
      const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(next)))
      expect(endpoint(reopened.pptxSemantic)).toEqual(endpoint(next.pptxSemantic))
      expect(initial).toEqual(before)
    }
  )

  it('updates nested rotated reflected anisotropic bounds without changing placement or ancestry', () => {
    const initial = extentProjectionFixture()
    const model = initial.pptxSemantic
    for (const [id, parentInstanceId, localTransform] of [
      ['outer', null, [0, 2, -3, 0, 1905000, 952500]],
      ['inner', 'outer', [-1, 0, 0, 0.5, 95250, -190500]],
    ]) {
      model.definitions[id] = {
        id,
        kind: 'group',
        origin: 'project',
        source: null,
        components: [],
        content: {},
      }
      model.instances[id] = {
        id,
        definitionId: id,
        slideId: 's1',
        parentInstanceId,
        localTransform,
        paintIndex: 0,
        overrides: {},
      }
    }
    model.instances.i1.parentInstanceId = 'inner'
    model.instances.i1.localTransform = [1, 0.25, 0, 1, 0, 0]
    initial.slides[0].elements[0].x = 260
    initial.slides[0].elements[0].y = 120
    const before = structuredClone(initial)
    const next = edit(initial, { type: 'extent', width: 952500 })
    expect(next.slides[0].elements[0].width).toBeCloseTo(Math.hypot(0.375, 2) * 100, 10)
    expect(next.slides[0].elements[0]).toMatchObject({ x: 260, y: 120, height: 120 })
    expect(semanticElement(next.pptxSemantic, 'inner')).toMatchObject({
      x: 0,
      y: 0,
      width: 100,
      height: 105,
    })
    expect(semanticElement(next.pptxSemantic, 'outer')).toMatchObject({
      x: -90,
      y: -20,
      width: 100,
      height: 52.5,
    })
    expect(next.pptxSemantic.instances.outer).toEqual(before.pptxSemantic.instances.outer)
    expect(next.pptxSemantic.instances.inner).toEqual(before.pptxSemantic.instances.inner)
    expect(next.pptxSemantic.instances.i1.localTransform).toEqual(
      before.pptxSemantic.instances.i1.localTransform
    )
    expect(next.pptxSemantic.instances.i1.parentInstanceId).toBe('inner')
    expect(next.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
    expect(next.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(next.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    const locked = structuredClone(next)
    locked.pptxSemantic.instances.outer.overrides.locked = true
    const lockedBefore = structuredClone(locked)
    expect(() => edit(locked, { type: 'extent', height: 0 })).toThrow()
    expect(locked).toEqual(lockedBefore)
    expect(initial).toEqual(before)
  })

  it('starts from an arbitrary valid structural override rather than reconstructing source', () => {
    const initial = extentProjectionFixture()
    const structural = materializeGeometry(initial.pptxSemantic, 'i1')
    delete structural.style
    structural.height = 571500
    structural.paths[0].commands[1].points[0].x = 25
    initial.pptxSemantic.instances.i1.overrides.components = {
      geometry: {
        geometryDocument: structural,
        geometryStyle: { stroke: { cap: 'flat' } },
      },
    }
    const before = structuredClone(initial)
    const next = edit(initial, { type: 'extent', width: 952500 })
    expect(next.pptxSemantic.instances.i1.overrides.components.geometry).toEqual({
      geometryDocument: { ...structural, width: 952500 },
      geometryStyle: { stroke: { cap: 'flat' } },
    })
    expect(next.slides[0].elements[0]).toMatchObject({ width: 100, height: 60 })
    expect(initial).toEqual(before)
  })

  it.each([false, true])(
    'cannot mask malformed protected source extents with an override (hidden %s)',
    (hidden) => {
      const initial = extentProjectionFixture()
      const structural = materializeGeometry(initial.pptxSemantic, 'i1')
      delete structural.style
      structural.width = 952500
      initial.pptxSemantic.instances.i1.overrides.components = {
        geometry: { geometryDocument: structural },
      }
      initial.pptxSemantic.instances.i1.overrides.hidden = hidden
      initial.pptxSemantic.styles.provider.payload.transform.value.ext.value.cx.value = -1
      const before = structuredClone(initial)
      expect(() => normalizeSemanticPresentation(initial)).toThrow()
      expect(() => edit(initial, { type: 'extent', width: 1905000 })).toThrow()
      expect(initial).toEqual(before)
    }
  )

  it.each(['component', 'slide', 'instance', 'inactive'])(
    'rejects invalid %s targets without mutation',
    (guard) => {
      const initial = extentProjectionFixture()
      if (guard === 'slide') initial.slides[0].locked = true
      if (guard === 'instance') initial.pptxSemantic.instances.i1.overrides.locked = true
      if (guard === 'inactive') initial.pptxSemantic.instances.i1.lineage = { tombstone: true }
      const before = structuredClone(initial)
      expect(() => operationsForGuard()).toThrow()
      expect(initial).toEqual(before)
      function operationsForGuard() {
        return applyPresentationProjectionOperation(initial, {
          type: 'geometry.edit',
          instanceId: 'i1',
          componentId: guard === 'component' ? 'other' : 'geometry',
          command: { type: 'extent', width: 952500 },
        })
      }
    }
  )

  it.each([
    [0, 762000, { width: 952500 }, 100, 80],
    [952500, 0, { height: 762000 }, 100, 80],
    [0, 0, { width: 952500, height: 762000 }, 100, 80],
    [952500, 762000, { width: 0 }, 0, 80],
  ])(
    'publishes native %s by %s dimensions with world caches and local frames atomically',
    (width, height, patch, localWidth, localHeight) => {
      const initial = extentProjectionFixture(width, height)
      initial.pptxSemantic.instances.i1.localTransform = [-2, 0, 0, 3, 1905000, -95250]
      const before = structuredClone(initial)
      const next = edit(initial, { type: 'extent', ...patch })
      const component = next.pptxSemantic.instances.i1.overrides.components.geometry
      expect(component.geometryDocument).toMatchObject({
        width: localWidth * 9525,
        height: localHeight * 9525,
      })
      expect(component.geometryDocument).not.toHaveProperty('style')
      expect(next.slides[0].elements[0]).toMatchObject({
        width: localWidth * 2,
        height: localHeight * 3,
      })
      expect(semanticElement(next.pptxSemantic, 'i1', next.slides[0].elements[0])).toMatchObject({
        width: localWidth,
        height: localHeight,
      })
      const cache = semanticCompatibility(
        next.pptxSemantic,
        initial.slides[0],
        initial.pptxSemantic
      )
      expect(cache.elements[0]).toMatchObject({
        width: localWidth * 2,
        height: localHeight * 3,
      })
      const local = semanticRenderTree(next.pptxSemantic, next.slides[0])[0].element
      expect(local).toMatchObject({ width: localWidth, height: localHeight })
      const html = renderSlideElements(next.slides[0], { pptxSemantic: next.pptxSemantic })
      expect(html).toContain(`width:${localWidth}px;height:${localHeight}px`)
      expect(normalizeSemanticPresentation(JSON.parse(JSON.stringify(next)))).toEqual(next)
      expect(next.pptxSemantic.instances.i1.localTransform).toEqual(
        before.pptxSemantic.instances.i1.localTransform
      )
      expect(next.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
      expect(next.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
      expect(next.pptxSemantic.instances.i2).toEqual(before.pptxSemantic.instances.i2)
      expect(initial).toEqual(before)
    }
  )

  it('keeps a collapsed-axis point displacement and sparse paint while changing extent', () => {
    const initial = extentProjectionFixture()
    const geometry = materializeGeometry(initial.pptxSemantic, 'i1')
    const point = geometry.paths[0].commands[1].points[0]
    const displaced = edit(initial, {
      type: 'control-point',
      componentId: point.componentId,
      localOffset: { x: 19050, y: 0 },
    })
    const painted = edit(displaced, { type: 'stroke-cap', cap: 'flat' })
    const next = edit(painted, { type: 'extent', width: 952500 })
    expect(next.pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle).toEqual(
      painted.pptxSemantic.instances.i1.overrides.components.geometry.geometryStyle
    )
    const effective = materializeGeometry(next.pptxSemantic, 'i1')
    expect(effective.paths[0].commands[1].points[0].localOffset).toEqual({ x: 19050, y: 0 })
    expect(
      deriveGeometryPaths(effective, { projectToLocal: true }).paths[0].segments[1].points[1]
    ).toEqual({ x: 971550, y: 762000 })
  })

  it('regenerates source-bound frame caches on JSON reload without a matrix change', () => {
    const initial = extentProjectionFixture()
    const restored = normalizeSemanticPresentation(JSON.parse(JSON.stringify(initial)))
    expect(restored.slides[0].elements[0]).toMatchObject({ width: 0, height: 80 })
    expect(restored.pptxSemantic.instances.i1.localTransform).toEqual(
      initial.pptxSemantic.instances.i1.localTransform
    )
  })

  it('retains legacy schema1 frame units and rejects the new native command atomically', () => {
    const legacy = geometryProjectionFixture()
    const before = structuredClone(legacy)
    const normalized = normalizeSemanticPresentation(legacy)
    expect(
      semanticElement(normalized.pptxSemantic, 'i1', normalized.slides[0].elements[0])
    ).toMatchObject({ width: 100, height: 80 })
    const pointEdited = edit(legacy, { type: 'control-point', componentId: 'control', x: 25 })
    expect(
      semanticElement(pointEdited.pptxSemantic, 'i1', pointEdited.slides[0].elements[0])
    ).toMatchObject({ width: 100, height: 80 })
    expect(() => edit(legacy, { type: 'extent', width: 952500 })).toThrow(TypeError)
    expect(legacy).toEqual(before)
  })
})
