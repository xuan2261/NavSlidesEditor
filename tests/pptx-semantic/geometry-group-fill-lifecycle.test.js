import { describe, expect, it } from 'vitest'
import groups from '../../shared/src/pptx-semantic-groups.js'
import semantic from '../../shared/src/pptx-semantic-presentation.js'
import styles from '../../shared/src/pptx-geometry-style-resolution.js'
import { geometryGroupFillFixture } from './geometry-group-fill-fixture.js'

describe('source group fill authoring lifecycle', () => {
  it.each(['color', 'none', 'absent'])(
    'retains a paint-only source scope after ungroup with %s paint at opacity one',
    (kind) => {
      const fixture = geometryGroupFillFixture()
      if (kind === 'absent')
        delete fixture.pptxSemantic.styles.groupProvider.payload.properties.fill
      if (kind === 'none')
        fixture.pptxSemantic.styles.groupProvider.payload.properties.fill.value.color.value = {
          kind: 'none',
        }
      const before = semantic.normalizeSemanticPresentation(fixture).pptxSemantic
      const beforeGeometry = styles.materializeGeometry(before, 'i1')
      const beforeWorld = groups.instanceWorldTransform(before, 'i1')
      const ungrouped = groups.ungroupSemanticInstance(before, 'g1')
      expect(ungrouped.instances.g1.lineage).toEqual({ paintOnly: true })
      expect(ungrouped.instances.i1.parentInstanceId).toBe('g1')
      expect(styles.materializeGeometry(ungrouped, 'i1')).toEqual(beforeGeometry)
      expect(groups.instanceWorldTransform(ungrouped, 'i1')).toEqual(beforeWorld)
      expect(ungrouped.styles).toEqual(before.styles)
      expect(ungrouped.definitions).toEqual(before.definitions)
      expect(ungrouped.instances.g2).toEqual(before.instances.g2)
      expect(ungrouped.instances.i2).toEqual(before.instances.i2)
      expect(() => groups.moveSemanticInstance(ungrouped, 'g1', { x: 1, y: 2 })).toThrow(
        'Paint scope'
      )
      const reopened = semantic.normalizeSemanticPresentation(
        JSON.parse(
          JSON.stringify({
            ...fixture,
            pptxSemantic: ungrouped,
          })
        )
      ).pptxSemantic
      expect(styles.materializeGeometry(reopened, 'i1')).toEqual(beforeGeometry)
      const moved = groups.moveSemanticInstance(reopened, 'i1', { x: 10, y: 20 })
      expect(styles.materializeGeometry(moved, 'i1').style.fill).toEqual(beforeGeometry.style.fill)
      expect(groups.instanceWorldTransform(moved, 'i1')[4]).toBe(beforeWorld[4] + 10)
      expect(groups.instanceWorldTransform(moved, 'i1')[5]).toBe(beforeWorld[5] + 20)
      const regrouped = groups.regroupSemanticInstance(reopened, 'g1', ['i1'])
      expect(regrouped.instances.g1.lineage).toEqual({ paintOnly: false })
      expect(styles.materializeGeometry(regrouped, 'i1')).toEqual(beforeGeometry)
      expect(regrouped.styles).toEqual(before.styles)
      expect(regrouped.definitions).toEqual(before.definitions)
    }
  )
})
