import { describe, expect, it, vi } from 'vitest'
import { addElementToPptxSlide } from './export-pptx-renderers'

const slide = { addText: vi.fn(), addShape: vi.fn(), addImage: vi.fn() }

describe('PPTX element action policy', () => {
  it('[cap:export.action-pptx] warns deterministically when a browser-only element action is omitted', async () => {
    const warnings = []
    await addElementToPptxSlide({
      slide, element: { id: 'action-shape', type: 'shape', shape: 'rect', x: 0, y: 0, width: 100, height: 40, action: { kind: 'next' } },
      resolution: { width: 960, height: 540 }, layout: { width: 10, height: 5.625 }, warnings, slideNumber: 2, designTokens: {}, pptx: {},
    })
    expect(warnings).toContain('Slide 2: shape action (next) is not supported in PPTX and was omitted')
    expect(warnings.exportReport.warnings[0]).toMatchObject({ fallback: 'browser-only-element-action' })
  })
})
