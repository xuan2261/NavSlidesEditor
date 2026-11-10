import { describe, expect, it, vi } from 'vitest'
import semantic from 'revealjs-shared/src/pptx-semantic-presentation.js'
import timing from 'revealjs-shared/src/pptx-timing-document.js'
import operations from 'revealjs-shared/src/pptx-timing-operations.js'
import { timingLifecycleFixture } from '../../../tests/pptx-semantic/timing-lifecycle-fixture.js'
import { createSemanticClipboard, pasteSemanticClipboard } from './pptx-semantic-clipboard.js'
import { prepareSemanticCut } from './pptx-semantic-cut.js'
import { cloneSlideWithNewIds } from '../hooks/slide-operation-helpers.js'

const nodes = (presentation, slide = presentation.slides[0]) => timing.resolveSlideTiming(presentation.pptxSemantic, slide).nodes
const copy = presentation => createSemanticClipboard({ presentation, slide: presentation.slides[0], selectedElementIds: ['i1'] })
const reopen = presentation => semantic.normalizeSemanticPresentation(JSON.parse(JSON.stringify(presentation)))
const author = (presentation, command, index = 0) => operations.applyTimingPresentationOperation(presentation, {
  type: 'timing.edit', slideId: 's1', definitionId: nodes(presentation)[index].definitionId,
  nodeLocator: nodes(presentation)[index].nodeLocator, command,
})
const paste = (presentation, clipboard, slideId = 's1') => {
  let count = 0
  const ids = vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => `clipboard-fresh-${++count}`)
  try {
    return pasteSemanticClipboard({ presentation, clipboard, slideId }).presentation
  } finally {
    ids.mockRestore()
  }
}
const assertSourceUnchanged = (before, after, snapshot) => {
  expect(before).toEqual(snapshot)
  expect(after.pptxSemantic.definitions).toEqual(snapshot.pptxSemantic.definitions)
  for (const [id, instance] of Object.entries(snapshot.pptxSemantic.instances))
    expect(after.pptxSemantic.instances[id]).toEqual(instance)
  expect(after.slides[1]).toEqual(snapshot.slides[1])
}

