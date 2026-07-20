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
})
