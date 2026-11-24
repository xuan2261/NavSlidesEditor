import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import semantic from '../../shared/src/pptx-semantic-presentation.js'
import styles from '../../shared/src/pptx-geometry-style-resolution.js'
import { geometryGroupFillFixture } from './geometry-group-fill-fixture.js'
import {
  createSemanticClipboard,
  pasteSemanticClipboard,
} from '../../client/src/utils/pptx-semantic-clipboard.js'

const require = createRequire(import.meta.url)
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline.js')

function extentFixture(extent = { cx: 150.25, cy: 30.5 }) {
  const fixture = { ...geometryGroupFillFixture(), id: 'native-extent-authority' }
  if (extent !== undefined) fixture.pptxSemantic.instances.i1.sourceBinding.nativeExtent = extent
  return structuredClone(semantic.normalizeSemanticPresentation(fixture))
}

function changeExtent(binding, alteration) {
  if (alteration === 'removed') delete binding.nativeExtent
  else binding.nativeExtent = { cx: 17, cy: 9 }
}

describe('source-bound native logical extent', () => {
  it('materializes the occurrence frame without changing its source or sibling through JSON', () => {
    const fixture = geometryGroupFillFixture()
    const source = structuredClone(fixture.pptxSemantic.definitions)
    const declarations = structuredClone(fixture.pptxSemantic.styles)
    fixture.pptxSemantic.instances.i1.sourceBinding.nativeExtent = { cx: 150.25, cy: 30.5 }
    const before = semantic.normalizeSemanticPresentation(fixture)
    const reopened = semantic.normalizeSemanticPresentation(JSON.parse(JSON.stringify(before)))
    expect(styles.materializeGeometry(reopened.pptxSemantic, 'i1')).toMatchObject({
      width: 150.25,
      height: 30.5,
    })
    expect(styles.materializeGeometry(reopened.pptxSemantic, 'i2')).toMatchObject({
      width: 100,
      height: 80,
    })
    expect(reopened.pptxSemantic.instances.i1.sourceBinding.nativeExtent).toEqual({
      cx: 150.25,
      cy: 30.5,
    })
    expect(reopened.pptxSemantic.instances.i1.overrides).toEqual({})
    expect(reopened.pptxSemantic.definitions).toEqual(source)
    expect(reopened.pptxSemantic.styles).toEqual(declarations)
  })

  it.each([
    null,
    [],
    { cx: 1 },
    { cx: '1', cy: 2 },
    { cx: -1, cy: 2 },
    { cx: Infinity, cy: 2 },
    { cx: NaN, cy: 2 },
    { cx: 1, cy: 2, unknown: 3 },
  ])('rejects malformed native extent %#', (nativeExtent) => {
    const fixture = geometryGroupFillFixture()
    fixture.pptxSemantic.instances.i1.sourceBinding.nativeExtent = nativeExtent
    expect(() => semantic.normalizeSemanticPresentation(fixture)).toThrow()
  })

  it('does not accept leaf logical extent metadata on a source group', () => {
    const fixture = geometryGroupFillFixture()
    fixture.pptxSemantic.instances.g1.sourceBinding.nativeExtent = { cx: 100, cy: 80 }
    expect(() => semantic.normalizeSemanticPresentation(fixture)).toThrow()
  })

  it.each([
    { cx: 0, cy: 0 },
    { cx: 0, cy: 30.5 },
  ])('preserves a zero extent %#', (extent) => {
    const before = extentFixture(extent)
    const model = semantic.normalizeSemanticPresentation(
      JSON.parse(JSON.stringify(before))
    ).pptxSemantic
    expect(styles.materializeGeometry(model, 'i1')).toMatchObject({
      width: extent.cx,
      height: extent.cy,
    })
  })

  it('keeps explicit geometry edits authoritative over source-native extent', () => {
    const fixture = extentFixture()
    const geometry = styles.materializeGeometry(fixture.pptxSemantic, 'i1')
    delete geometry.style
    geometry.width = 17
    geometry.height = 9
    fixture.pptxSemantic.instances.i1.overrides.components = {
      [geometry.componentId]: { geometryDocument: geometry },
    }
    const reopened = semantic.normalizeSemanticPresentation(JSON.parse(JSON.stringify(fixture)))
    expect(styles.materializeGeometry(reopened.pptxSemantic, 'i1')).toMatchObject({
      width: 17,
      height: 9,
    })
    expect(reopened.pptxSemantic.instances.i1.sourceBinding.nativeExtent).toEqual({
      cx: 150.25,
      cy: 30.5,
    })
  })
})

