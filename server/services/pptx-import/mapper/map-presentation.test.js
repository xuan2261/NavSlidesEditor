import { describe, expect, it } from 'vitest'
import presentationMapper from './map-presentation.js'

const { mapPptxOutput } = presentationMapper

describe('pptx presentation mapper', () => {
  it('maps slide metadata and preserves export contract shape', async () => {
    const progress = []
    const result = await mapPptxOutput({
      output: {
        size: { width: 960, height: 540 },
        usedFonts: ['Arial'],
        themeColors: ['#ffffff'],
        slides: [{
          fill: { type: 'gradient', stops: [{ color: '#000000', position: 0 }] },
          transition: { type: 'fade', duration: 350, direction: 'left' },
          note: '<b>Speaker</b>',
          elements: [{ type: 'text', content: '<p>Hello</p>', left: 1, top: 2, width: 3, height: 4 }],
        }],
      },
      zip: { files: {} },
      originalName: 'Deck.pptx',
      uploadsDir: '/tmp',
      onProgress: (event) => progress.push(event),
    })

    expect(result.presentation).toMatchObject({
      title: 'Deck',
      theme: 'white',
      transition: 'slide',
      resolution: { width: 960, height: 540 },
    })
    expect(result.presentation.slides[0]).toMatchObject({
      transition: 'fade',
      transitionDuration: 350,
      transitionDirection: 'left',
      notes: '<b>Speaker</b>',
    })
    expect(result.presentation.slides[0].elements[0]).toMatchObject({ type: 'text', zIndex: 1 })
    expect(result.stats).toMatchObject({ slideCount: 1, textCount: 1 })
    expect(progress).toEqual([
      { stage: 'mapping', percent: 80, message: 'Processing slide 1 of 1' },
    ])
  })

  it('maps non-default slide sizes into the canonical canvas resolution', async () => {
    const result = await mapPptxOutput({
      output: {
        size: { width: 720, height: 540 },
        slides: [{
          elements: [{
            type: 'text',
            left: 360,
            top: 270,
            width: 100,
            height: 50,
            content: '<p>Mid</p>',
          }],
        }],
      },
      zip: { files: {} },
      originalName: '4x3.pptx',
      uploadsDir: '/tmp',
    })

    expect(result.presentation.resolution).toEqual({ width: 960, height: 540 })
    expect(result.presentation._pptxMeta.originalSize).toEqual({ width: 720, height: 540 })
    expect(result.presentation.slides[0].elements[0]).toMatchObject({
      x: 480,
      y: 270,
      width: 133,
      height: 50,
    })
  })

  it('stores text import insets as canvas px metadata', async () => {
    const result = await mapPptxOutput({
      output: {
        size: { width: 960, height: 540 },
        slides: [{
          elements: [{
            type: 'text',
            left: 0,
            top: 0,
            width: 200,
            height: 50,
            insetLeft: 7.2,
            insetRight: 7.2,
            insetTop: 3.6,
            insetBottom: 3.6,
            content: '<p>X</p>',
          }],
        }],
      },
      zip: { files: {} },
      originalName: 'Insets.pptx',
      uploadsDir: '/tmp',
    })

    expect(result.presentation.slides[0].elements[0]._pptxImportMeta).toMatchObject({
      textInsets: { left: 7.2, right: 7.2, top: 3.6, bottom: 3.6 },
      textInsetsUnit: 'px',
    })
  })

  it('stops mapping when the import signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(mapPptxOutput({
      output: { size: { width: 960, height: 540 }, slides: [{ elements: [] }] },
      zip: { files: {} },
      originalName: 'Deck.pptx',
      uploadsDir: '/tmp',
      signal: controller.signal,
    })).rejects.toThrow(/aborted/i)
  })
})
