import { describe, it, expect } from 'vitest'
import { analyzeSlide } from './analyze-slide'

// Fixture builders keep tests readable and intent-focused.
const txt = (content, extra = {}) => ({ type: 'text', x: 0, y: 0, width: 100, height: 40, content, ...extra })

describe('analyzeSlide', () => {
  it('handles a null slide without throwing', () => {
    const a = analyzeSlide(null)
    expect(a.elementCount).toBe(0)
    expect(a.types).toEqual([])
    expect(a.density).toBe('empty')
    expect(a.titleOnly).toBe(false)
  })

  it('treats an empty slide as empty density', () => {
    const a = analyzeSlide({ id: 's1', elements: [] })
    expect(a.elementCount).toBe(0)
    expect(a.density).toBe('empty')
    expect(a.hasImage).toBe(false)
    expect(a.titleOnly).toBe(false)
  })

  it('strips HTML tags when measuring visible text length', () => {
    const a = analyzeSlide({ elements: [txt('<h1 style="color:red">Hello</h1>')] })
    // "Hello" -> 5 visible chars, tags + attributes ignored.
    expect(a.textLength).toBe(5)
    expect(a.types).toEqual(['text'])
  })

  it('decodes common HTML entities while measuring', () => {
    const a = analyzeSlide({ elements: [txt('<p>A &amp; B</p>')] })
    // "A & B" -> 5 chars.
    expect(a.textLength).toBe(5)
  })

  it('classifies a title + subtitle slide as sparse + titleOnly', () => {
    const slide = {
      elements: [
        txt('<h1 style="text-align:center">Presentation Title</h1>'),
        txt('<p style="text-align:center">Subtitle or author name</p>'),
      ],
    }
    const a = analyzeSlide(slide)
    expect(a.elementCount).toBe(2)
    expect(a.types).toEqual(['text'])
    expect(a.density).toBe('sparse')
    expect(a.titleOnly).toBe(true)
  })

  it('classifies a long single bullet list as dense (not titleOnly)', () => {
    const bullets =
      '<h2>Agenda</h2>' +
      '<ol>' +
      '<li>Establish the project scope and the long term vision</li>' +
      '<li>Review the architecture decisions across all services</li>' +
      '<li>Walk through the rollout plan and the rollback strategy</li>' +
      '<li>Discuss staffing, ownership and on call responsibilities</li>' +
      '<li>Agree on the success metrics and reporting cadence here</li>' +
      '</ol>'
    const slide = { elements: [txt('<h2>Agenda</h2>'), txt(bullets)] }
    const a = analyzeSlide(slide)
    expect(a.density).toBe('dense')
    expect(a.titleOnly).toBe(false)
    expect(a.types).toEqual(['text'])
  })

  it('detects an image-bearing slide', () => {
    const slide = {
      elements: [
        txt('<h2>Photo of the year</h2>'),
        { type: 'image', x: 0, y: 0, width: 400, height: 300, src: 'x.png' },
      ],
    }
    const a = analyzeSlide(slide)
    expect(a.hasImage).toBe(true)
    expect(a.types).toEqual(['image', 'text'])
    expect(a.titleOnly).toBe(false)
  })

  it('detects table / chart / code flags', () => {
    const a = analyzeSlide({
      elements: [
        { type: 'table', data: [['a']] },
        { type: 'chart' },
        { type: 'code', content: 'const x = 1' },
      ],
    })
    expect(a.hasTable).toBe(true)
    expect(a.hasChart).toBe(true)
    expect(a.hasCode).toBe(true)
    expect(a.types).toEqual(['chart', 'code', 'table'])
  })

  it('counts shape placeholder text toward visible text length', () => {
    const slide = {
      elements: [{ type: 'shape', shape: 'rect', text: 'Photo', x: 0, y: 0, width: 10, height: 10 }],
    }
    const a = analyzeSlide(slide)
    expect(a.textLength).toBe(5)
    expect(a.hasImage).toBe(false)
  })

  it('returns a sorted, unique type list for a mixed slide', () => {
    const slide = {
      elements: [
        txt('<p>one</p>'),
        { type: 'shape', shape: 'rect' },
        txt('<p>two</p>'),
        { type: 'icon', iconName: 'Star' },
      ],
    }
    const a = analyzeSlide(slide)
    expect(a.types).toEqual(['icon', 'shape', 'text'])
    expect(a.elementCount).toBe(4)
  })

  it('is deterministic and side-effect free across repeated calls', () => {
    const slide = { elements: [txt('<p>stable</p>')] }
    const first = analyzeSlide(slide)
    const second = analyzeSlide(slide)
    expect(second).toEqual(first)
    // slide untouched
    expect(slide.elements).toHaveLength(1)
  })
})