describe('native extent source authority', () => {
  it('admits genuine complete source group copies with their native extent through JSON', () => {
    const before = extentFixture()
    const { presentation: after } = pasteSemanticClipboard({
      presentation: before,
      slideId: 's2',
      clipboard: createSemanticClipboard({
        presentation: before,
        slide: before.slides[0],
        selectedElementIds: ['g1'],
      }),
    })
    const reopened = semantic.normalizeSemanticPresentation(JSON.parse(JSON.stringify(after)))
    expect(() => assertSemanticBaseline(before, reopened)).not.toThrow()
    const leaf = Object.values(reopened.pptxSemantic.instances).find(
      (i) => !before.pptxSemantic.instances[i.id] && i.sourceBinding?.nativeExtent
    )
    expect(leaf.sourceBinding).toEqual(before.pptxSemantic.instances.i1.sourceBinding)
    expect(styles.materializeGeometry(reopened.pptxSemantic, leaf.id)).toMatchObject({
      width: 150.25,
      height: 30.5,
    })
  })

  it.each(['added', 'removed', 'changed'])(
    'rejects %s native metadata on a fabricated new server clone',
    (alteration) => {
      const before = extentFixture()
      if (alteration === 'added') delete before.pptxSemantic.instances.i1.sourceBinding.nativeExtent
      const after = structuredClone(before)
      const copy = structuredClone(after.pptxSemantic.instances.i1)
      copy.id = 'external-leaf'
      changeExtent(copy.sourceBinding, alteration)
      after.pptxSemantic.instances[copy.id] = copy
      after.slides[0].elements.push({
        ...structuredClone(after.slides[0].elements[0]),
        id: 'external-element',
        pptxInstanceId: copy.id,
      })
      const valid = semantic.normalizeSemanticPresentation(after)
      expect(() => assertSemanticBaseline(before, valid)).toThrow()
      expect(before.pptxSemantic.instances).not.toHaveProperty(copy.id)
    }
  )

  it.each(['added', 'removed', 'changed'])(
    'rejects %s native metadata from a clipboard occurrence absent from live state',
    (alteration) => {
      const before = extentFixture()
      if (alteration === 'added') delete before.pptxSemantic.instances.i1.sourceBinding.nativeExtent
      const clipboard = structuredClone(
        createSemanticClipboard({
          presentation: before,
          slide: before.slides[0],
          selectedElementIds: ['g1'],
        })
      )
      const copied = clipboard.document.instances.i1
      delete clipboard.document.instances.i1
      copied.id = 'external-leaf'
      changeExtent(copied.sourceBinding, alteration)
      clipboard.document.instances[copied.id] = copied
      clipboard.elements.find((e) => e.pptxInstanceId === 'i1').pptxInstanceId = copied.id
      semantic.normalizeSemanticPresentation({
        ...before,
        pptxSemantic: clipboard.document,
        slides: before.slides.map((slide) =>
          slide.id === clipboard.source.slideId ? { ...slide, elements: clipboard.elements } : slide
        ),
      })
      const untouched = structuredClone(before)
      expect(() =>
        pasteSemanticClipboard({ presentation: before, slideId: 's2', clipboard })
      ).toThrow()
      expect(before).toEqual(untouched)
    }
  )

  it.each(['added', 'removed', 'changed'])(
    'rejects %s native metadata on an existing source occurrence',
    (alteration) => {
      const before = extentFixture()
      if (alteration === 'added') delete before.pptxSemantic.instances.i1.sourceBinding.nativeExtent
      const after = structuredClone(before)
      changeExtent(after.pptxSemantic.instances.i1.sourceBinding, alteration)
      semantic.normalizeSemanticPresentation(after)
      expect(() => assertSemanticBaseline(before, after)).toThrow()
      const clipboard = structuredClone(
        createSemanticClipboard({
          presentation: before,
          slide: before.slides[0],
          selectedElementIds: ['g1'],
        })
      )
      changeExtent(clipboard.document.instances.i1.sourceBinding, alteration)
      expect(() =>
        pasteSemanticClipboard({ presentation: before, slideId: 's2', clipboard })
      ).toThrow()
    }
  )
})
