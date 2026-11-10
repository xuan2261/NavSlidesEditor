// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { useSlideOperations } from '../../client/src/hooks/use-slide-operations.js'
import { projectHyperlinks } from './hyperlink-source-fixture.js'
import { fieldPart } from './field-fixtures.js'
const require = createRequire(import.meta.url)
const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline')
const { resolveRunHyperlink } = require('../../shared/src/pptx-source-slide-references')

describe('source-bound slide deletion', () => {
  it.each(['single', 'multiple', 'child', 'parent'])('retains source identities and disables removed source destinations via %s deletion', async (mode) => {
    const { presentation } = await projectHyperlinks()
    let deck = structuredClone(presentation)
    deck.slides.push({ id: 'authored-container', elements: [] })
    const target = deck.slides[1]
    if (mode === 'child' || mode === 'parent') {
      deck.slides[2].children = [target]
      deck.slides.splice(1, 1)
    }
    const before = structuredClone(deck)
    const definition = Object.values(deck.pptxSemantic.definitions).find((entry) => entry.source.partUri === fieldPart)
    const link = definition.content.textDocument.paragraphs.flatMap((p) => p.runs).find((run) => run.hyperlinks).hyperlinks.hover
    const removedSlides = new Set(mode === 'parent' || mode === 'multiple'
      ? [target.id, deck.slides.at(-1).id] : [target.id])
    const { result, unmount } = renderHook(() => useSlideOperations({
      presentation: deck,
      setPresentation: (update) => { deck = typeof update === 'function' ? update(deck) : update },
      currentSlideIndex: 0, setCurrentSlideIndex: () => {}, currentSlideIndexRef: { current: 0 },
      selectedElementIdsRef: { current: [] }, editingElementIdRef: { current: null },
    }))
    try {
      act(() => {
        if (mode === 'multiple') result.current.deleteSlides([1, 2])
        else if (mode === 'child') result.current.deleteChildSlide(1, 0)
        else result.current.deleteSlide(1)
      })
      const reopened = normalizeSemanticPresentation(JSON.parse(JSON.stringify(deck)))
      expect(resolveRunHyperlink(reopened, link)).toEqual({ status: 'unresolved', reason: 'missing-target' })
      expect(reopened.pptxSemantic.sourceSlides).toEqual(before.pptxSemantic.sourceSlides)
      expect(reopened.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
      expect(() => assertSemanticBaseline(before, reopened)).not.toThrow()
      for (const [id, instance] of Object.entries(before.pptxSemantic.instances)) {
        if (removedSlides.has(instance.slideId)) {
          expect(reopened.pptxSemantic.instances[id]).toEqual(JSON.parse(JSON.stringify({
            ...instance, lineage: { ...instance.lineage, tombstone: true, deleted: true },
          })))
        } else {
          expect(deck.pptxSemantic.instances[id]).toEqual(instance)
          expect(reopened.pptxSemantic.instances[id]).toEqual(JSON.parse(JSON.stringify(instance)))
        }
      }
      expect(presentation.pptxSemantic).toEqual(before.pptxSemantic)
    } finally { unmount() }
  })
})