describe('source timing clipboard and duplication lifecycle', () => {
  it.each([false, true])('pins only the existing binding affected by same-slide copy (locked=%s)', locked => {
    const before = timingLifecycleFixture()
    before.slides[0].elements[0].locked = locked
    before.pptxSemantic.instances.i1.overrides.locked = locked
    const snapshot = structuredClone(before), clipboard = copy(before)
    expect(before).toEqual(snapshot)
    const after = reopen(paste(before, JSON.parse(JSON.stringify(clipboard))))
    expect(nodes(after)[0]).toMatchObject({ status: 'ready', targetInstanceId: 'i1' })
    expect(after.slides[0].sourceTiming.overrides).toEqual([{
      definitionId: nodes(before)[0].definitionId, nodeLocator: nodes(before)[0].nodeLocator,
      targetInstanceId: 'i1',
    }])
    expect(after.slides[0].elements.at(-1).pptxInstanceId).not.toBe('i1')
    expect(nodes(after)[1]).toEqual(nodes(before)[1])
    assertSourceUnchanged(before, after, snapshot)
  })

  it('retains authored target/order/trigger while preserving sibling occurrence timing', () => {
    let before = timingLifecycleFixture()
    before = author(before, { type: 'set-target', targetInstanceId: 'i1' })
    before = author(before, { type: 'set-trigger', trigger: 'afterPrevious' })
    before = author(before, { type: 'set-order', order: 2 })
    const snapshot = structuredClone(before), after = reopen(paste(before, copy(before)))
    expect(after.slides[0].sourceTiming).toEqual(before.slides[0].sourceTiming)
    expect(nodes(after)).toEqual(nodes(before))
    assertSourceUnchanged(before, after, snapshot)
  })

  it('does not guess a target when the pre-copy source binding is already ambiguous', () => {
    const before = timingLifecycleFixture()
    before.pptxSemantic.instances.alias = { ...structuredClone(before.pptxSemantic.instances.i1), id: 'alias', paintIndex: 2 }
    before.slides[0].elements.push({ ...before.slides[0].elements[0], id: 'alias', pptxInstanceId: 'alias' })
    const snapshot = structuredClone(before), after = paste(before, copy(before))
    expect(nodes(after)[0]).toMatchObject({ status: 'unresolved', reason: 'ambiguous-target' })
    expect(after.slides[0].sourceTiming).toBeUndefined()
    assertSourceUnchanged(before, after, snapshot)
  })

  it('pins destination timing rather than importing the clipboard source slide overlay', () => {
    let before = timingLifecycleFixture()
    before = author(before, { type: 'set-trigger', trigger: 'afterPrevious' })
    const snapshot = structuredClone(before), after = reopen(paste(before, copy(before), 's2'))
    expect(nodes(after, after.slides[1])[0]).toMatchObject({ status: 'ready', targetInstanceId: 'i2', trigger: 'onClick' })
    expect(after.slides[0]).toEqual(snapshot.slides[0])
    expect(after.slides[1].sourceTiming.overrides[0].targetInstanceId).toBe('i2')
    expect(after.pptxSemantic.definitions).toEqual(snapshot.pptxSemantic.definitions)
    expect(before).toEqual(snapshot)
  })

  it.each([false, true])('keeps a deleted target missing instead of redirecting onto the pasted clone (authored=%s)', authored => {
    let before = timingLifecycleFixture()
    if (authored) before = author(before, { type: 'set-target', targetInstanceId: 'i1' })
    const snapshot = structuredClone(before), clipboard = copy(before)
    const mapSlide = (presentation, change) => ({ ...presentation,
      slides: presentation.slides.map(slide => slide.id === 's1' ? change(slide) : slide) })
    const cut = prepareSemanticCut(before, 's1', ['i1'], mapSlide, clipboard)
    expect(cut.presentation.slides[0].animationReferenceError).toMatch(/timing.*deleted/i)
    expect(nodes(cut.presentation)[0]).toMatchObject({ status: 'unresolved', reason: 'missing-target', targetInstanceId: 'i1' })
    const after = reopen(paste(cut.presentation, clipboard))
    expect(nodes(after)[0]).toMatchObject({ status: 'unresolved', reason: 'missing-target', targetInstanceId: 'i1' })
    expect(after.slides[0].sourceTiming).toEqual(cut.presentation.slides[0].sourceTiming)
    expect(after.pptxSemantic.definitions).toEqual(snapshot.pptxSemantic.definitions)
    expect(after.slides[1]).toEqual(snapshot.slides[1])
    expect(before).toEqual(snapshot)
  })

  it('retains an absent authored target on slide copy without inventing a replacement identity', () => {
    let before = timingLifecycleFixture()
    before = structuredClone(author(before, { type: 'set-target', targetInstanceId: 'i1' }))
    before.slides[0].elements = before.slides[0].elements.filter(element => element.id !== 'i1')
    delete before.pptxSemantic.instances.i1
    const snapshot = structuredClone(before)
    let count = 0
    const cloned = cloneSlideWithNewIds(before.slides[0], () => `absent-fresh-${++count}`, [], [], before.pptxSemantic)
    const result = reopen({ ...before, slides: [...before.slides, cloned], pptxSemantic: cloned.pptxSemantic })
    expect(cloned.sourceTiming.overrides[0].targetInstanceId).toBe('i1')
    expect(nodes(result, result.slides[2])[0]).toMatchObject({ status: 'unresolved', reason: 'missing-target', targetInstanceId: 'i1' })
    expect(result.pptxSemantic.definitions).toEqual(snapshot.pptxSemantic.definitions)
    expect(before).toEqual(snapshot)
  })

  it('recursively remaps slide duplicate targets including tombstones, never source IDs or locators', () => {
    let before = timingLifecycleFixture()
    before = structuredClone(author(before, { type: 'set-target', targetInstanceId: 'i1' }))
    before.slides[0].children = [before.slides.pop()]
    const child = before.slides[0].children[0], childNode = nodes(before, child)[0]
    child.sourceTiming = { schemaVersion: 1, overrides: [{ definitionId: childNode.definitionId,
      nodeLocator: childNode.nodeLocator, targetInstanceId: 'i2', trigger: 'afterPrevious' }] }
    before.pptxSemantic.instances.i2.lineage = { tombstone: true, deleted: true }
    child.elements = child.elements.filter(element => element.id !== 'i2')
    const snapshot = structuredClone(before)
    let count = 0
    const cloned = cloneSlideWithNewIds(before.slides[0], () => `slide-fresh-${++count}`, [], [], before.pptxSemantic)
    const result = reopen({ ...before, slides: [...before.slides, cloned], pptxSemantic: cloned.pptxSemantic })
    const copySlide = result.slides[1], copyChild = copySlide.children[0]
    const target = copySlide.sourceTiming.overrides[0].targetInstanceId
    const missing = copyChild.sourceTiming.overrides[0].targetInstanceId
    expect(target).toBe(copySlide.elements[0].pptxInstanceId)
    expect(target).not.toBe('i1')
    expect(missing).not.toBe('i2')
    expect(result.pptxSemantic.instances[missing]).toMatchObject({ slideId: copyChild.id, lineage: { tombstone: true } })
    expect(nodes(result, copySlide)[0]).toMatchObject({ status: 'ready', targetInstanceId: target })
    expect(nodes(result, copyChild)[0]).toMatchObject({ status: 'unresolved', reason: 'missing-target', targetInstanceId: missing })
    for (const [original, copied] of [[before.slides[0], copySlide], [child, copyChild]]) {
      const { targetInstanceId: _old, ...oldOverlay } = original.sourceTiming.overrides[0]
      const { targetInstanceId: _new, ...newOverlay } = copied.sourceTiming.overrides[0]
      expect(newOverlay).toEqual(oldOverlay)
    }
    expect(before).toEqual(snapshot)
    expect(result.slides[0]).toEqual(snapshot.slides[0])
    expect(result.pptxSemantic.definitions).toEqual(snapshot.pptxSemantic.definitions)
  })
  it('does not import foreign slide timing when only an occurrence is pasted', () => {
    const before = timingLifecycleFixture(), document = before.pptxSemantic
    const foreignPart = 'ppt/slides/slide8.xml'
    for (const id of ['timing', 'definition', 'second']) {
      const definition = structuredClone(document.definitions[id])
      definition.id = `foreign-${id}`
      definition.source.partUri = foreignPart
      document.definitions[definition.id] = definition
    }
    for (const instance of Object.values(document.instances).filter(instance => instance.slideId === 's2'))
      instance.definitionId = `foreign-${instance.definitionId}`
    delete before.slides[1].sourceTimingDefinitionIds
    document.sourceSlides.push({ ...document.sourceSlides[0], partUri: foreignPart, slideId: 's2' })
    const originalTiming = nodes(before, before.slides[1])
    const after = reopen(paste(before, copy(before), 's2'))
    expect(nodes(after, after.slides[1])).toEqual(originalTiming)
    expect(after.slides[1].sourceTiming).toBeUndefined()
    expect(after.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
  })
  it.each(['copy', 'cut'])('preserves member identity through %s while the source group anchor is detached', action => {
    let before = timingLifecycleFixture()
    before = author(before, { type: 'set-trigger', trigger: 'afterPrevious' })
    expect(nodes(before)[1]).toMatchObject({ status: 'unresolved', reason: 'source-group-detached', targetInstanceId: 'second-0' })
    const clipboard = createSemanticClipboard({ presentation: before, slide: before.slides[0], selectedElementIds: ['second-0'] })
    let pending = before
    if (action === 'cut') {
      const mapSlide = (presentation, change) => ({ ...presentation, slides: presentation.slides.map(slide => slide.id === 's1' ? change(slide) : slide) })
      pending = prepareSemanticCut(before, 's1', ['second-0'], mapSlide, clipboard).presentation
    }
    const pasted = reopen(paste(pending, clipboard))
    const repaired = reopen(author(pasted, { type: 'reset' }))
    expect(nodes(repaired)[1]).toMatchObject(action === 'copy'
      ? { status: 'ready', targetInstanceId: 'second-0' }
      : { status: 'unresolved', reason: 'missing-target', targetInstanceId: 'second-0' })
    expect(repaired.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(repaired.slides[1]).toEqual(before.slides[1])
  })
  it('retains source timing on clone of clone even when all target occurrences are tombstoned', () => {
    const before = timingLifecycleFixture()
    before.slides[0].elements = []
    for (const instance of Object.values(before.pptxSemantic.instances).filter(instance => instance.slideId === 's1'))
      instance.lineage = { tombstone: true, deleted: true }
    let count = 0
    const clone = cloneSlideWithNewIds(before.slides[0], () => `empty-clone-${++count}`, [], [], before.pptxSemantic)
    const again = cloneSlideWithNewIds(clone, () => `empty-again-${++count}`, [], [], clone.pptxSemantic)
    const result = reopen({ ...before, slides: [...before.slides, clone, again], pptxSemantic: again.pptxSemantic })
    for (const slide of result.slides.slice(2)) {
      expect(slide.sourceTimingDefinitionIds).toEqual(['timing'])
      expect(nodes(result, slide).map(node => [node.sourceTarget.spid, node.reason])).toEqual([
        ['2', 'missing-target'], ['3', 'missing-group-target'],
      ])
    }
    expect(result.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    expect(result.pptxSemantic.sourceSlides).toEqual(before.pptxSemantic.sourceSlides)
  })
})
