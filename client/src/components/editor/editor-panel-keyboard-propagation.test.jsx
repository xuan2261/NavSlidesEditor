import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useKeyboard } from '../../hooks/use-keyboard'
import EditorInspector from './editor-inspector'
import EditorNavigator from './editor-navigator'

vi.mock('../PropertiesPanel', () => ({
  default: () => <button type="button" aria-label="Inspector control" />,
}))

vi.mock('../SlidePanel', () => ({
  default: () => <button type="button" aria-label="Navigator control" />,
}))

const createContext = () => ({
  activeSlide: { id: 'slide-1', elements: [] },
  clearEditingElementRef: vi.fn(),
  currentSlideIndex: 0,
  currentVerticalIndex: null,
  deleteElement: vi.fn(),
  deleteSelectedElements: vi.fn(),
  deleteSlide: vi.fn(),
  duplicateSelectedElements: vi.fn(),
  duplicateSlide: vi.fn(),
  duplicateSlides: vi.fn(),
  editingElementId: null,
  isTemplate: false,
  mapActive: vi.fn(),
  moveSlide: vi.fn(),
  presentation: {
    id: 'deck-1',
    slides: [{ id: 'slide-1', elements: [] }],
    resolution: { width: 1280, height: 720 },
  },
  selectedElement: null,
  selectedElementId: null,
  selectedElementIds: [],
  setCurrentSlideIndex: vi.fn(),
  setEditingElementId: vi.fn(),
  setPresentation: vi.fn(),
  setSelectedElementIds: vi.fn(),
  setShowDesignIdeas: vi.fn(),
  setShowTemplateGallery: vi.fn(),
  setShowTemplateModal: vi.fn(),
  setVerticalEdit: vi.fn(),
  setRightPanelOpen: vi.fn(),
  showDesignIdeas: false,
  updateCurrentSlide: vi.fn(),
  updateElement: vi.fn(),
  updateElements: vi.fn(),
  replaceElementZOrder: vi.fn(),
  toggleElementSelection: vi.fn(),
  addChildSlide: vi.fn(),
})

function KeyboardHarness({ children, ...options }) {
  useKeyboard(options)
  return children
}

function pressSave(controlLabel) {
  fireEvent.keyDown(screen.getByLabelText(controlLabel), {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    key: 's',
  })
}

describe('editor panel keyboard propagation', () => {
  it('keeps Ctrl+S reachable from an inspector control', () => {
    const onSave = vi.fn()
    render(
      <KeyboardHarness onSave={onSave}>
        <EditorInspector
          visible
          overlay={false}
          onCloseOverlay={vi.fn()}
          c={createContext()}
        />
      </KeyboardHarness>
    )

    pressSave('Inspector control')

    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('keeps Ctrl+S reachable from a navigator control', () => {
    const onSave = vi.fn()
    render(
      <KeyboardHarness onSave={onSave}>
        <EditorNavigator
          visible
          overlay={false}
          onCloseOverlay={vi.fn()}
          c={createContext()}
        />
      </KeyboardHarness>
    )

    pressSave('Navigator control')

    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('keeps Escape reachable from a docked inspector control', () => {
    const onEscape = vi.fn()
    render(
      <KeyboardHarness onEscape={onEscape}>
        <EditorInspector
          visible
          overlay={false}
          onCloseOverlay={vi.fn()}
          c={createContext()}
        />
      </KeyboardHarness>
    )

    fireEvent.keyDown(screen.getByLabelText('Inspector control'), {
      bubbles: true,
      key: 'Escape',
    })

    expect(onEscape).toHaveBeenCalledTimes(1)
  })

  it('keeps Escape reachable from a docked navigator control', () => {
    const onEscape = vi.fn()
    render(
      <KeyboardHarness onEscape={onEscape}>
        <EditorNavigator
          visible
          overlay={false}
          onCloseOverlay={vi.fn()}
          c={createContext()}
        />
      </KeyboardHarness>
    )

    fireEvent.keyDown(screen.getByLabelText('Navigator control'), {
      bubbles: true,
      key: 'Escape',
    })

    expect(onEscape).toHaveBeenCalledTimes(1)
  })
})
