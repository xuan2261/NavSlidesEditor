import { describe, it, expect } from 'vitest'
import { detectLocalMedia } from './media-detector'

describe('detectLocalMedia', () => {
  it('returns hasLocalMedia: false for presentation without media', () => {
    const pres = {
      title: 'Test',
      slides: [
        {
          elements: [
            { type: 'text', content: 'Hello' },
            { type: 'shape', fill: '#fff' },
          ],
        },
      ],
    }
    const result = detectLocalMedia(pres)
    expect(result.hasLocalMedia).toBe(false)
    expect(result.mediaUrls).toEqual([])
  })

  it('detects /uploads/ image in element src', () => {
    const pres = {
      title: 'Test',
      slides: [
        {
          elements: [
            { type: 'image', src: '/uploads/abc123.png' },
          ],
        },
      ],
    }
    const result = detectLocalMedia(pres)
    expect(result.hasLocalMedia).toBe(true)
    expect(result.mediaUrls).toContain('/uploads/abc123.png')
  })

  it('detects background image', () => {
    const pres = {
      title: 'Test',
      slides: [
        {
          background: { type: 'image', src: '/uploads/bg.jpg' },
          elements: [],
        },
      ],
    }
    const result = detectLocalMedia(pres)
    expect(result.hasLocalMedia).toBe(true)
    expect(result.mediaUrls).toContain('/uploads/bg.jpg')
  })

  it('ignores external URLs', () => {
    const pres = {
      title: 'Test',
      slides: [
        {
          elements: [
            { type: 'image', src: 'https://example.com/image.png' },
          ],
        },
      ],
    }
    const result = detectLocalMedia(pres)
    expect(result.hasLocalMedia).toBe(false)
  })

  it('deduplicates same URL across slides', () => {
    const pres = {
      title: 'Test',
      slides: [
        { elements: [{ type: 'image', src: '/uploads/same.png' }] },
        { elements: [{ type: 'image', src: '/uploads/same.png' }] },
      ],
    }
    const result = detectLocalMedia(pres)
    expect(result.mediaUrls).toEqual(['/uploads/same.png'])
  })

  it('handles null/undefined presentation gracefully', () => {
    expect(detectLocalMedia(null).hasLocalMedia).toBe(false)
    expect(detectLocalMedia({}).hasLocalMedia).toBe(false)
    expect(detectLocalMedia({ slides: null }).hasLocalMedia).toBe(false)
  })

  it('detects absolute URL with /uploads/ path', () => {
    const pres = {
      slides: [
        {
          elements: [
            { type: 'image', src: 'http://localhost:3002/uploads/photo.jpg' },
          ],
        },
      ],
    }
    const result = detectLocalMedia(pres)
    expect(result.hasLocalMedia).toBe(true)
  })
})
