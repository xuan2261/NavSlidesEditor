// @vitest-environment jsdom
import { createRequire } from 'node:module'
import { useRef, useState } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useEditorHistoryController } from '../../client/src/hooks/editor-controller/use-editor-history-controller'
import {
  createSemanticClipboard,
  pasteSemanticClipboard,
} from '../../client/src/utils/pptx-semantic-clipboard'
import semantic from '../../shared/src/pptx-semantic-presentation.js'
import { geometryGroupFillFixture } from './geometry-group-fill-fixture.js'
const require = createRequire(import.meta.url)
const { assertSemanticBaseline } = require('../../server/services/pptx-import/semantic-baseline.js')
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})
function useHarness() {
  const [presentation, setPresentation] = useState(null)
  const history = useEditorHistoryController({
    presentation,
    setPresentation,
    setCurrentSlideIndex: () => {},
    setVerticalEdit: () => {},
    resolveHistorySlide: (state) => state.slides[0],
    selectedElementIdsRef: useRef([]),
    editingElementIdRef: useRef(null),
    setSelectedElementIds: () => {},
    setEditingElementId: () => {},
    resetContent: () => {},
  })
  return { presentation, setPresentation, ...history }
}
const duplicate = (presentation) =>
  pasteSemanticClipboard({
    presentation,
    slideId: 's1',
    clipboard: createSemanticClipboard({
      presentation,
      slide: presentation.slides[0],
      selectedElementIds: ['g1'],
    }),
  }).presentation
describe('persisted source group copy history', () => {
  it('undoes copied source occurrences as retained tombstones and redoes their exact active state', () => {
    vi.useFakeTimers()
    let sequence = 0
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `copy-history-${++sequence}`)
    const before = semantic.normalizeSemanticPresentation({
      ...geometryGroupFillFixture(),
      id: 'deck',
    })
    const copied = duplicate(before)
    const added = Object.keys(copied.pptxSemantic.instances).filter(
      (id) => !before.pptxSemantic.instances[id]
    )
    expect(() => assertSemanticBaseline(before, copied)).not.toThrow()
    const { result } = renderHook(useHarness)
    act(() => {
      result.current.seedHistory(before)
      result.current.setPresentation(before)
    })
    act(() => result.current.setPresentation(copied))
    act(() => result.current.handleUndo())
    const undone = result.current.presentation
    expect(() => assertSemanticBaseline(copied, undone)).not.toThrow()
    for (const id of added)
      expect(undone.pptxSemantic.instances[id].lineage).toMatchObject({
        tombstone: true,
        deleted: true,
      })
    expect(undone.slides).toEqual(before.slides)
    expect(undone.pptxSemantic.styles).toEqual(before.pptxSemantic.styles)
    expect(undone.pptxSemantic.definitions).toEqual(before.pptxSemantic.definitions)
    act(() => result.current.handleRedo())
    expect(() => assertSemanticBaseline(undone, result.current.presentation)).not.toThrow()
    expect(result.current.presentation.pptxSemantic).toEqual(copied.pptxSemantic)
  })
  it('retains all previously saved clone identities across repeated undo and a new history branch', () => {
    vi.useFakeTimers()
    let sequence = 0
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `copy-branch-${++sequence}`)
    const before = semantic.normalizeSemanticPresentation({
      ...geometryGroupFillFixture(),
      id: 'deck',
    })
    const first = duplicate(before)
    const second = duplicate(first)
    const { result } = renderHook(useHarness)
    act(() => {
      result.current.seedHistory(before)
      result.current.setPresentation(before)
    })
    act(() => result.current.setPresentation(first))
    act(() => {
      result.current.commitHistoryTransaction()
      result.current.setPresentation(second)
    })
    act(() => result.current.handleUndo())
    expect(() => assertSemanticBaseline(second, result.current.presentation)).not.toThrow()
    act(() => result.current.handleUndo())
    expect(() => assertSemanticBaseline(second, result.current.presentation)).not.toThrow()
    const branch = duplicate(result.current.presentation)
    act(() => result.current.setPresentation(branch))
    expect(() => assertSemanticBaseline(second, result.current.presentation)).not.toThrow()
    expect(result.current.canRedo).toBe(false)
    act(() => result.current.handleUndo())
    expect(() => assertSemanticBaseline(branch, result.current.presentation)).not.toThrow()
    expect(result.current.presentation.slides).toEqual(before.slides)
  })
})
