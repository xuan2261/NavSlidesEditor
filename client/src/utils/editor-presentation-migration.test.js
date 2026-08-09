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
})
