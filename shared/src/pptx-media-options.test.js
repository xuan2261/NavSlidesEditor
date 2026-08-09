import { describe, expect, it } from 'vitest'
import mediaOptions from './pptx-media-options.js'

const {
  classifyPptxMediaSource,
  classifyPptxPosterSource,
  getPptxMediaSemanticWarning,
  hasPptxUploadSignature,
} = mediaOptions

describe('PPTX media export policy', () => {
  it.each([
    ['audio', '/uploads/sound.mp3', 'mp3'],
    ['audio', '/uploads/sound.wav', 'wav'],
    ['video', '/uploads/movie.mp4', 'mp4'],
    ['video', '/uploads/movie.mov', 'mov'],
  ])('admits validated local %s sources', (type, src, extension) => {
    expect(classifyPptxMediaSource({ type, src })).toMatchObject({
      embeddable: true,
      source: src,
      extension,
      mediaType: type,
    })
  })

  it.each([
    'https://example.test/movie.mp4',
    'file:///private/movie.mp4',
    'C:\\private\\movie.mp4',
    '/uploads/../private/movie.mp4',
    '/uploads/%2e%2e/private/movie.mp4',
    '/uploads/movie.mp4?token=secret',
  ])('rejects non-upload and traversal sources without resolving them: %s', (src) => {
    expect(classifyPptxMediaSource({ type: 'video', src })).toMatchObject({
      embeddable: false,
      reason: 'source-not-validated-upload',
    })
  })

  it('keeps upload-root but unsupported codecs on the static fallback path', () => {
    expect(classifyPptxMediaSource({ type: 'video', src: '/uploads/movie.webm' })).toEqual({
      embeddable: false,
      reason: 'unsupported-media-type',
      source: '/uploads/movie.webm',
    })
  })

  it('uses legacy videoUrl only when canonical src is absent', () => {
    expect(
      classifyPptxMediaSource({ type: 'video', videoUrl: '/uploads/legacy.mp4' }).embeddable
    ).toBe(true)
    expect(
      classifyPptxMediaSource({
        type: 'video',
        src: '',
        videoUrl: '/uploads/legacy.mp4',
      }).embeddable
    ).toBe(false)
  })

  it('admits validated static posters but only PNG bytes as embedded covers', () => {
    expect(classifyPptxPosterSource('/uploads/poster.jpg')).toBeTruthy()
    expect(classifyPptxPosterSource('/uploads/poster.jpg', { embeddedCover: true })).toBeNull()
    expect(
      classifyPptxPosterSource('/uploads/poster.png', { embeddedCover: true })
    ).toMatchObject({ extension: 'png' })
    expect(classifyPptxPosterSource('https://example.test/poster.png')).toBeNull()
  })

  it('names every browser-only playback semantic truthfully', () => {
    const warning = getPptxMediaSemanticWarning(
      {
        type: 'video',
        startTime: 2,
        endTime: 7,
        playbackRate: 1.5,
        autoplay: true,
        loop: true,
        muted: true,
      },
      3
    )
    expect(warning).toContain('trim, playback speed, autoplay, loop, muted settings')
    expect(warning).toContain('not preserved for video in PPTX')
  })

  it('checks expected media and poster magic bytes', () => {
    expect(
      hasPptxUploadSignature(Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]), 'mp4')
    ).toBe(true)
    expect(hasPptxUploadSignature(new TextEncoder().encode('RIFF0000WAVE'), 'wav')).toBe(true)
    expect(
      hasPptxUploadSignature(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]),
        'png'
      )
    ).toBe(true)
    expect(hasPptxUploadSignature(new TextEncoder().encode('RIFF0000WAVE'), 'mp4')).toBe(false)
  })
})
