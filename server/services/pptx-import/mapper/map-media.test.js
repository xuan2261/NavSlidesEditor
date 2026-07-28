import { describe, expect, it } from 'vitest'
import mediaMapper from './map-media.js'

const { mapAudio, mapMath, mapVideo } = mediaMapper

function context() {
  return {
    mediaIndex: { files: new Map() },
    uploadsDir: '/tmp',
    scale: { x: 1, y: 1 },
    zIndex: 1,
    slideIndex: 0,
    warnings: [],
    stats: { videoCount: 0, audioCount: 0, mathCount: 0, placeholderCount: 0 },
  }
}

describe('pptx media mappers', () => {
  it('blocks external video URLs outside allowlist', async () => {
    const ctx = context()
    const result = await mapVideo({ type: 'video', ref: 'https://example.com/v.mp4' }, ctx)
    expect(result[0].importPlaceholderType).toBe('video-missing')
    expect(ctx.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'media-external-url-blocked', host: 'example.com' }),
    ]))
  })

  it('blocks localhost audio URLs by default', async () => {
    const ctx = context()
    const result = await mapAudio({ type: 'audio', ref: 'http://127.0.0.1/a.mp3' }, ctx)
    expect(result[0]).toMatchObject({
      importPlaceholderType: 'audio-missing',
    })
    expect(ctx.stats.audioCount).toBe(0)
    expect(ctx.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'media-external-url-blocked', host: '127.0.0.1' }),
    ]))
  })

  it('maps LaTeX content and placeholders missing formulas', () => {
    const ctx = context()
    const latex = mapMath({ type: 'math', latex: '<span>x^2</span>' }, ctx)
    expect(latex[0]).toMatchObject({ type: 'latex', content: 'x^2', latex: 'x^2' })
    expect(ctx.stats.mathCount).toBe(1)

    const missing = mapMath({ type: 'math' }, ctx)
    expect(missing[0].importPlaceholderType).toBe('math')
  })
})
