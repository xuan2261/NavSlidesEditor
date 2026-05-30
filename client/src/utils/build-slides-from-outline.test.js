import { describe, it, expect } from 'vitest'
import { buildSlidesFromOutline } from './build-slides-from-outline'

describe('buildSlidesFromOutline', () => {
  it('builds a centered title slide from a title-layout item', () => {
    const slides = buildSlidesFromOutline([
      { title: 'Welcome', layout: 'title', bulletPoints: ['one', 'two'] },
    ])
    expect(slides).toHaveLength(1)
    const slide = slides[0]
    expect(slide.id).toBeTruthy()
    expect(slide.elements).toHaveLength(1)
    const el = slide.elements[0]
    expect(el).toMatchObject({ type: 'text', x: 40, y: 40, width: 880, height: 460, zIndex: 1 })
    expect(el.id).toBeTruthy()
    expect(el.content).toContain('<h1')
    expect(el.content).toContain('Welcome')
    expect(el.content).toContain('one | two')
  })

  it('builds an h2 + ul content slide for non-title layouts', () => {
    const slides = buildSlidesFromOutline([
      { title: 'Agenda', layout: 'content', bulletPoints: ['a', 'b'] },
    ])
    const el = slides[0].elements[0]
    expect(el.content).toContain('<h2>')
    expect(el.content).toContain('<ul>')
    expect(el.content).toContain('<li>a</li>')
    expect(el.content).toContain('<li>b</li>')
  })

  it('omits the bullet paragraph on a title slide with no bullets', () => {
    const slides = buildSlidesFromOutline([{ title: 'Solo', layout: 'title' }])
    const el = slides[0].elements[0]
    expect(el.content).toContain('Solo')
    expect(el.content).not.toContain('<p style="text-align:center">')
  })

  it('takes notes from item.notes, falling back to speakerNotes then empty', () => {
    const [a, b, c] = buildSlidesFromOutline([
      { title: 'A', layout: 'content', notes: 'note-a' },
      { title: 'B', layout: 'content', speakerNotes: 'spk-b' },
      { title: 'C', layout: 'content' },
    ])
    expect(a.notes).toBe('note-a')
    expect(b.notes).toBe('spk-b')
    expect(c.notes).toBe('')
  })

  it('generates unique ids across slides and elements', () => {
    const slides = buildSlidesFromOutline([
      { title: 'A', layout: 'content' },
      { title: 'B', layout: 'content' },
    ])
    const ids = [...slides.map((s) => s.id), ...slides.map((s) => s.elements[0].id)]
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('SECURITY: escapes script/onerror payloads in title and bullets', () => {
    const slides = buildSlidesFromOutline([
      {
        title: '<script>alert(1)</script>',
        layout: 'content',
        bulletPoints: ['<img src=x onerror=alert(2)>'],
      },
    ])
    const content = slides[0].elements[0].content
    // The raw executable payload must NOT survive.
    expect(content).not.toContain('<script>')
    expect(content).not.toContain('<img src=x onerror=')
    // It must appear escaped instead.
    expect(content).toContain('&lt;script&gt;')
    expect(content).toContain('&lt;img')
  })

  it('SECURITY: escapes payloads on a title-layout bullet join too', () => {
    const slides = buildSlidesFromOutline([
      { title: 'T', layout: 'title', bulletPoints: ['<b>x</b>', '<script>y</script>'] },
    ])
    const content = slides[0].elements[0].content
    expect(content).not.toContain('<script>y</script>')
    expect(content).toContain('&lt;script&gt;')
  })

  it('returns an empty array for an empty/invalid outline', () => {
    expect(buildSlidesFromOutline([])).toEqual([])
    expect(buildSlidesFromOutline(null)).toEqual([])
    expect(buildSlidesFromOutline(undefined)).toEqual([])
  })
})
