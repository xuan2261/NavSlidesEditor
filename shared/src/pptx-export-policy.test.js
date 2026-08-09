import { describe, expect, it } from 'vitest'
import { ELEMENT_DEFAULTS } from '../../client/src/data/element-defaults.js'
import shared from './index.js'

const {
  PPTX_ELEMENT_EXPORT_POLICY,
  getPptxElementExportStrategy,
  getPptxNativeElementTypes,
  getPptxElementExportPolicy,
  hasPptxImageVisualEffects,
  isPptxRasterSafeImageSource,
} = shared

describe('PPTX element export policy', () => {
  it('covers every canonical element type', () => {
    expect(Object.keys(PPTX_ELEMENT_EXPORT_POLICY).sort()).toEqual(
      Object.keys(ELEMENT_DEFAULTS).sort()
    )
  })

  it('classifies native client/server renderer types from one shared policy', () => {
    expect(getPptxNativeElementTypes().sort()).toEqual(
      ['text', 'image', 'shape', 'line', 'callout', 'table', 'code', 'chart'].sort()
    )
  })

  it('declares current non-native routing policies', () => {
    expect(getPptxElementExportPolicy('html')).toMatchObject({
      mode: 'server-prefetch-raster',
      requiresServer: true,
      failure: 'error',
    })
    expect(getPptxElementExportPolicy('latex')).toMatchObject({
      mode: 'server-prefetch-raster',
      requiresServer: true,
      failure: 'error',
    })
    expect(getPptxElementExportPolicy('markdown').mode).toBe('client-fallback-raster')
    expect(getPptxElementExportPolicy('video').mode).toBe('media-cover')
    expect(getPptxElementExportPolicy('game').mode).toBe('live-only-static')
  })

  it('uses chart-specific export strategies without changing generic chart policy', () => {
    expect(getPptxElementExportPolicy('chart')).toMatchObject({ mode: 'native' })
    expect(getPptxElementExportStrategy({ type: 'chart', chartType: 'radar' })).toMatchObject({
      mode: 'native',
    })
    expect(getPptxElementExportStrategy({ type: 'chart', chartType: 'polarArea' })).toMatchObject({
      mode: 'client-fallback-raster',
      fallback: 'placeholder',
    })
    expect(getPptxElementExportStrategy({ type: 'text' })).toEqual(
      getPptxElementExportPolicy('text')
    )
  })

  it('routes only validated supported upload media to embedding', () => {
    expect(
      getPptxElementExportStrategy({ type: 'video', src: '/uploads/movie.mp4' })
    ).toMatchObject({ mode: 'embedded-media', fallback: 'media-cover' })
    expect(
      getPptxElementExportStrategy({
        type: 'video',
        src: 'https://example.test/movie.mp4',
      })
    ).toEqual(getPptxElementExportPolicy('video'))
    expect(
      getPptxElementExportStrategy({ type: 'audio', src: '/uploads/sound.ogg' })
    ).toEqual(getPptxElementExportPolicy('audio'))
  })

  it('routes only safe filtered or rounded images through the server raster strategy', () => {
    expect(hasPptxImageVisualEffects({ type: 'image' })).toBe(false)
    expect(hasPptxImageVisualEffects({ type: 'image', filterContrast: 100 })).toBe(false)
    expect(hasPptxImageVisualEffects({ type: 'image', filterContrast: null })).toBe(false)
    expect(hasPptxImageVisualEffects({ type: 'image', filterContrast: 85 })).toBe(true)
    expect(hasPptxImageVisualEffects({ type: 'image', borderRadius: 8 })).toBe(true)
    expect(isPptxRasterSafeImageSource('data:image/png;base64,AAA')).toBe(true)
    expect(isPptxRasterSafeImageSource('/uploads/photo.png')).toBe(true)
    expect(isPptxRasterSafeImageSource('/uploads/../private.png')).toBe(false)
    expect(isPptxRasterSafeImageSource('/uploads/%2e./private.png')).toBe(false)
    expect(isPptxRasterSafeImageSource('https://example.com/photo.png')).toBe(false)

    expect(
      getPptxElementExportStrategy({
        type: 'image',
        src: 'data:image/png;base64,AAA',
        filterGrayscale: 40,
      })
    ).toMatchObject({ mode: 'server-prefetch-raster', requiresServer: true })
    expect(
      getPptxElementExportStrategy({
        type: 'image',
        src: 'https://example.com/photo.png',
        borderRadius: 8,
      })
    ).toEqual(getPptxElementExportPolicy('image'))
  })
})
