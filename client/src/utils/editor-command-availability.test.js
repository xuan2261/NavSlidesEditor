import { describe, expect, it } from 'vitest'
import { getEditorCommandAvailability } from './editor-command-availability'

const selectionMutations = ['cut', 'duplicate', 'deleteSelection', 'arrange', 'group', 'ungroup']
const slide = {
  elements: [
    { id: 'a', type: 'text', groupId: 'g' },
    { id: 'b', type: 'shape', groupId: 'g' },
  ],
}
const available = (overrides = {}) => getEditorCommandAvailability({
  slide,
  selectedElementIds: ['a', 'b'],
  clipboard: [{ type: 'text' }],
  canUndo: true,
  canRedo: true,
  editingText: true,
  masterEditing: false,
  ...overrides,
})

function expectDisabled(result, keys) {
  for (const key of keys) expect(result[key], key).toEqual(expect.any(String))
}

function expectEnabled(result, keys) {
  for (const key of keys) expect(result[key], key).toBeNull()
}

describe('getEditorCommandAvailability', () => {
  it('enables editing a free selection with clipboard and history entries', () => {
    expectEnabled(available(), [
      ...selectionMutations, 'copy', 'paste', 'undo', 'redo', 'insertText', 'insertLink', 'speakerNotes',
    ])
  })

  it.each([{ ids: [] }, { ids: ['missing'] }])('requires elements on the active slide, not stale IDs: $ids', ({ ids }) => {
    const result = available({ selectedElementIds: ids })
    expectDisabled(result, ['copy', ...selectionMutations])
    expectEnabled(result, ['paste', 'insertText'])
  })

  it('allows copying a locked selection but prevents partial mutations of mixed selections', () => {
    const result = available({
      slide: { elements: [{ id: 'a', locked: true }, { id: 'b' }] },
    })
    expectEnabled(result, ['copy', 'paste', 'insertText'])
    expectDisabled(result, selectionMutations)
  })

  it('blocks writes to a locked slide without blocking copy or history', () => {
    const result = available({ slide: { ...slide, locked: true } })
    expectDisabled(result, [...selectionMutations, 'paste', 'insertText', 'insertLink'])
    expectEnabled(result, ['copy', 'undo', 'redo'])
  })

  it.each([{ hidden: true }, { locked: true }])('protects unselected group members: %j', (protection) => {
    const result = available({
      slide: { elements: [slide.elements[0], { ...slide.elements[1], ...protection }] },
      selectedElementIds: ['a'],
    })
    expectDisabled(result, selectionMutations)
    expectEnabled(result, ['copy'])
  })

  it('requires two existing elements to group but allows ungrouping one selected group member', () => {
    const result = available({ selectedElementIds: ['a', 'missing'] })
    expectDisabled(result, ['group'])
    expectEnabled(result, ['ungroup'])
    expectDisabled(available({ slide: { elements: [{ id: 'a' }, { id: 'b' }] } }), ['ungroup'])
  })

  it.each([{ clipboard: null }, { clipboard: undefined }, { clipboard: [] }])('requires clipboard elements to paste: $clipboard', ({ clipboard }) => {
    expectDisabled(available({ clipboard }), ['paste'])
  })

  it('requires a slide for slide and selection commands', () => {
    const result = available({ slide: null })
    expectDisabled(result, [
      ...selectionMutations, 'copy', 'paste', 'insertText', 'insertLink', 'speakerNotes',
    ])
    expectEnabled(result, ['undo', 'redo'])
  })

  it('tracks history independently and requires text editing to insert links', () => {
    expectDisabled(available({ canUndo: false, canRedo: false, editingText: false }), [
      'undo', 'redo', 'insertLink',
    ])
    expectEnabled(available({ canUndo: false }), ['redo'])
    expectEnabled(available({ canRedo: false }), ['undo'])
  })

  it('does not expose slide notes while authoring a master', () => {
    const result = available({ masterEditing: true })
    expectDisabled(result, ['speakerNotes'])
    expectEnabled(result, ['insertText', 'copy', 'paste'])
  })
})
