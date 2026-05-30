import { describe, it, expect } from 'vitest'
import { THEME_PRESETS } from 'revealjs-shared'
import { suggestDesigns } from './suggest'

const txt = (content) => ({ type: 'text', x: 0, y: 0, width: 100, height: 40, content })

// Slide fixtures mirroring real editor shapes.
const titleSubtitle = {
  elements: [
    txt('<h1 style="text-align:center">Presentation Title</h1>'),
    txt('<p style="text-align:center">Subtitle or author name</p>'),
  ],
}

const denseBullets = {
  elements: [
    txt('<h2>Agenda</h2>'),
    txt(
      '<ol>' +
        '<li>Establish the project scope and the long term product vision</li>' +
        '<li>Review the architecture decisions taken across all services</li>' +
        '<li>Walk through the rollout plan and the rollback strategy now</li>' +
        '<li>Discuss staffing, ownership and on call responsibilities here</li>' +
        '<li>Agree on the success metrics and the reporting cadence today</li>' +
        '</ol>'
    ),
  ],
}

const emptySlide = { id: 'e1', elements: [] }

const TITLE_LIKE = new Set([
  'title', 'section-header', 'big-number', 'quote', 'cover-hero',
  'big-quote', 'thank-you', 'definition', 'stat-callout',
])
const WIDE_LIKE = new Set(['two-column', 'three-column', 'agenda', 'four-grid'])

describe('suggestDesigns', () => {
  it('returns 3-5 suggestions for a typical slide', () => {
    const out = suggestDesigns(titleSubtitle)
    expect(out.length).toBeGreaterThanOrEqual(3)
    expect(out.length).toBeLessThanOrEqual(5)
  })

  it('title+subtitle slide suggests a title/section-style layout plus >= 2 theme pairings', () => {
    const out = suggestDesigns(titleSubtitle)
    const layouts = out.filter((s) => s.kind === 'layout')
    const themes = out.filter((s) => s.kind === 'theme')
    expect(themes.length).toBeGreaterThanOrEqual(2)
    expect(layouts.length).toBeGreaterThanOrEqual(1)
    const layoutIds = layouts.map((l) => l.templateId)
    expect(layoutIds.some((id) => TITLE_LIKE.has(id))).toBe(true)
  })

  it('dense bullet slide suggests a multi-column / agenda layout', () => {
    const out = suggestDesigns(denseBullets)
    const layoutIds = out.filter((s) => s.kind === 'layout').map((l) => l.templateId)
    expect(layoutIds.some((id) => WIDE_LIKE.has(id))).toBe(true)
  })

  it('empty slide returns theme-only suggestions and never crashes', () => {
    const out = suggestDesigns(emptySlide)
    expect(out.length).toBeGreaterThanOrEqual(3)
    expect(out.length).toBeLessThanOrEqual(5)
    expect(out.every((s) => s.kind === 'theme')).toBe(true)
  })

  it('null slide is handled gracefully (theme-only, no throw)', () => {
    const out = suggestDesigns(null)
    expect(out.length).toBeGreaterThanOrEqual(3)
    expect(out.every((s) => s.kind === 'theme')).toBe(true)
  })

  it('does not suggest layouts when content cannot map cleanly (chart present)', () => {
    const slide = { elements: [txt('<h2>Revenue</h2>'), { type: 'chart', chartType: 'bar' }] }
    const out = suggestDesigns(slide)
    expect(out.some((s) => s.kind === 'layout')).toBe(false)
    expect(out.length).toBeGreaterThanOrEqual(3)
  })

  it('produces deterministic ordering across repeated calls', () => {
    const a = suggestDesigns(titleSubtitle)
    const b = suggestDesigns(titleSubtitle)
    expect(b).toEqual(a)
  })

  it('orders results by score descending then id ascending', () => {
    const out = suggestDesigns(denseBullets)
    for (let i = 1; i < out.length; i += 1) {
      const prev = out[i - 1]
      const cur = out[i]
      if (prev.score === cur.score) {
        const pid = prev.templateId || prev.presetId
        const cid = cur.templateId || cur.presetId
        expect(pid <= cid).toBe(true)
      } else {
        expect(prev.score).toBeGreaterThan(cur.score)
      }
    }
  })

  it('never emits a negative score', () => {
    for (const slide of [titleSubtitle, denseBullets, emptySlide]) {
      for (const s of suggestDesigns(slide)) {
        expect(s.score).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('theme suggestions carry a color preview; layouts carry template metadata', () => {
    const out = suggestDesigns(titleSubtitle)
    for (const s of out) {
      expect(typeof s.label).toBe('string')
      expect(typeof s.score).toBe('number')
      if (s.kind === 'theme') {
        expect(typeof s.presetId).toBe('string')
        expect(s.preview.colors).toBeTruthy()
        expect(typeof s.preview.colors.accent).toBe('string')
      } else {
        expect(typeof s.templateId).toBe('string')
        expect(s.preview).toBeTruthy()
      }
    }
  })

  it('excludes the deck current theme (by accent) from theme suggestions', () => {
    const current = THEME_PRESETS[0] // minimal-white
    const out = suggestDesigns(emptySlide, { currentTokens: current.tokens })
    const accents = out.filter((s) => s.kind === 'theme').map((s) => s.preview.colors.accent)
    expect(accents).not.toContain(current.tokens.colors.accent)
  })

  it('offers theme variety (distinct categories) when possible', () => {
    const out = suggestDesigns(emptySlide)
    const cats = out
      .filter((s) => s.kind === 'theme')
      .map((s) => s.preview.category)
    expect(new Set(cats).size).toBeGreaterThanOrEqual(2)
  })
})
