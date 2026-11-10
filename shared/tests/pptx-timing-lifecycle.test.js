import { describe, expect, it } from 'vitest'
import semantic from '../src/pptx-semantic-presentation.js'
import timing from '../src/pptx-timing-document.js'
import operations from '../src/pptx-timing-operations.js'
import { timingLifecycleFixture } from '../../tests/pptx-semantic/timing-lifecycle-fixture.js'

const reopen = input => semantic.normalizeSemanticPresentation(JSON.parse(JSON.stringify(input)))
const node = presentation => timing.resolveSlideTiming(presentation.pptxSemantic, presentation.slides[0]).nodes[0]
const overlay = presentation => ({ schemaVersion: 1, overrides: [{ definitionId: node(presentation).definitionId,
  nodeLocator: structuredClone(node(presentation).nodeLocator), targetInstanceId: 'i1' }] })

describe('source timing canonical lifecycle normalization', () => {
  it.each(['tree', 'reference', 'schema'])('rejects malformed immutable %s inventory even without slides', alteration => {
    const before = timingLifecycleFixture()
    const source = before.pptxSemantic.definitions.timing.content.timingDocument
    if (alteration === 'tree') source.tree.locator.path = [999]
    if (alteration === 'reference') source.targetReferences[0].locator.preconditionHash = 'b'.repeat(64)
    if (alteration === 'schema') source.schemaVersion = 99
    delete before.slides
    expect(() => reopen(before)).toThrow()
  })

  it('normalizes overlays recursively without modifying source or sibling timing', () => {
    const before = timingLifecycleFixture()
    before.slides[0].sourceTiming = overlay(before)
    const sibling = before.slides.pop()
    before.slides[0].children = [sibling]
    const target = timing.resolveSlideTiming(before.pptxSemantic, sibling).nodes[0]
    sibling.sourceTiming = { schemaVersion: 1, overrides: [{ definitionId: target.definitionId,
      nodeLocator: target.nodeLocator, trigger: 'afterPrevious' }] }
    const snapshot = structuredClone(before)
    const result = reopen(before)
    expect(result).toEqual(snapshot)
    expect(result.slides[0].sourceTiming).not.toBe(before.slides[0].sourceTiming)
    expect(result.slides[0].children[0].sourceTiming).not.toBe(sibling.sourceTiming)
    expect(before).toEqual(snapshot)
    expect(result.pptxSemantic.definitions).toEqual(snapshot.pptxSemantic.definitions)
  })

  it.each(['schema', 'field', 'locator', 'foreign', 'duplicate', 'trigger', 'empty'])(
    'rejects malformed %s overlays on recursive canonical reopen', alteration => {
      const before = timingLifecycleFixture()
      const sourceBefore = structuredClone(before.pptxSemantic.definitions)
      before.slides[0].sourceTiming = overlay(before)
      const target = before.slides[0].sourceTiming
      if (alteration === 'schema') target.schemaVersion = 99
      if (alteration === 'field') target.sourceTree = {}
      if (alteration === 'locator') target.overrides[0].nodeLocator.preconditionHash = 'b'.repeat(64)
      if (alteration === 'foreign') target.overrides[0].targetInstanceId = 'i2'
      if (alteration === 'duplicate') target.overrides.push(structuredClone(target.overrides[0]))
      if (alteration === 'trigger') target.overrides[0].trigger = 'click-anywhere'
      if (alteration === 'empty') delete target.overrides[0].targetInstanceId
      before.slides = [{ id: 'parent', elements: [], children: before.slides }]
      const snapshot = structuredClone(before)
      expect(() => reopen(before)).toThrow()
      expect(before).toEqual(snapshot)
      expect(before.pptxSemantic.definitions).toEqual(sourceBefore)
    }
  )

  it('keeps an authored missing or tombstoned target for explicit diagnostics after reopen', () => {
    for (const tombstone of [false, true]) {
      const before = timingLifecycleFixture()
      const target = node(before)
      let edited = structuredClone(operations.applyTimingPresentationOperation(before, { type: 'timing.edit', slideId: 's1',
        definitionId: target.definitionId, nodeLocator: target.nodeLocator,
        command: { type: 'set-target', targetInstanceId: 'i1' } }))
      edited.slides[0].elements = edited.slides[0].elements.filter(element => element.id !== 'i1')
      if (tombstone) edited.pptxSemantic.instances.i1.lineage = { tombstone: true, deleted: true }
      else delete edited.pptxSemantic.instances.i1
      edited = reopen(edited)
      expect(node(edited)).toMatchObject({ status: 'unresolved', reason: 'missing-target', targetInstanceId: 'i1' })
      expect(edited.slides[0].sourceTiming.overrides[0].targetInstanceId).toBe('i1')
      expect(edited.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    }
  })
  it.each([false, ['missing'], ['definition'], ['timing', 'timing'], []])('rejects invalid original timing ownership %j without requiring an overlay', declaration => {
    const before = timingLifecycleFixture()
    before.slides[0].sourceTimingDefinitionIds = declaration
    expect(before.slides[0].sourceTiming).toBeUndefined()
    const snapshot = structuredClone(before)
    expect(() => reopen(before)).toThrow(/timing ownership/)
    expect(before).toEqual(snapshot)
  })
  it('rejects a sparse clone ownership list before JSON serialization can hide its holes', () => {
    const before = timingLifecycleFixture()
    before.slides[1].sourceTimingDefinitionIds = new Array(1)
    expect(() => semantic.normalizeSemanticPresentation(before)).toThrow(/JSON keys/)
  })
})
