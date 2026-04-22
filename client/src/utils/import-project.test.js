import { describe, it, expect } from 'vitest'
import { validateProjectFile, rewriteMediaUrls } from './import-project'

describe('validateProjectFile', () => {
  it('validates correct JSON project', () => {
    const parsed = {
      presentation: {
        title: 'Test Presentation',
        slides: [{ id: 's1', elements: [] }],
      },
      manifest: { version: '1.0', exportedAt: new Date().toISOString() },
    }
    const result = validateProjectFile(parsed)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects missing presentation', () => {
    const result = validateProjectFile({})
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing presentation data')
  })

  it('rejects non-array slides', () => {
    const parsed = {
      presentation: { title: 'Test', slides: 'not-array' },
    }
    const result = validateProjectFile(parsed)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('slides'))).toBe(true)
  })

  it('warns on unknown version', () => {
    const parsed = {
      presentation: { title: 'Test', slides: [] },
      manifest: { version: '99.0' },
    }
    const result = validateProjectFile(parsed)
    expect(result.valid).toBe(true)
    expect(result.warnings.some((w) => w.includes('99.0'))).toBe(true)
  })

  it('warns on missing title', () => {
    const parsed = {
      presentation: { slides: [] },
    }
    const result = validateProjectFile(parsed)
    expect(result.valid).toBe(true)
    expect(result.warnings.some((w) => w.includes('title'))).toBe(true)
  })

  it('accepts presentation without manifest', () => {
    const parsed = {
      presentation: { title: 'Test', slides: [{ id: 's1', elements: [] }] },
    }
    const result = validateProjectFile(parsed)
    expect(result.valid).toBe(true)
  })
})

describe('rewriteMediaUrls', () => {
  it('rewrites local URLs to uploaded server URLs', () => {
    const presentation = {
      slides: [
        {
          elements: [{ type: 'image', src: '/uploads/old-abc.png' }],
        },
      ],
    }
    const urlMap = { '/uploads/old-abc.png': '/uploads/new-xyz.png' }
    const result = rewriteMediaUrls(presentation, urlMap)
    expect(result.slides[0].elements[0].src).toBe('/uploads/new-xyz.png')
  })

  it('does not change external URLs', () => {
    const presentation = {
      slides: [
        {
          elements: [{ type: 'image', src: 'https://example.com/image.png' }],
        },
      ],
    }
    const urlMap = {}
    const result = rewriteMediaUrls(presentation, urlMap)
    expect(result.slides[0].elements[0].src).toBe('https://example.com/image.png')
  })

  it('rewrites background image URLs', () => {
    const presentation = {
      slides: [
        {
          background: { type: 'image', src: '/uploads/old-bg.jpg' },
          elements: [],
        },
      ],
    }
    const urlMap = { '/uploads/old-bg.jpg': '/uploads/new-bg.jpg' }
    const result = rewriteMediaUrls(presentation, urlMap)
    expect(result.slides[0].background.src).toBe('/uploads/new-bg.jpg')
  })

  it('does not mutate original presentation', () => {
    const original = {
      slides: [{ elements: [{ type: 'image', src: '/uploads/old.png' }] }],
    }
    const urlMap = { '/uploads/old.png': '/uploads/new.png' }
    rewriteMediaUrls(original, urlMap)
    expect(original.slides[0].elements[0].src).toBe('/uploads/old.png')
  })
})
