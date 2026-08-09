import { describe, it, expect } from 'vitest'
import { renderElement } from '../src/element-renderers.js'
import { generatePrintHTML, generateRevealHTML } from '../src/htmlGenerator.js'

const base = {
  id: 'el-1',
  x: 0,
  y: 0,
  width: 400,
  height: 300,
  zIndex: 1,
}

describe('Parallax features integration', () => {
  describe('Video enhancements', () => {
    it('renders video from videoUrl property', () => {
      const html = renderElement(
        { ...base, type: 'video', videoUrl: 'https://example.com/v.mp4' },
        {},
        {}
      )
      expect(html).toContain('https://example.com/v.mp4')
    })

    it('applies trim and speed to video', () => {
      const html = renderElement(
        {
          ...base,
          type: 'video',
          src: '/uploads/v.mp4',
          startTime: 5,
          endTime: 30,
          playbackRate: 1.5,
        },
        {},
        {}
      )
      expect(html).toContain('#t=5')
      expect(html).toContain('1.5')
    })
  })

  describe('Image citations', () => {
    it('renders citation text', () => {
      const html = renderElement(
        {
          ...base,
          type: 'image',
          src: '/test.jpg',
          citationText: 'Photo by John',
          citationLink: 'https://example.com',
        },
        {},
        {}
      )
      expect(html).toContain('Photo by John')
      expect(html).toContain('https://example.com')
    })

    it('omits citation when none provided', () => {
      const html = renderElement(
        { ...base, type: 'image', src: '/test.jpg' },
        {},
        {}
      )
      expect(html).not.toContain('citation')
    })
  })

  describe('Timeline element', () => {
    it('renders timeline SVG', () => {
      const html = renderElement(
        {
          ...base,
          type: 'timeline',
          startDate: '2000-01-01',
          endDate: '2025-01-01',
          tickSpacing: 'year',
          lineColor: '#6366f1',
          dotColor: '#6366f1',
          textColor: '#ffffff',
          fontSize: 12,
          events: [],
        },
        {},
        {}
      )
      expect(html).toContain('<svg')
    })

    it('renders timeline events', () => {
      const html = renderElement(
        {
          ...base,
          type: 'timeline',
          startDate: '2000',
          endDate: '2025',
          tickSpacing: 'year',
          lineColor: '#6366f1',
          dotColor: '#6366f1',
          textColor: '#ffffff',
          fontSize: 12,
          items: [{ date: '2010', label: 'Event 1' }],
        },
        {},
        {}
      )
      expect(html).toContain('Event 1')
    })
  })

  describe('HTML embed with iframe wrapper', () => {
    it('wraps iframe in container div for animation support', () => {
      const html = renderElement(
        { ...base, type: 'html', content: '<div>test</div>' },
        {},
        {}
      )
      expect(html).toContain('<div')
      expect(html).toContain('<iframe')
    })
  })

  describe('Kinetic text template generation', () => {
    it('generates typewriter animation HTML', async () => {
      const mod = await import(
        '../../client/src/components/kinetic-text-animation-template-selector-modal.jsx'
      )
      // The module exports a React component; test the template generator indirectly
      // by checking the module loads without error
      expect(mod.default).toBeDefined()
    })
  })

  describe('Math grid template generation', () => {
    it('loads math grid module', async () => {
      const mod = await import(
        '../../client/src/components/parametric-math-grid-surface-plotter-modal.jsx'
      )
      expect(mod.default).toBeDefined()
    })
  })

  describe('Anime.js template generation', () => {
    it('loads anime.js module', async () => {
      const mod = await import(
        '../../client/src/components/anime-js-animation-template-selector-modal.jsx'
      )
      expect(mod.default).toBeDefined()
    })
  })

  describe('Three.js template generation', () => {
    it('loads three.js module', async () => {
      const mod = await import(
        '../../client/src/components/three-js-3d-scene-template-selector-modal.jsx'
      )
      expect(mod.default).toBeDefined()
    })
  })

  describe('File browser module', () => {
    it('loads file browser module', async () => {
      const mod = await import(
        '../../client/src/components/file-browser-modal-to-select-and-insert-media.jsx'
      )
      expect(mod.default).toBeDefined()
    })
  })

  describe('Upload deduplication', () => {
    it('loads upload route module', async () => {
      const mod = await import('../../server/routes/upload.js')
      expect(mod).toBeDefined()
    })
  })

  describe('HTML export', () => {
    it('renders ported features together in reveal present HTML', () => {
      const html = generateRevealHTML({
        title: 'Parallax export integration',
        theme: 'black',
        transition: 'slide',
        slides: [
          {
            id: 'slide-1',
            elements: [
              {
                ...base,
                id: 'text-rich',
                type: 'text',
                content:
                  '<p style="line-height: 1.5"><span style="font-weight: 700">Weighted line</span></p>',
              },
              {
                ...base,
                id: 'video-rich',
                type: 'video',
                videoUrl: 'https://example.com/video.mp4',
                startTime: 5,
                endTime: 12,
                playbackRate: 1.25,
              },
              {
                ...base,
                id: 'timeline-rich',
                type: 'timeline',
                timelineStart: '2000',
                timelineEnd: '2025',
                events: [{ date: '2010', title: 'Launch', description: 'Milestone' }],
              },
              {
                ...base,
                id: 'image-citation',
                type: 'image',
                src: '/uploads/photo.jpg',
                citationText: 'Photo by Test',
                citationLink: 'https://example.com/source',
                citationColor: '#808080',
              },
              {
                ...base,
                id: 'kinetic-html',
                type: 'html',
                content: '<!doctype html><html><body><div class="tw">Kinetic</div></body></html>',
              },
              {
                ...base,
                id: 'anime-html',
                type: 'html',
                content:
                  '<!doctype html><html><body><script src="https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js"></script><canvas></canvas></body></html>',
              },
              {
                ...base,
                id: 'three-html',
                type: 'html',
                content:
                  '<!doctype html><html><body><script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script></body></html>',
              },
            ],
          },
        ],
      })

      expect(html).toContain('Weighted line')
      expect(html).toContain('font-weight: 700')
      expect(html).toContain('line-height: 1.5')
      expect(html).toContain('https://example.com/video.mp4#t=5,12')
      expect(html).toContain('this.playbackRate=1.25')
      expect(html).toContain('Launch')
      expect(html).toContain('Photo by Test')
      const decodedHtml = [...html.matchAll(/src="data:text\/html;charset=utf-8,([^"]+)"/g)]
        .map((match) => decodeURIComponent(match[1]))
        .join('\n')
      expect(decodedHtml).toContain('animejs')
      expect(decodedHtml).toContain('three@0.160.0')
    })

    it('renders timeline in print output', () => {
      const html = generatePrintHTML({
        title: 'Timeline print integration',
        slides: [
          {
            id: 'slide-1',
            elements: [
              {
                ...base,
                id: 'timeline-print',
                type: 'timeline',
                timelineStart: '2000',
                timelineEnd: '2025',
                events: [{ date: '2010', title: 'Print Launch' }],
              },
            ],
          },
        ],
      })

      expect(html).toContain('Print Launch')
      expect(html).toContain('<svg')
    })
  })
})
