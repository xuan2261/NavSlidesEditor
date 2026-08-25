import { describe, expect, it, vi } from 'vitest'
import { migratePresentation, migrateSlide } from './editor-presentation-migration'

describe('editor presentation migration', () => {
  it('migrates parent and child legacy html without mutating the source', () => {
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'generated-id') })
    const source = {
      id: 'deck',
      slides: [{ id: 'parent', html: '<p>Parent</p>', children: [{ id: 'child', html: '<p>Child</p>' }] }],
    }

    const migrated = migratePresentation(source)

    expect(migrated.slides[0].elements[0]).toMatchObject({ id: 'generated-id', content: '<p>Parent</p>' })
    expect(migrated.slides[0].children[0].elements[0].content).toBe('<p>Child</p>')
    expect(source.slides[0].elements).toBeUndefined()
    vi.unstubAllGlobals()
  })

  it('preserves existing elements while migrating video sources', () => {
    const slide = { elements: [{ id: 'video', type: 'video', url: '/old.mp4' }] }
    expect(migrateSlide(slide).elements).toHaveLength(1)
    expect(slide.elements[0]).toEqual({ id: 'video', type: 'video', url: '/old.mp4' })
  })

  it('migrates legacy video sources in child slides without overriding explicit src', () => {
    const source = {
      slides: [
        {
          id: 'parent',
          elements: [{ id: 'parent-video', type: 'video', videoUrl: '/parent.mp4' }],
          children: [
            {
              id: 'legacy-child',
              elements: [{ id: 'child-video', type: 'video', videoUrl: '/child.mp4' }],
            },
            {
              id: 'explicit-child',
              elements: [{ id: 'child-blank', type: 'video', src: '', videoUrl: '/stale.mp4' }],
            },
          ],
        },
      ],
    }

    const migrated = migratePresentation(source)

    expect(migrated.slides[0].elements[0].src).toBe('/parent.mp4')
    expect(migrated.slides[0].children[0].elements[0].src).toBe('/child.mp4')
    expect(migrated.slides[0].children[1].elements[0].src).toBe('')
    expect(migrated.slides[0].children[1].elements[0].videoUrl).toBe('/stale.mp4')
  })

  it('normalizes child game subtype config while preserving nested precedence', () => {
    const source = {
      slides: [
        {
          id: 'parent',
          children: [
            {
              id: 'child',
              elements: [
                {
                  id: 'poll',
                  type: 'game',
                  gameType: 'poll',
                  prompt: 'legacy prompt',
                  poll: { prompt: 'nested prompt' },
                },
              ],
            },
          ],
        },
      ],
    }

    const migrated = migratePresentation(source)
    const config = migrated.slides[0].children[0].elements[0].poll

    expect(config.prompt).toBe('nested prompt')
    expect(config.title).toBe('Live Poll')
    expect(config.options).toHaveLength(2)
  })

  it('normalizes valid layout metadata through vertical children without adding it to legacy slides', () => {
    const master = { id: 'layout', name: 'Layout', fixedElements: [], placeholders: [] }
    const source = { slides: [{ id: 'legacy', elements: [] }, { id: 'parent', elements: [], children: [{ id: 'child', elements: [], layoutOverrides: { hiddenElementIds: ['fixed'] } }] }], layoutMasters: [master] }
    const migrated = migratePresentation(source)

    expect(migrated.slides[0].layoutId).toBeUndefined()
    expect(migrated.layoutMasters).toEqual([master])
    expect(migrated.slides[1].children[0].layoutOverrides).toEqual({ hiddenElementIds: ['fixed'] })
    expect(source.slides[1].children[0].layoutOverrides).toEqual({ hiddenElementIds: ['fixed'] })
  })

  it('normalizes valid actions while leaving invalid persisted metadata inert', () => {
    const source = { elements: [
      { id: 'safe', type: 'shape', action: { kind: 'url', url: 'https://example.test', hotspot: true } },
      { id: 'unsafe', type: 'shape', action: { kind: 'url', url: 'javascript:alert(1)' } },
    ] }
    const migrated = migrateSlide(source)
    expect(migrated.elements[0].action).toEqual({ kind: 'url', url: 'https://example.test', hotspot: true })
    expect(migrated.elements[1].action).toEqual(source.elements[1].action)
  })
  it('normalizes image and media accessibility metadata on parent and child slides', () => {
    const migrated = migratePresentation({ slides: [{ elements: [{ type: 'image', alt: 3, decorative: 'yes', longDescription: ['bad'] }, { type: 'video', tracks: [{ src: '/uploads/captions.vtt', label: 'English', srcLang: 'en', default: true }, { src: '/uploads/second.vtt', default: true }, { src: 'javascript:bad' }] }], children: [{ elements: [{ type: 'audio', transcript: 3, audioDescription: ' description ' }] }] }] })
    expect(migrated.slides[0].elements[0]).toMatchObject({ alt: '', decorative: false })
    expect(migrated.slides[0].elements[1].tracks).toEqual([{ src: '/uploads/captions.vtt', label: 'English', srcLang: 'en', kind: 'captions', default: true }, { src: '/uploads/second.vtt', label: '', srcLang: '', kind: 'captions', default: false }])
    expect(migrated.slides[0].children[0].elements[0]).toMatchObject({ audioDescription: 'description', tracks: [] })
  })

  it('normalizes line connections and stores finite resolved fallbacks', () => {
    const migrated = migrateSlide({
      id: 'slide',
      elements: [
        { id: 'target', type: 'shape', x: 100, y: 50, width: 40, height: 20 },
        {
          id: 'line', type: 'line', x: 0, y: 0, width: 200, height: 100,
          x1: Number.NaN, y1: Infinity,
          connections: {
            start: { targetId: 'target', anchor: 'e' },
            end: { targetId: 'missing', anchor: 'invalid' },
          },
        },
      ],
    })

    expect(migrated.elements[1]).toMatchObject({
      x1: 140,
      y1: 60,
      x2: 200,
      y2: 50,
      connections: { start: { targetId: 'target', anchor: 'e' } },
    })
  })
})
