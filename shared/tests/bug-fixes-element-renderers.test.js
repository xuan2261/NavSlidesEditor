import { describe, it, expect } from 'vitest'
import { renderElement } from '../src/element-renderers.js'

const base = { id: 'el-1', x: 0, y: 0, width: 400, height: 300, zIndex: 1 }

describe('Bug fixes in element renderers', () => {
  describe('Iframe wrapper for animation support', () => {
    it('wraps HTML embed iframe in a div container', () => {
      const html = renderElement(
        { ...base, type: 'html', content: '<p>test</p>' },
        {},
        {}
      )
      // Should have a wrapping div around the iframe
      expect(html).toMatch(/^<div/)
      expect(html).toContain('<iframe')
    })

    it('wraps markdown iframe in a div container', () => {
      const html = renderElement(
        { ...base, type: 'markdown', content: '# Title' },
        {},
        {}
      )
      expect(html).toContain('<iframe')
    })
  })

  describe('Image citation overflow handling', () => {
    it('renders citation with overflow hidden via ellipsis', () => {
      const html = renderElement(
        {
          ...base,
          type: 'image',
          src: '/uploads/photo.jpg',
          citationText: 'A very long citation text that should be truncated with ellipsis',
        },
        {},
        {}
      )
      expect(html).toContain('overflow:hidden')
      expect(html).toContain('text-overflow:ellipsis')
    })

    it('renders citation link as non-interactive in slides', () => {
      const html = renderElement(
        {
          ...base,
          type: 'image',
          src: '/uploads/photo.jpg',
          citationLink: 'https://example.com',
          citationText: 'Source',
        },
        {},
        {}
      )
      expect(html).toContain('pointer-events:none')
    })

    it('omits citation div when no citation properties are set', () => {
      const html = renderElement(
        { ...base, type: 'image', src: '/uploads/photo.jpg' },
        {},
        {}
      )
      expect(html).not.toContain('citation')
    })
  })

  describe('Video rendering edge cases', () => {
    it('handles video with only startTime (no endTime)', () => {
      const html = renderElement(
        { ...base, type: 'video', src: '/uploads/v.mp4', startTime: 10, endTime: 0 },
        {},
        {}
      )
      expect(html).toContain('#t=10')
      expect(html).not.toMatch(/#t=10,/)  // no end range
    })

    it('handles video with endTime less than startTime', () => {
      const html = renderElement(
        { ...base, type: 'video', src: '/uploads/v.mp4', startTime: 30, endTime: 5 },
        {},
        {}
      )
      expect(html).toContain('#t=30')  // uses start only
    })

    it('renders video poster attribute when provided', () => {
      const html = renderElement(
        { ...base, type: 'video', src: '/uploads/v.mp4', poster: '/uploads/thumb.jpg' },
        {},
        {}
      )
      expect(html).toContain('poster=')
    })

    it('uses canonical src before stale legacy videoUrl', () => {
      const html = renderElement(
        {
          ...base,
          type: 'video',
          src: '/uploads/current.mp4',
          videoUrl: '/uploads/stale.mp4',
          startTime: 2,
        },
        {},
        {}
      )
      expect(html).toContain('/uploads/current.mp4#t=2')
      expect(html).not.toContain('/uploads/stale.mp4')
    })

    it('uses legacy videoUrl only when src is absent', () => {
      const html = renderElement(
        { ...base, type: 'video', videoUrl: '/uploads/legacy.mp4' },
        {},
        {}
      )
      expect(html).toContain('/uploads/legacy.mp4')
    })

    it('does not resurrect videoUrl when the persisted src is explicitly blank', () => {
      const html = renderElement(
        { ...base, type: 'video', src: '', videoUrl: '/uploads/legacy.mp4' },
        {},
        {}
      )
      expect(html).not.toContain('/uploads/legacy.mp4')
      expect(html).toContain('<video src=""')
    })

    it('renders audio flags consistently for viewer export', () => {
      const html = renderElement(
        {
          ...base,
          type: 'audio',
          src: '/uploads/a.mp3',
          autoplay: true,
          loop: true,
          muted: true,
        },
        {},
        {}
      )
      expect(html).toContain('/uploads/a.mp3')
      expect(html).toContain('controls')
      expect(html).toContain('autoplay')
      expect(html).toContain('loop')
      expect(html).toContain('muted')
    })

    it('neutralizes unsafe media URLs in viewer export', () => {
      const html = renderElement(
        {
          ...base,
          type: 'video',
          src: 'javascript:alert(1)',
          poster: 'file:///secret.png',
        },
        {},
        {}
      )
      expect(html).toContain('src=""')
      expect(html).not.toContain('javascript:')
      expect(html).not.toContain('poster=')
      expect(html).not.toContain('file:///')
    })
  })

  describe('LaTeX with fallback image', () => {
    it('uses fallback image when content does not look like LaTeX', () => {
      const html = renderElement(
        {
          ...base,
          type: 'latex',
          content: 'not valid latex',
          _fallbackSrc: '/uploads/math.png',
        },
        {},
        {}
      )
      expect(html).toContain('<img')
      expect(html).toContain('/uploads/math.png')
    })

    it('renders LaTeX normally when content looks like valid LaTeX', () => {
      const html = renderElement(
        {
          ...base,
          type: 'latex',
          content: '\\frac{a}{b}',
          _fallbackSrc: '/uploads/math.png',
        },
        {},
        {}
      )
      expect(html).toContain('data-math-latex="\\frac{a}{b}"')
      expect(html).not.toContain('<img')
    })
  })
})
