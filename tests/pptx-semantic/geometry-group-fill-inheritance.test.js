import { describe, expect, it } from 'vitest'
import semantic from '../../shared/src/pptx-semantic-presentation.js'
import styles from '../../shared/src/pptx-geometry-style-resolution.js'
import records from '../../shared/src/pptx-geometry-style-records.js'
import { geometryGroupFillFixture } from './geometry-group-fill-fixture.js'
function relocateWrappers(value) {
  if (value === null || typeof value !== 'object') return
  if (value.source?.componentLocator) value.source.componentLocator.path = [0, 0]
  for (const child of Object.values(value)) relocateWrappers(child)
}
describe('source-bound group fill authority', () => {
  it.each(['absent', 'noFill'])(
    'walks past a nested %s group to the nearest concrete source paint',
    (kind) => {
      const presentation = geometryGroupFillFixture()
      const document = presentation.pptxSemantic
      const relocate = (value) => {
        if (value === null || typeof value !== 'object') return
        if (value.source?.componentLocator) value.source.componentLocator.path[0] = 1
        for (const child of Object.values(value)) relocate(child)
      }
      const declaration = structuredClone(document.styles.groupProvider)
      relocate(declaration)
      declaration.source.componentLocator.path = [1]
      declaration.payload.definitionId = 'inner'
      declaration.payload.paintComponentId = 'inner:group-properties'
      declaration.payload.properties =
        kind === 'absent'
          ? {}
          : {
              fill: {
                source: {
                  ...structuredClone(declaration.source),
                  componentLocator: {
                    ...structuredClone(declaration.source.componentLocator),
                    path: [1, 1],
                  },
                },
                value: {
                  color: {
                    source: {
                      ...structuredClone(declaration.source),
                      componentLocator: {
                        ...structuredClone(declaration.source.componentLocator),
                        path: [1, 1],
                      },
                    },
                    value: { kind: 'none' },
                  },
                },
              },
            }
      const definition = structuredClone(document.definitions.group)
      definition.id = 'inner'
      definition.source.nativeId = '9'
      definition.source.componentLocator = structuredClone(declaration.source.componentLocator)
      definition.components = [
        {
          id: 'inner:group-properties',
          kind: 'property',
          locator: { path: [1, 1], preconditionHash: definition.source.preconditionHash },
        },
      ]
      definition.content.geometrySource = { styleId: 'innerProvider' }
      document.definitions.inner = definition
      document.styles.innerProvider = declaration
      document.styles.innerContext = {
        ...structuredClone(document.styles.groupContext1),
        source: structuredClone(declaration.source),
        payload: {
          ...structuredClone(document.styles.groupContext1.payload),
          definitionId: 'inner',
          declarationIds: ['innerProvider'],
        },
      }
      document.instances.inner1 = {
        ...structuredClone(document.instances.g1),
        id: 'inner1',
        definitionId: 'inner',
        parentInstanceId: 'g1',
        sourceBinding: { contextId: 'innerContext' },
      }
      document.instances.i1.parentInstanceId = 'inner1'
      const before = structuredClone(document)
      const normalized = semantic.normalizeSemanticPresentation(presentation).pptxSemantic
      expect(styles.materializeGeometry(normalized, 'i1').style.fill.color.value).toBe('FF0000')
      expect(styles.geometryFillFrame(normalized, 'i1').ownerInstanceId).toBe('g1')
      expect(normalized.styles).toEqual(before.styles)
      expect(normalized.definitions).toEqual(before.definitions)
      expect(normalized.instances.i2).toEqual(before.instances.i2)
    }
  )
  it('keeps the authored owner extent and coordinate frame separate from canonical leaf geometry', () => {
    const presentation = geometryGroupFillFixture()
    const document = structuredClone(
      semantic.normalizeSemanticPresentation(presentation).pptxSemantic
    )
    const before = structuredClone(document)
    expect(styles.geometryFillFrame(document, 'i1')).toEqual({
      ownerInstanceId: 'g1',
      componentId: 'group:group-properties',
      width: 100,
      height: 80,
      paintToWorld: [1, 0, 0, 1, 0, 0],
      paintToLeaf: [-2, 0, 0, 0.5, 952500, 0],
    })
    document.instances.g1.localTransform = [0, 1, -1, 0, 350, 400]
    expect(styles.geometryFillFrame(document, 'i1')).toMatchObject({
      ownerInstanceId: 'g1',
      width: 100,
      height: 80,
      paintToWorld: [0, 2, -0.5, 0, 350, 400],
    })
    expect(document.styles).toEqual(before.styles)
    expect(document.definitions).toEqual(before.definitions)
    expect(document.instances.i1).toEqual(before.instances.i1)
    expect(document.instances.g2).toEqual(before.instances.g2)
    expect(styles.materializeGeometry(document, 'i1')).not.toHaveProperty('fillFrame')
  })
  it('a deliberate leaf color replacement detaches only the derived owner paint frame', () => {
    const document = structuredClone(
      semantic.normalizeSemanticPresentation(geometryGroupFillFixture()).pptxSemantic
    )
    const before = structuredClone(document)
    document.instances.i1.overrides = {
      components: {
        geometry: {
          geometryStyle: { fill: { color: { kind: 'srgb', value: 'ABCDEF' } } },
        },
      },
    }
    expect(styles.geometryFillFrame(document, 'i1')).toBeUndefined()
    expect(styles.materializeGeometry(document, 'i1').style.fill.color.value).toBe('ABCDEF')
    expect(styles.geometryFillFrame(document, 'i2').ownerInstanceId).toBe('g2')
    expect(document.styles).toEqual(before.styles)
    expect(document.definitions).toEqual(before.definitions)
    expect(document.instances.i2).toEqual(before.instances.i2)
  })
  it('normalizes exact group contexts without fabricated geometry or group slide elements', () => {
    const before = geometryGroupFillFixture()
    const normalized = semantic.normalizeSemanticPresentation(before)
    const reopened = semantic.normalizeSemanticPresentation(JSON.parse(JSON.stringify(normalized)))
    expect(
      records.geometryProvider(reopened.pptxSemantic, reopened.pptxSemantic.instances.g1).geometry
    ).toBeUndefined()
    expect(styles.materializeGeometry(reopened.pptxSemantic, 'g1')).toBeUndefined()
    expect(reopened.slides[0].elements.map((element) => element.pptxInstanceId)).toEqual(['i1'])
    expect(reopened.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(reopened.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  })
  it('resolves each repeated group occurrence through its own host color context', () => {
    const before = geometryGroupFillFixture()
    const normalized = semantic.normalizeSemanticPresentation(before)
    expect(styles.materializeGeometry(normalized.pptxSemantic, 'i1').style.fill).toEqual({
      color: { kind: 'srgb', value: 'FF0000' },
    })
    expect(styles.materializeGeometry(normalized.pptxSemantic, 'i2').style.fill).toEqual({
      color: { kind: 'srgb', value: '00FF00' },
    })
    expect(before.pptxSemantic.styles.provider.payload.properties.fill.value).toEqual({
      group: true,
    })
    expect(before.pptxSemantic.styles).toEqual(normalized.pptxSemantic.styles)
    expect(normalized.pptxSemantic.instances.i1.overrides).toEqual({})
  })
  it.each([
    [
      'fill wrapper outside the group paint component',
      (document) => {
        relocateWrappers(document.styles.groupProvider.payload.properties.fill)
      },
    ],
    [
      'transform wrapper outside the group paint component',
      (document) => {
        relocateWrappers(document.styles.groupProvider.payload.transform)
      },
    ],
    [
      'paint component that does not contain its declarations',
      (document) => {
        document.definitions.group.components[0].locator.path = [0, 0]
      },
    ],
    [
      'foreign group component',
      (document) => {
        document.styles.groupProvider.payload.paintComponentId = 'geometry'
      },
    ],
    [
      'group context on leaf',
      (document) => {
        document.instances.i1.sourceBinding.contextId = 'groupContext1'
      },
    ],
    [
      'leaf context on group',
      (document) => {
        document.instances.g1.sourceBinding.contextId = 'context1'
      },
    ],
    [
      'group declaration owning another definition',
      (document) => {
        document.styles.groupProvider.payload.definitionId = 'definition'
      },
    ],
    [
      'fabricated group geometry',
      (document) => {
        document.styles.groupProvider.payload.geometry = {
          definitionId: 'group',
          componentId: 'group:group-properties',
        }
      },
    ],
  ])('rejects forged group authority: %s', (_name, mutate) => {
    const presentation = geometryGroupFillFixture()
    semantic.normalizeSemanticPresentation(presentation)
    mutate(presentation.pptxSemantic)
    expect(() => semantic.normalizeSemanticPresentation(presentation)).toThrow()
  })
})
