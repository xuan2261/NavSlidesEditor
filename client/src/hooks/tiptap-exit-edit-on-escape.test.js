import { describe, it, expect, vi } from 'vitest'
import { createExitEditOnEscape } from './tiptap-exit-edit-on-escape'

describe('exit text editing on Escape', () => {
  it('clears the editing target and blurs when Escape is pressed mid-edit', () => {
    const ref = { current: 'el-1' }
    const setEditingElementId = vi.fn()
    const blurEditor = vi.fn()
    const handler = createExitEditOnEscape({
      editingElementIdRef: ref,
      setEditingElementId,
      blurEditor,
    })

    const consumed = handler({}, { key: 'Escape' })

    expect(consumed).toBe(true)
    expect(setEditingElementId).toHaveBeenCalledWith(null)
    expect(ref.current).toBeNull()
    expect(blurEditor).toHaveBeenCalledTimes(1)
  })

  it('ignores Escape when nothing is being edited', () => {
    const ref = { current: null }
    const setEditingElementId = vi.fn()
    const handler = createExitEditOnEscape({ editingElementIdRef: ref, setEditingElementId })

    expect(handler({}, { key: 'Escape' })).toBe(false)
    expect(setEditingElementId).not.toHaveBeenCalled()
  })

  it('lets every non-Escape key fall through to the editor', () => {
    const ref = { current: 'el-1' }
    const setEditingElementId = vi.fn()
    const handler = createExitEditOnEscape({ editingElementIdRef: ref, setEditingElementId })

    expect(handler({}, { key: 'a' })).toBe(false)
    expect(handler({}, { key: 'Enter' })).toBe(false)
    expect(setEditingElementId).not.toHaveBeenCalled()
    expect(ref.current).toBe('el-1')
  })
})
