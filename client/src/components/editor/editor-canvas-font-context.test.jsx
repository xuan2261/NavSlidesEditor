import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EditorCanvasWorkspace from './editor-canvas-workspace'

const { canvas } = vi.hoisted(() => ({ canvas: vi.fn(() => null) }))
vi.mock('../SlideCanvas', () => ({ default: canvas }))
afterEach(() => {
  cleanup()
  canvas.mockClear()
})
function context() {
  const slide = { id: 'slide', elements: [] }
  return {
    presentation: {
      id: 'source-deck',
      pptxSemantic: { schemaVersion: 1, fonts: {} },
      layoutMasters: [],
      slides: [slide],
    },
    activeSlide: slide,
    currentSlide: slide,
    fontRevision: new Date(0),
    isTemplate: false,
  }
}
describe('actual editor canvas source-font context', () => {
  it('forwards authoritative presentation identity and acknowledged save token', () => {
    const c = context()
    render(<EditorCanvasWorkspace c={c} />)
    expect(canvas.mock.calls.at(-1)[0]).toMatchObject({
      presentationId: 'source-deck',
      pptxSemantic: c.presentation.pptxSemantic,
      fontRevision: c.fontRevision,
    })
    expect(canvas.mock.calls.at(-1)[0].fontRevision).toBe(c.fontRevision)
  })
  it('does not send a template identity to the presentation-only font endpoint', () => {
    const c = { ...context(), isTemplate: true }
    render(<EditorCanvasWorkspace c={c} />)
    expect(canvas.mock.calls.at(-1)[0].presentationId).toBeUndefined()
  })
})
