// Synthetic occurrence edit contract, not full dashboard or native qualification.
import { describe, expect, it } from 'vitest'
import operations from '../../shared/src/pptx-projection-operation.js'
import capabilities from '../../shared/src/pptx-projection-capabilities.js'
import semantic from '../../shared/src/pptx-semantic-presentation.js'
import styles from '../../shared/src/pptx-geometry-style-resolution.js'
import { geometryGroupFillFixture } from './geometry-group-fill-fixture.js'
import { styleLocation } from './geometry-style-fixture.js'
const groupPattern = (presentation) => {
  const wrap = (value) => ({
    source: styleLocation('ppt/slideLayouts/slideLayout1.xml', [0, 1]),
    value,
  })
  presentation.pptxSemantic.styles.groupProvider.payload.properties.fill = wrap({
    pattern: wrap({
      preset: wrap('diagCross'),
      foreground: wrap({ kind: 'scheme', value: 'accent1' }),
      background: wrap({ kind: 'srgb', value: '334455' }),
    }),
  })
}
const operation = (command, instanceId = 'g1', componentId = 'group:group-properties') => ({
  type: 'group.fill.edit',
  instanceId,
  componentId,
  command,
})
const color = { kind: 'srgb', value: 'ABCDEF' }
describe('explicit source owner group occurrence fill edits', () => {
  it('keeps a leaf pattern patch local over the effective owner fill and retains its frame', () => {
    const presentation = geometryGroupFillFixture()
    groupPattern(presentation)
    const before = structuredClone(presentation.pptxSemantic)
    const next = operations.applyPresentationProjectionOperation(presentation, {
      type: 'geometry.edit',
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'fill-pattern', pattern: { preset: 'cross' } },
    })
    expect(styles.materializeGeometry(next.pptxSemantic, 'i1').style.fill.pattern).toEqual({
      preset: 'cross',
      foreground: { kind: 'srgb', value: 'FF0000' },
      background: { kind: 'srgb', value: '334455' },
    })
    expect(styles.geometryFillFrame(next.pptxSemantic, 'i1').ownerInstanceId).toBe('g1')
    expect(next.pptxSemantic.instances.g1).toEqual(before.instances.g1)
    expect(next.pptxSemantic.instances.i2).toEqual(before.instances.i2)
    expect(next.pptxSemantic.styles).toEqual(before.styles)
    expect(next.pptxSemantic.definitions).toEqual(before.definitions)
  })
  it('rejects an owner paint-kind change incompatible with a descendant sparse pattern patch', () => {
    const presentation = geometryGroupFillFixture()
    groupPattern(presentation)
    const patched = operations.applyPresentationProjectionOperation(presentation, {
      type: 'geometry.edit',
      instanceId: 'i1',
      componentId: 'geometry',
      command: { type: 'fill-pattern', pattern: { preset: 'cross' } },
    })
    const before = structuredClone(patched)
    expect(() =>
      operations.applyPresentationProjectionOperation(
        patched,
        operation({ type: 'fill-paint', color })
      )
    ).toThrow()
    expect(patched).toEqual(before)
  })
  it('advertises group fill without geometry edit or fabricated slide element', () => {
    const presentation = geometryGroupFillFixture()
    expect(
      capabilities.getProjectionCapabilities(presentation.pptxSemantic, 'g1').operations
    ).toEqual(['group.fill.edit'])
    expect(
      capabilities.getProjectionCapabilities(presentation.pptxSemantic, 'i1').operations
    ).toEqual(['geometry.edit', 'inheritance.edit'])
  })
  it('edits only the chosen group occurrence and keeps explicit leaf fills separate', () => {
    const presentation = geometryGroupFillFixture()
    presentation.pptxSemantic.instances.i3 = {
      ...structuredClone(presentation.pptxSemantic.instances.i1),
      id: 'i3',
      paintIndex: 1,
      overrides: {
        components: {
          geometry: { geometryStyle: { fill: { color: { kind: 'srgb', value: '112233' } } } },
        },
      },
    }
    presentation.slides[0].elements.push({
      ...presentation.slides[0].elements[0],
      id: 'i3',
      pptxInstanceId: 'i3',
    })
    const before = structuredClone(semantic.normalizeSemanticPresentation(presentation))
    const edited = operations.applyPresentationProjectionOperation(
      presentation,
      operation({ type: 'fill-paint', color })
    )
    const model = edited.pptxSemantic
    expect(model.instances.g1.overrides).toEqual({
      components: {
        'group:group-properties': { geometryStyle: { fill: { color } } },
      },
    })
    expect(styles.materializeGeometry(model, 'i1').style.fill).toEqual({ color })
    expect(styles.materializeGeometry(model, 'i3').style.fill.color.value).toBe('112233')
    expect(styles.materializeGeometry(model, 'i2').style.fill.color.value).toBe('00FF00')
    expect(model.styles).toEqual(before.pptxSemantic.styles)
    expect(model.definitions).toEqual(before.pptxSemantic.definitions)
    for (const id of ['i1', 'i2', 'i3', 'g2'])
      expect(model.instances[id]).toEqual(before.pptxSemantic.instances[id])
    expect(edited.slides[0].elements).toHaveLength(2)
    expect(
      semantic.normalizeSemanticPresentation(JSON.parse(JSON.stringify(edited))).pptxSemantic
    ).toEqual(JSON.parse(JSON.stringify(model)))
  })
  it('distinguishes noFill from an explicit reset to symbolic source paint', () => {
    const presentation = geometryGroupFillFixture()
    const hidden = operations.applyPresentationProjectionOperation(
      presentation,
      operation({ type: 'fill-paint', color: { kind: 'none' } })
    )
    expect(styles.materializeGeometry(hidden.pptxSemantic, 'i1').style.fill.color.kind).toBe('none')
    const reset = operations.applyPresentationProjectionOperation(
      hidden,
      operation({ type: 'reset' })
    )
    expect(reset.pptxSemantic.instances.g1.overrides).toEqual({})
    expect(styles.materializeGeometry(reset.pptxSemantic, 'i1').style.fill.color.value).toBe(
      'FF0000'
    )
    expect(reset.pptxSemantic.styles).toEqual(presentation.pptxSemantic.styles)
  })
  it.each([
    ['foreign component', (presentation, command) => operation(command, 'g1', 'geometry')],
    ['leaf owner', (presentation, command) => operation(command, 'i1')],
    [
      'unbound project group',
      (presentation, command) => {
        presentation.pptxSemantic.definitions.group.origin = 'project'
        return operation(command)
      },
    ],
    [
      'locked group',
      (presentation, command) => {
        presentation.pptxSemantic.instances.g1.overrides.locked = true
        return operation(command)
      },
    ],
    [
      'locked slide',
      (presentation, command) => {
        presentation.slides[0].locked = true
        return operation(command)
      },
    ],
    [
      'extra command field',
      (presentation, command) => operation({ ...command, src: '/uploads/forged.png' }),
    ],
    ['structural command', () => operation({ type: 'extent', width: 200, height: 80 })],
    ['extra reset field', () => operation({ type: 'reset', color })],
  ])('rejects %s atomically without source or occurrence mutation', (_name, prepare) => {
    const presentation = geometryGroupFillFixture()
    const command = prepare(presentation, { type: 'fill-paint', color })
    const before = structuredClone(presentation)
    expect(() => operations.applyPresentationProjectionOperation(presentation, command)).toThrow()
    expect(presentation).toEqual(before)
  })
})
