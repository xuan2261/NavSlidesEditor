import { describe, expect, it } from 'vitest'
import { ELEMENT_DEFAULTS } from '../../client/src/data/element-defaults.js'
import shared from './index.js'

const {
  PPTX_ELEMENT_EXPORT_POLICY,
  getPptxNativeElementTypes,
  getPptxElementExportPolicy,
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
})
