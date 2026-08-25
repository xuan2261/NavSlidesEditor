import { describe, expect, it } from 'vitest'
import { getPresentationAccessibilityFindings } from './accessibility-findings'

describe('presentation accessibility findings', () => {
  it('finds blank image alternatives and invalid media metadata on vertical children', () => {
    const findings = getPresentationAccessibilityFindings({ slides: [{ elements: [{ id: 'image', type: 'image', alt: '' }], children: [{ elements: [{ id: 'media', type: 'audio', tracks: [{ src: 'javascript:bad', default: true }, { src: '/uploads/two.vtt', default: true }] }] }] }] })
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ elementId: 'image', message: expect.stringMatching(/alternative text/) }),
      expect.objectContaining({ childIndex: 0, elementId: 'media', message: expect.stringMatching(/unsafe/) }),
      expect.objectContaining({ childIndex: 0, elementId: 'media', message: expect.stringMatching(/default/) }),
    ]))
  })
})
