// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import geometrySvg from 'revealjs-shared/src/pptx-geometry-svg.js'
import SlideCanvas from '../../client/src/components/SlideCanvas'
import { SlideThumbnailPreview } from '../../client/src/components/slide-panel/slide-thumbnail-preview'
import { useUIStore } from '../../client/src/stores/ui-store'
import { geometryProjectionFixture } from './geometry-projection-fixture'
import { authored, geometryStyleFixture } from './geometry-style-fixture'

let observers, mediaQueries, paint, initialUI
beforeEach(() => {
  initialUI = useUIStore.getState()
  useUIStore.setState({ zoom: 0.75, userZoomMode: true })
  vi.stubGlobal('devicePixelRatio', 2)
  observers = []
  mediaQueries = []
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback) {
        this.callback = callback
        this.disconnect = vi.fn()
        observers.push(this)
      }
      observe(target) {
        this.target = target
      }
    }
  )
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query) => {
      const media = new EventTarget()
      media.media = query
      vi.spyOn(media, 'addEventListener')
      vi.spyOn(media, 'removeEventListener')
      mediaQueries.push(media)
      return media
    })
  )
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 240 })
  paint = vi.spyOn(geometrySvg, 'geometrySvgPathsString').mockReturnValue('')
})
afterEach(() => {
  cleanup()
  useUIStore.setState(initialUI)
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function fixture() {
  const deck = geometryProjectionFixture()
  deck.pptxSemantic = geometryStyleFixture()
  deck.pptxSemantic.styles.provider.payload.properties.fill = authored({
    pattern: authored({ preset: authored('smConfetti') }),
  })
  return deck
}

function editor(deck) {
  return render(
    <SlideCanvas
      slide={deck.slides[0]}
      pptxSemantic={deck.pptxSemantic}
      selectedElementIds={[]}
      onToggleSelectElement={vi.fn()}
      onUpdateElement={vi.fn()}
    />
  )
}
const lastOptions = () => paint.mock.calls.at(-1)[1]
function changeDpr(value) {
  vi.stubGlobal('devicePixelRatio', value)
  act(() => mediaQueries.at(-1).dispatchEvent(new Event('change')))
}

describe('geometry output pixel scale caller contract', () => {
  it('passes actual editor zoom times DPR without changing the full occurrence matrix or source', () => {
    const deck = fixture()
    deck.pptxSemantic.instances.i1.localTransform = [-2, 0.25, 0.5, 1.5, 952500, -19050]
    const before = JSON.stringify(deck)
    editor(deck)
    expect(lastOptions().outputPixelScale).toBe(1.5)
    const matrix = lastOptions().occurrenceMatrix
    expect(matrix).toEqual([-2, 0.25, 0.5, 1.5, 952500, -19050])
    act(() => useUIStore.getState().setZoom(0.4))
    expect(lastOptions().outputPixelScale).toBe(0.8)
    expect(lastOptions().occurrenceMatrix).toEqual(matrix)
    expect(JSON.stringify(deck)).toBe(before)
  })

  it('repaints editor geometry on successive DPR events and removes old and final subscriptions', () => {
    const view = editor(fixture())
    expect(mediaQueries).toHaveLength(1)
    const first = mediaQueries[0]
    changeDpr(1.25)
    expect(lastOptions().outputPixelScale).toBe(0.9375)
    expect(first.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(mediaQueries.at(-1).media).toBe('(resolution: 1.25dppx)')
    changeDpr(3)
    expect(lastOptions().outputPixelScale).toBe(2.25)
    const final = mediaQueries.at(-1)
    view.unmount()
    expect(final.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(observers.every((observer) => observer.disconnect.mock.calls.length === 1)).toBe(true)
    paint.mockClear()
    act(() => final.dispatchEvent(new Event('change')))
    expect(paint).not.toHaveBeenCalled()
  })

  it('uses independent measured thumbnail scale and repaints on observer and DPR changes', () => {
    const deck = fixture()
    const before = JSON.stringify(deck)
    const view = render(
      <SlideThumbnailPreview slide={deck.slides[0]} pptxSemantic={deck.pptxSemantic} width={1200} />
    )
    const canvas = view.container.firstChild.firstChild
    expect(lastOptions().outputPixelScale).toBe(0.4)
    expect(canvas.style.transform).toBe('scale(0.2)')
    act(() => useUIStore.getState().setZoom(3))
    expect(lastOptions().outputPixelScale).toBe(0.4)
    act(() => observers[0].callback([{ contentRect: { width: 120 } }]))
    expect(lastOptions().outputPixelScale).toBe(0.2)
    expect(canvas.style.transform).toBe('scale(0.1)')
    changeDpr(1.5)
    expect(lastOptions().outputPixelScale).toBeCloseTo(0.15)
    view.rerender(
      <SlideThumbnailPreview slide={deck.slides[0]} pptxSemantic={deck.pptxSemantic} width={600} />
    )
    expect(lastOptions().outputPixelScale).toBeCloseTo(0.6)
    expect(JSON.stringify(deck)).toBe(before)
    view.unmount()
    expect(observers.every((observer) => observer.disconnect.mock.calls.length === 1)).toBe(true)
  })

  it('remeasures and repaints on window resize when ResizeObserver is unavailable, then cleans up', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const remove = vi.spyOn(window, 'removeEventListener')
    const deck = fixture()
    const view = render(
      <SlideThumbnailPreview slide={deck.slides[0]} pptxSemantic={deck.pptxSemantic} />
    )
    expect(lastOptions().outputPixelScale).toBe(0.5)
    HTMLElement.prototype.getBoundingClientRect.mockReturnValue({ width: 96 })
    vi.stubGlobal('devicePixelRatio', 1.5)
    fireEvent.resize(window)
    expect(lastOptions().outputPixelScale).toBeCloseTo(0.15)
    view.unmount()
    expect(remove.mock.calls.filter(([name]) => name === 'resize')).toHaveLength(2)
    paint.mockClear()
    fireEvent.resize(window)
    expect(paint).not.toHaveBeenCalled()
  })
})
