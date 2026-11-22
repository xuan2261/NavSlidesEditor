// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SlideThumbnailPreview } from '../../client/src/components/slide-panel/slide-thumbnail-preview'
import semantic from '../../shared/src/pptx-semantic-document.js'
import tree from '../../shared/src/pptx-semantic-render-tree.js'
import { geometryProjectionFixture } from './geometry-projection-fixture.js'
import { authored, geometryStyleFixture } from './geometry-style-fixture.js'

function fixture() {
  return {
    slide: geometryProjectionFixture().slides[0],
    input: semantic.normalizePptxSemanticDocument(geometryStyleFixture()),
  }
}

function changedStyles(input, change) {
  const styles = { ...input.styles }
  if (change === 'theme') {
    styles.projectTheme = {
      kind: 'theme-override',
      origin: 'project',
      baseStyleId: 'theme',
      values: { colors: { accent2: { kind: 'srgb', value: 'ABCDEF' } } },
    }
  } else {
    styles.provider = structuredClone(styles.provider)
    styles.provider.payload.properties.fill = authored({
      color: authored({ kind: 'srgb', value: 'ABCDEF' }),
    })
  }
  return semantic.normalizePptxSemanticDocument({ ...input, styles })
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 240 })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('semantic render cache public ownership and dependencies', () => {
  it('returns detached mutable outputs without poisoning later projections or caller data', () => {
    const { input, slide } = fixture()
    const sourceSlide = structuredClone(slide)
    const sourceInput = structuredClone(input)
    const original = tree.semanticRenderTree(input, slide)
    const repeated = tree.semanticRenderTree(input, slide)
    expect(repeated).not.toBe(original)
    expect(repeated[0].element).not.toBe(original[0].element)
    expect(repeated).toEqual(original)

    original[0].element.fill = '#000000'
    original[0].element.pptxGeometry.paths[0].commands[0].points[0].x = 99
    original[0].children.push({ hidden: true })
    original.pop()
    expect(tree.semanticRenderTree(input, slide)).toEqual(repeated)
    expect(repeated[0].element.fill).toBe('#FF0000')
    expect(slide).toEqual(sourceSlide)
    expect(input).toEqual(sourceInput)

    // A new array is not required to observe an in-place slide element edit.
    slide.elements[0].hidden = true
    expect(tree.semanticRenderTree(input, slide)[0].hidden).toBe(true)
    slide.elements = [...sourceSlide.elements]
    expect(tree.semanticRenderTree(input, slide)).toEqual(repeated)
    const nextInput = semantic.normalizePptxSemanticDocument({ ...input })
    expect(tree.semanticRenderTree(nextInput, slide)).toEqual(repeated)
  })

  it('recomputes field values for new and mutated contexts without changing source fields', () => {
    const document = geometryProjectionFixture().pptxSemantic
    document.definitions.definition.components.push(...['body', 'paragraph', 'number', 'title', 'date'].map((id, index) => ({
      id, kind: index < 2 ? 'paragraph' : 'run',
      locator: { path: [1, index], preconditionHash: 'a'.repeat(64) },
    })))
    document.definitions.definition.content.textDocument = {
      schemaVersion: 1,
      componentId: 'body',
      body: { autofit: { mode: 'none' } },
      paragraphs: [{ componentId: 'paragraph', runs: [
        { componentId: 'number', kind: 'field', text: 'Cached number', field: { id: 'n', type: 'slidenum' } },
        { componentId: 'title', kind: 'field', text: 'Cached title', field: { id: 't', type: 'slidetitle' } },
        { componentId: 'date', kind: 'field', text: 'Cached date', field: { id: 'd', type: 'datetime1' } },
      ] }],
    }
    const input = semantic.normalizePptxSemanticDocument(document)
    const slide = geometryProjectionFixture().slides[0]
    const runs = result => result[0].element.pptxTextDocument.paragraphs[0].runs
    const texts = result => runs(result).map(run => run.text)
    const original = tree.semanticRenderTree(input, slide)
    expect(texts(original)).toEqual(['Cached number', 'Cached title', 'Cached date'])
    const context = { slideNumber: 1, slideTitle: 'First', date: new Date('2026-10-21T12:00:00Z'), locale: 'en-GB', timeZone: 'UTC' }
    const contextual = tree.semanticRenderTree(input, slide, context)
    expect(texts(contextual)).toEqual(['1', 'First', '21/10/2026'])
    runs(contextual)[0].field.type = 'caller mutation'
    runs(contextual)[1].text = 'caller mutation'
    expect(texts(tree.semanticRenderTree(input, slide, context))).toEqual(['1', 'First', '21/10/2026'])
    expect(runs(tree.semanticRenderTree(input, slide, context))[0].field).toEqual({ id: 'n', type: 'slidenum' })
    expect(texts(tree.semanticRenderTree(input, slide, { ...context, slideNumber: 2 }))).toEqual(['2', 'First', '21/10/2026'])
    context.slideNumber = 3
    context.slideTitle = 'Updated'
    context.date.setUTCDate(22)
    expect(texts(tree.semanticRenderTree(input, slide, context))).toEqual(['3', 'Updated', '22/10/2026'])
    expect(tree.semanticRenderTree(input, slide)).toEqual(original)
    expect(input.definitions.definition.content.textDocument.paragraphs[0].runs[0].text).toBe('Cached number')
  })

  it.each([false, true])('refreshes nested edits on mutable documents (shallow freeze: %s)', shallow => {
    const deck = geometryProjectionFixture()
    const input = shallow ? Object.freeze(deck.pptxSemantic) : deck.pptxSemantic
    const before = tree.semanticRenderTree(input, deck.slides[0])
    input.instances.i1.localTransform[4] = 1905000
    const after = tree.semanticRenderTree(input, deck.slides[0])
    expect(before[0].transform).toBe('matrix(-1,0,0,1,100,0)')
    expect(after[0].transform).toBe('matrix(-1,0,0,1,200,0)')
    input.instances.i1.localTransform[4] = NaN
    expect(() => tree.semanticRenderTree(input, deck.slides[0])).toThrow()
  })

  it.each(['declarations', 'theme'])('recomputes %s with shared instances and definitions', change => {
    const { input, slide } = fixture()
    const original = tree.semanticRenderTree(input, slide)
    const changed = changedStyles(input, change)
    expect(changed.instances).toBe(input.instances)
    expect(changed.definitions).toBe(input.definitions)

    const updated = tree.semanticRenderTree(changed, slide)
    expect(updated).not.toBe(original)
    expect(updated[0].element.fill).toBe('#ABCDEF')
    expect(original[0].element.fill).toBe('#FF0000')
    updated[0].element.fill = '#000000'
    updated[0].element.pptxGeometry.paths[0].commands[0].points[0].x = 99
    const repeated = tree.semanticRenderTree(changed, slide)
    expect(repeated[0].element.fill).toBe('#ABCDEF')
    expect(repeated[0].element.pptxGeometry.paths[0].commands[0].points[0].x).toBe(0)
    expect(tree.semanticRenderTree(input, slide)[0].element.fill).toBe('#FF0000')
  })

  it.each(['declarations', 'theme'])('refreshes thumbnail projection after changed %s', change => {
    const { input, slide } = fixture()
    const preview = pptxSemantic => (
      <SlideThumbnailPreview slide={slide} pptxSemantic={pptxSemantic} width={960} height={540} />
    )
    const { container, rerender } = render(preview(input))
    const paint = () => container.querySelector('svg > g > path[data-pptx-geometry-path="path"]').style.fill
    expect(container.querySelector('[data-thumbnail-error]')).toBeNull()
    expect(paint()).toBe('#FF0000')

    const changed = changedStyles(input, change)
    rerender(preview(changed))
    expect(container.querySelector('[data-thumbnail-error]')).toBeNull()
    expect(paint()).toBe('#ABCDEF')

    rerender(preview(input))
    expect(paint()).toBe('#FF0000')
  })
})
