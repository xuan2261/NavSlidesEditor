import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import semantic from '../../shared/src/pptx-semantic-presentation.js'
import styles from '../../shared/src/pptx-geometry-style-resolution.js'
import { geometryGroupFillFixture } from './geometry-group-fill-fixture.js'
const require = createRequire(import.meta.url)
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline.js')

function copiedFixture(slideId) {
  const before = semantic.normalizeSemanticPresentation(geometryGroupFillFixture())
  const after = structuredClone(before)
  const model = after.pptxSemantic
  model.instances.groupCopy = {
    ...structuredClone(model.instances.g1),
    id: 'groupCopy',
    slideId,
    paintIndex: 10,
  }
  model.instances.leafCopy = {
    ...structuredClone(model.instances.i1),
    id: 'leafCopy',
    slideId,
    parentInstanceId: 'groupCopy',
  }
  after.slides
    .find((slide) => slide.id === slideId)
    .elements.push({
      ...structuredClone(before.slides[0].elements[0]),
      id: 'leaf-copy-element',
      pptxInstanceId: 'leafCopy',
    })
  return { before, after }
}

describe('baseline-owned copied source group admission', () => {
  it.each(['s1', 's2'])(
    'persists a complete copied group on %s using existing source context',
    (slideId) => {
      const { before, after } = copiedFixture(slideId)
      const normalized = semantic.normalizeSemanticPresentation(after)
      expect(() => assertSemanticBaseline(before, normalized)).not.toThrow()
      const reopened = semantic.normalizeSemanticPresentation(
        JSON.parse(JSON.stringify(normalized))
      )
      expect(() => assertSemanticBaseline(before, reopened)).not.toThrow()
      expect(reopened.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
      expect(reopened.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
      expect(
        styles.materializeGeometry(reopened.pptxSemantic, 'leafCopy').style.fill.color.value
      ).toBe('FF0000')
      expect(styles.geometryFillFrame(reopened.pptxSemantic, 'leafCopy').ownerInstanceId).toBe(
        'groupCopy'
      )
      expect(
        reopened.slides
          .flatMap((slide) => slide.elements)
          .some((element) => element.pptxInstanceId === 'groupCopy')
      ).toBe(false)
    }
  )
  it.each(['new-context', 'wrong-kind', 'wrong-chain', 'changed-source'])(
    'rejects %s authority instead of adopting a client group assertion',
    (alteration) => {
      const { before, after } = copiedFixture('s2')
      const model = after.pptxSemantic
      if (alteration === 'new-context') {
        model.styles.forged = structuredClone(model.styles.groupContext1)
        model.instances.groupCopy.sourceBinding = { contextId: 'forged' }
      } else if (alteration === 'wrong-kind') {
        model.instances.groupCopy.sourceBinding = structuredClone(model.instances.i1.sourceBinding)
      } else if (alteration === 'wrong-chain') {
        model.instances.groupCopy.relationshipChain = []
      } else {
        model.styles.groupProvider.payload.transform.value.ext.value.cx.value += 1
      }
      const untouched = structuredClone(after)
      expect(() => assertSemanticBaseline(before, after)).toThrow()
      expect(after).toEqual(untouched)
    }
  )
})
