import { afterEach, describe, expect, it, vi } from 'vitest'
import { addElementToPptxSlide } from './export-pptx-renderers'

function makeSlide() {
  return {
    addImage: vi.fn(),
    addMedia: vi.fn(),
    addShape: vi.fn(),
    addText: vi.fn(),
  }
}

function response(mime) {
  const bytes =
    mime === 'image/png'
      ? Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])
      : new TextEncoder().encode('RIFF0000WAVE')
  return {
    ok: true,
    headers: { get: () => mime },
    arrayBuffer: async () => bytes.buffer,
  }
}

const frame = {
  x: 10,
  y: 20,
  width: 200,
  height: 100,
}

async function render(element, warnings = []) {
  const slide = makeSlide()
  await addElementToPptxSlide({
    slide,
    element: { id: 'media-1', ...frame, ...element },
    resolution: { width: 960, height: 540 },
    layout: { width: 10, height: 5.625 },
    warnings,
    slideNumber: 1,
  })
  return { slide, warnings }
}

describe('client PPTX media renderer', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('embeds validated audio and warns about browser-only semantics', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response('audio/wav')))
    const { slide, warnings } = await render({
      type: 'audio',
      src: '/uploads/sound.wav',
      startTime: 2,
      playbackRate: 1.25,
      autoplay: true,
      loop: true,
      muted: true,
    })

    expect(slide.addMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'audio',
        extn: 'wav',
        data: expect.stringMatching(/^data:audio\/wav;base64,/),
      })
    )
    expect(warnings).toEqual([
      expect.stringContaining('trim, playback speed, autoplay, loop, muted settings'),
    ])
    expect(warnings.exportReport.warnings[0]).toMatchObject({
      elementType: 'audio',
      fallback: 'browser-only-media-semantics',
    })
  })

  it('never fetches external media and keeps a validated local poster fallback', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response('image/png'))
    vi.stubGlobal('fetch', fetchMock)
    const { slide, warnings } = await render({
      type: 'video',
      src: 'https://example.test/movie.mp4',
      poster: '/uploads/poster.png',
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('/uploads/poster.png', {
      credentials: 'same-origin',
      redirect: 'error',
    })
    expect(slide.addMedia).not.toHaveBeenCalled()
    expect(slide.addImage).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.stringMatching(/^data:image\/png;base64,/) })
    )
    expect(warnings).toContain('Slide 1: used media cover fallback for video')
  })

  it('does not fetch or use an external poster for static fallback', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { slide, warnings } = await render({
      type: 'video',
      src: '/uploads/movie.webm',
      poster: 'https://example.test/poster.png',
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(slide.addMedia).not.toHaveBeenCalled()
    expect(slide.addImage).not.toHaveBeenCalled()
    expect(warnings).toContain('Slide 1: inserted placeholder for video')
  })
})
