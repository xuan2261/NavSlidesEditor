import { render } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import EditorCanvasWorkspace from './editor-canvas-workspace'
import { api } from '../../utils/api'
import { showError } from '../../utils/app-feedback'

let slideCanvasProps

vi.mock('../SlideCanvas', () => ({
  default: (props) => {
    slideCanvasProps = props
    return <div data-testid="slide-canvas" />
  },
}))

vi.mock('../../utils/api', () => ({
  api: { uploadFile: vi.fn() },
}))

vi.mock('../../utils/app-feedback', () => ({
  showError: vi.fn(),
}))

function createContext(activeSlideRef) {
  return {
    activeSlide: { id: 'slide-a', elements: [] },
    activeSlideRef,
    presentation: { designTokens: {}, resolution: { width: 960, height: 540 }, slides: [] },
    selectedElementIds: [],
    editingElementId: null,
    showGrid: false,
    gridSize: 40,
    smartGuidesEnabled: true,
    showRulers: false,
    guides: [],
    pageNumber: null,
    currentSlide: { id: 'slide-a', elements: [] },
    ...Object.fromEntries([
      'setGuides', 'toggleElementSelection', 'startEditingElement', 'stopEditingElement',
      'updateElement', 'updateElements', 'deleteElement', 'deleteSelectedElements', 'handleCopy',
      'handleCut', 'handlePaste', 'handleDuplicate', 'notifyBlockedAction', 'openHtmlEditor',
      'openCodeEditor', 'openLatexEditor', 'addVideoElement', 'addAudioElement', 'addImageElement',
    ].map((name) => [name, vi.fn()])),
  }
}

describe('EditorCanvasWorkspace upload targeting', () => {
  beforeEach(() => {
    slideCanvasProps = null
    vi.clearAllMocks()
  })

  it('does not insert a dropped file after navigation changes the active slide', async () => {
    const activeSlideRef = { current: { id: 'slide-a' } }
    let resolveUpload
    api.uploadFile.mockReturnValue(new Promise((resolve) => { resolveUpload = resolve }))
    const context = createContext(activeSlideRef)
    render(<EditorCanvasWorkspace overlayOpen={false} c={context} />)

    const upload = slideCanvasProps.onAddMedia(
      new File(['image'], 'slide.png', { type: 'image/png' }),
      120,
      90,
    )
    activeSlideRef.current = { id: 'slide-b' }
    resolveUpload({ url: '/uploads/slide.png' })

    await upload

    expect(context.addImageElement).not.toHaveBeenCalled()
    expect(showError).toHaveBeenCalledWith(expect.stringMatching(/active slide changed/i))
  })
})
