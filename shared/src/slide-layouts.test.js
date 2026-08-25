import { describe, expect, it } from 'vitest'
import layouts from './slide-layouts.js'

const { applyLayout, changeLayout, detachLayout, fixedId, resolveEffectiveSlide } = layouts
const master = {
  id: 'master', name: 'Master', tokens: { colors: { accent: '#123456' } },
  fixedElements: [{ id: 'band', type: 'shape', x: 0, y: 0, width: 960, height: 40, zIndex: 0 }],
  placeholders: [{ id: 'title', type: 'text', role: 'title', x: 80, y: 80, width: 800, height: 100, zIndex: 1, contentPolicy: { elementDefaults: { content: '<h1>Title</h1>' } } }],
}
const ids = (...values) => { let i = 0; return () => values[i++] }

describe('slide layouts', () => {
  it('[cap:layout.master-resolution] resolves namespaced fixed elements, bound placeholders, patches, and tokens without mutation', () => {
    const slide = { id: 'slide', layoutId: 'master', elements: [{ id: 'owned', type: 'text', x: 1, y: 2, width: 3, height: 4, content: '<h1>Owned</h1>' }], layoutOverrides: { placeholderBindings: { title: 'owned' }, elementPatches: { band: { opacity: 0.5, id: 'nope', type: 'text' } } } }
    const { slide: effective } = resolveEffectiveSlide(slide, [master])
    expect(effective.elements.map((element) => element.id)).toEqual([fixedId('master', 'band'), 'owned'])
    expect(effective.elements[0]).toMatchObject({ type: 'shape', opacity: 0.5, locked: true })
    expect(effective.elements[1]).toMatchObject({ x: 80, width: 800, content: '<h1>Owned</h1>' })
    expect(effective.designTokens.colors.accent).toBe('#123456')
    expect(slide.layoutOverrides.elementPatches.band.id).toBe('nope')
  })

  it('degrades missing layouts to untouched slide-owned elements and a warning', () => {
    const slide = { layoutId: 'gone', elements: [{ id: 'owned', type: 'text' }] }
    const result = resolveEffectiveSlide(slide, [master])
    expect(result.warnings).toHaveLength(1)
    expect(result.slide.elements).toEqual(slide.elements)
  })

  it('applies, changes, and detaches layouts without discarding unmatched content', () => {
    const slide = { id: 'slide', elements: [{ id: 'body', type: 'text', content: '<p>Keep</p>' }] }
    const applied = applyLayout(slide, [master], 'master', ids('title-owned'))
    expect(applied.slide.layoutOverrides.placeholderBindings).toEqual({ title: 'title-owned' })
    expect(applied.slide.elements).toHaveLength(2)
    const changed = changeLayout(applied.slide, [master], 'master', ids('replacement'))
    expect(changed.slide.elements.some((element) => element.content === '<p>Keep</p>')).toBe(true)
    const detached = detachLayout(applied.slide, [master], ids('fixed-copy'))
    expect(detached.slide.layoutId).toBeUndefined()
    expect(detached.slide.elements.map((element) => element.id)).toContain('fixed-copy')
  })
})
