import { describe, expect, it } from 'vitest'
import references from '../../src/education/interaction-references.js'
import {
  createInteractionSlideState,
  executeInteractionAction,
  normalizeInteractionAction,
} from '../../src/education/interaction-actions.js'
const { resolveInteractionTarget, remapInteractionReferences, remapInteractionSlideReferences } =
  references
const pair = [
  { id: 'source', action: { kind: 'show', targetElementId: 'target' } },
  { id: 'target', initialVisibility: 'hidden' },
]

describe('scoped interaction references', () => {
  it('remaps source and selected target through the existing clone ID map', () => {
    const original = JSON.stringify(pair)
    const result = remapInteractionReferences(
      pair,
      new Map([
        ['source', 'copy-source'],
        ['target', 'copy-target'],
      ])
    )
    expect(result.elements[0]).toEqual({
      id: 'copy-source',
      action: { kind: 'show', targetElementId: 'copy-target' },
    })
    expect(resolveInteractionTarget(result.elements, 'copy-target').element).toEqual(
      result.elements[1]
    )
    expect(result.warnings).toEqual([])
    expect(JSON.stringify(pair)).toBe(original)
  })
  it('retains a target outside selection only when the destination contains it', () => {
    const copiedSource = [pair[0]]
    const kept = remapInteractionReferences(
      copiedSource,
      { source: 'copy-source' },
      { destinationElements: [...pair, { id: 'copy-source' }] }
    )
    expect(kept.elements[0].action.targetElementId).toBe('target')
    expect(kept.warnings).toEqual([])
    const unresolved = remapInteractionReferences(
      copiedSource,
      { source: 'copy-source' },
      { destinationElements: [{ id: 'copy-source' }] }
    )
    expect(unresolved.warnings).toEqual([
      {
        sourceElementId: 'copy-source',
        targetElementId: 'target',
        error: expect.stringMatching(/effective slide/),
      },
    ])
    expect(unresolved.elements[0].action.targetElementId).toBe('target')
  })
  it('resolves exact IDs without selectors, prototype lookups or crossing slide boundaries', () => {
    const unusual = { id: 'answer" ] #not-a-selector' }
    expect(resolveInteractionTarget([unusual], unusual.id).element).toBe(unusual)
    expect(resolveInteractionTarget(pair, 'toString', { idRemap: {} }).element).toBeNull()
    expect(resolveInteractionTarget([{ id: 'elsewhere' }], 'target').element).toBeNull()
    expect(resolveInteractionTarget([{ id: 'target', hidden: true }], 'target').element).toBeNull()
    expect(resolveInteractionTarget([{ id: 'target' }, { id: 'target' }], 'target').error).toMatch(
      /ambiguous/
    )
  })
  it('maps raw master references into effective IDs and detaches through the same map', () => {
    const raw = [
      { id: 'master-source', action: { kind: 'toggle', targetElementId: 'master-target' } },
      { id: 'master-target' },
    ]
    const effective = remapInteractionReferences(raw, {
      'master-source': 'layout-fixed:layout:master-source',
      'master-target': 'layout-fixed:layout:master-target',
    })
    expect(effective.warnings).toEqual([])
    expect(effective.elements[0].action.targetElementId).toBe('layout-fixed:layout:master-target')
    const detached = remapInteractionReferences(
      effective.elements,
      new Map([
        ['layout-fixed:layout:master-source', 'owned-source'],
        ['layout-fixed:layout:master-target', 'owned-target'],
      ])
    )
    expect(detached.warnings).toEqual([])
    expect(detached.elements[0].action.targetElementId).toBe('owned-target')
    expect(resolveInteractionTarget(detached.elements, 'owned-target').element.id).toBe(
      'owned-target'
    )
    expect(effective.elements[0].action.targetElementId).toBe('layout-fixed:layout:master-target')
  })
  it('duplicates parent and child in independent scopes while retaining fixed targets', () => {
    const fixed = { id: 'layout-fixed:l:answer' }
    const parent = {
      id: 'parent',
      elements: [
        ...pair,
        { id: 'fixed-source', action: { kind: 'hide', targetElementId: fixed.id } },
      ],
      children: [
        {
          id: 'child',
          elements: [
            { id: 'child-source', action: { kind: 'show', targetElementId: 'child-target' } },
            { id: 'child-target' },
          ],
        },
      ],
    }
    const map = {
      parent: 'p2',
      child: 'c2',
      source: 's2',
      target: 't2',
      'child-source': 'cs2',
      'child-target': 'ct2',
    }
    const result = remapInteractionSlideReferences(parent, map, {
      effectiveElements: (slide) => [...slide.elements, fixed],
    })
    expect(result.warnings).toEqual([])
    expect(result.slide.id).toBe('p2')
    expect(result.slide.elements[0].action.targetElementId).toBe('t2')
    expect(result.slide.elements[2].action.targetElementId).toBe(fixed.id)
    expect(result.slide.children[0].id).toBe('c2')
    expect(result.slide.children[0].elements[0].action.targetElementId).toBe('ct2')
    expect(parent.children[0].elements[0].action.targetElementId).toBe('child-target')
  })
  it('does not resolve a child target in the parent even if both were duplicated', () => {
    const slide = {
      id: 'parent',
      elements: [{ id: 'source', action: { kind: 'show', targetElementId: 'child-target' } }],
      children: [{ id: 'child', elements: [{ id: 'child-target' }] }],
    }
    const result = remapInteractionSlideReferences(slide, { source: 's2', 'child-target': 'ct2' })
    expect(result.warnings[0]).toMatchObject({ sourceElementId: 's2', targetElementId: 'ct2' })
    expect(result.slide.children[0].elements[0].id).toBe('ct2')
  })
  it('leaves navigation and score references out of element remapping', () => {
    const elements = [
      { id: 'a', action: { kind: 'score-add', variableId: 'score', amount: 1 } },
      { id: 'b', action: { kind: 'slide', slideId: 'parent' } },
    ]
    const result = remapInteractionReferences(elements, {
      a: 'a2',
      b: 'b2',
      score: 'not-a-variable',
      parent: 'not-an-element',
    })
    expect(result.elements[0].action.variableId).toBe('score')
    expect(result.elements[1].action.slideId).toBe('parent')
    expect(result.warnings).toEqual([])
  })
  it('persists unresolved targets and blocks execution even after a destination collision appears', () => {
    const result = remapInteractionReferences([pair[0]], { source: 'copy-source' })
    const action = result.elements[0].action
    expect(normalizeInteractionAction(action).action).toEqual(action)
    const destination = [{ id: 'target', initialVisibility: 'hidden' }, ...result.elements]
    const state = createInteractionSlideState({ id: 'other-slide', elements: destination })
    const executed = executeInteractionAction(state, action)
    expect(executed.error).toMatch(/choose|target/i)
    expect(executed.state.visibility.target).toBe(false)
    expect(
      resolveInteractionTarget(destination, action.targetElementId, {
        referenceError: action.referenceError,
      }).element
    ).toBeNull()
    const copiedAgain = remapInteractionReferences(
      result.elements,
      { 'copy-source': 'copy-again' },
      { destinationElements: destination }
    )
    expect(copiedAgain.warnings).toHaveLength(1)
    expect(copiedAgain.elements[0].action.referenceError).toBeTruthy()
  })
  it('admits canonical fixed IDs generated from valid long layout and authored IDs', () => {
    const id = `layout-fixed:${'l'.repeat(200)}:${'e'.repeat(200)}`
    const state = createInteractionSlideState({
      id: 'slide',
      elements: [{ id, initialVisibility: 'hidden' }],
    })
    const changed = executeInteractionAction(state, { kind: 'show', targetElementId: id })
    expect(changed.error).toBe('')
    expect(changed.state.visibility[id]).toBe(true)
  })
})
