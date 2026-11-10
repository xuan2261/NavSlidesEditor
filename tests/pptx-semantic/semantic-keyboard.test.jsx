// @vitest-environment jsdom
import { useRef, useState } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useEditorKeyboardController } from '../../client/src/hooks/editor-controller/use-editor-keyboard-controller'
import { useSlideOperations } from '../../client/src/hooks/use-slide-operations'
import groups from '../../shared/src/pptx-semantic-groups.js'

const U = 9525
function fixture() {
  const definition = (id, kind) => ({
    id,
    kind,
    source: {
      partUri: 'ppt/slides/slide1.xml',
      nativeId: id,
      preconditionHash: 'a'.repeat(64),
    },
    components: [],
    content: { extent: { cx: 100 * U, cy: 50 * U } },
  })
  const instance = (id, definitionId, parentInstanceId, localTransform, slideId = 's1') => ({
    id,
    definitionId,
    parentInstanceId,
    localTransform,
    slideId,
    paintIndex: 0,
    overrides: {},
  })
  return {
    pptxSemantic: {
      schemaVersion: 1,
      definitions: { g: definition('g', 'group'), a: definition('a', 'shape') },
      instances: {
        g: instance('g', 'g', null, [-2, 0, 0, 0.5, -5.5 * U, 20 * U]),
        a: instance('a', 'a', 'g', [1, 0, 0, 1, -2.5 * U, 3.25 * U]),
        other: instance('other', 'a', null, [1, 0, 0, 1, 0, 0], 's2'),
      },
      styles: {},
      fonts: {},
    },
    slides: [
      {
        id: 's1',
        elements: [
          {
            id: 'leaf',
            pptxInstanceId: 'a',
            type: 'shape',
            x: -0.5,
            y: 21.625,
            width: 100,
            height: 50,
          },
        ],
      },
      {
        id: 's2',
        elements: [
          {
            id: 'other-leaf',
            pptxInstanceId: 'other',
            type: 'shape',
            x: 0,
            y: 0,
            width: 100,
            height: 50,
          },
        ],
      },
    ],
  }
}
function mount(initial, ids) {
  return renderHook(() => {
    const [presentation, setPresentation] = useState(initial)
    const selectedElementIdsRef = useRef(ids)
    const currentSlideIndexRef = useRef(0)
    const editingElementIdRef = useRef(null)
    const operations = useSlideOperations({
      presentation,
      setPresentation,
      selectedElementIdsRef,
      currentSlideIndexRef,
      editingElementIdRef,
    })
    const activeSlideRef = useRef()
    activeSlideRef.current = presentation.slides[0]
    useEditorKeyboardController({
      presentation,
      selectedElementIds: ids,
      selectedElementIdsRef,
      activeSlideRef,
      authoringSlide: presentation.slides[0],
      editingElementId: null,
      updateElements: operations.updateElements,
    })
    return presentation
  })
}
function nudge(key, shiftKey = false) {
  act(() =>
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        shiftKey,
        bubbles: true,
        cancelable: true,
      })
    )
  )
}
afterEach(cleanup)
describe('semantic keyboard movement through real editor controllers', () => {
  it.each([['g'], ['g', 'leaf']])(
    'moves selected group %j once without changing child-local state or source',
    (...ids) => {
      const initial = fixture()
      const hook = mount(initial, ids)
      const before = groups.instanceWorldTransform(initial.pptxSemantic, 'a')
      nudge('ArrowRight')
      const actual = hook.result.current
      const after = groups.instanceWorldTransform(actual.pptxSemantic, 'a')
      expect(after[4]).toBeCloseTo(before[4] + U)
      expect(actual.pptxSemantic.instances.a).toEqual(initial.pptxSemantic.instances.a)
      expect(actual.pptxSemantic.instances.other).toEqual(initial.pptxSemantic.instances.other)
      expect(actual.pptxSemantic.definitions).toEqual(initial.pptxSemantic.definitions)
      expect(actual.slides[0].elements[0].x).toBeCloseTo(0.5)
    }
  )
  it('nudges a semantic child off-slide through its reflected nonuniform parent', () => {
    const initial = fixture()
    const hook = mount(initial, ['leaf'])
    nudge('ArrowLeft', true)
    expect(hook.result.current.slides[0].elements[0].x).toBeCloseTo(-10.5)
    expect(hook.result.current.pptxSemantic.instances.g).toEqual(initial.pptxSemantic.instances.g)
  })
  it('does not move a locked slide or a selected occurrence on another slide', () => {
    const initial = fixture()
    initial.slides[0].locked = true
    const locked = mount(initial, ['g'])
    nudge('ArrowRight')
    expect(locked.result.current).toBe(initial)
    locked.unmount()
    const other = fixture()
    const foreign = mount(other, ['other'])
    nudge('ArrowRight')
    expect(foreign.result.current).toBe(other)
  })
})
