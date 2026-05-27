import { describe, expect, it } from 'vitest'
import { htmlToPptTextRuns, stripHtmlToPlainText } from './export-pptx-text-runs.js'

describe('export-pptx-text-runs', () => {
  // ─── Phase 1: Strike ───────────────────────────────────────────────────
  ;[
    ['<s>strikethrough</s>', true],
    ['<strike>strikethrough</strike>', true],
    ['<del>deleted text</del>', true],
    ['<span style="text-decoration:line-through">strike</span>', true],
    ['<span style="text-decoration:underline">underline</span>', false],
    ['plain text', false],
  ].forEach(([html, expectStrike]) => {
    it(`strike in output: ${String(html).slice(0, 40)}`, () => {
      const runs = htmlToPptTextRuns(html)
      const hasStrike = runs.some((r) => r.options?.strike)
      expect(hasStrike).toBe(expectStrike)
    })
  })

  // ─── Phase 1: Subscript/Superscript ──────────────────────────────────
  ;[
    ['<sub>subscript</sub>', 'subscript', 'subscript'],
    ['<sup>superscript</sup>', 'superscript', 'superscript'],
    ['<span style="vertical-align:sub">subalign</span>', 'subalign', 'subscript'],
    ['<span style="vertical-align:super">superalign</span>', 'superalign', 'superscript'],
  ].forEach(([html, label, expectKey]) => {
    it(`sub/sup in output: ${label}`, () => {
      const runs = htmlToPptTextRuns(html)
      const subRun = runs.find((r) => r.options?.[expectKey])
      expect(subRun).toBeDefined()
    })
  })

  // ─── Phase 1: Letter-spacing ─────────────────────────────────────────
  ;[
    ['<span style="letter-spacing:2pt">spaced</span>', true],
    ['<span style="letter-spacing:0.5em">wide</span>', false],
    ['<span style="letter-spacing:normal">normal</span>', false], // "normal" doesn't parse as number
    ['plain text', false],
  ].forEach(([html, expectCharSpacing]) => {
    it(`letter-spacing in output: ${String(html).slice(0, 40)}`, () => {
      const runs = htmlToPptTextRuns(html)
      const hasSpacing = runs.some((r) => r.options?.charSpacing != null)
      expect(hasSpacing).toBe(expectCharSpacing)
    })
  })

  // ─── Phase 1: Hyperlinks ─────────────────────────────────────────────
  ;[
    ['<a href="https://example.com">link</a>', 'https://example.com'],
    ['<a href="mailto:test@test.com">email</a>', 'mailto:test@test.com'],
    ['<a href="tel:+1234567890">phone</a>', 'tel:+1234567890'],
    ['<a href="https://safe.com" style="color:red">styled link</a>', 'https://safe.com'],
  ].forEach(([html, expectHref]) => {
    it(`hyperlink detection: ${expectHref}`, () => {
      const runs = htmlToPptTextRuns(html)
      const linkRuns = runs.filter((r) => r.options?.hyperlink)
      expect(linkRuns.length).toBeGreaterThan(0)
      expect(linkRuns[0].options.hyperlink).toEqual({ url: expectHref })
    })
  })

  // ─── Phase 1: Round-trip formatting ─────────────────────────────────
  ;[
    // [html input, description]
    ['<strong>bold text</strong>', 'bold'],
    ['<em>italic text</em>', 'italic'],
    ['<u>underlined</u>', 'underline'],
    ['<span style="color:#e74c3c">red</span>', 'color'],
    ['<span style="font-size:24pt">large</span>', 'font-size'],
    ['<span style="font-family:Arial">arial</span>', 'font-family'],
    ['<p style="text-align:center">centered</p>', 'align'],
    ['<ul><li>bullet item</li></ul>', 'bullet list'],
    ['<ol><li>numbered item</li></ol>', 'numbered list'],
    ['<strong><em>bold+italic</em></strong>', 'nested bold+italic'],
    // Phase 0 new tags
    ['<s>strike</s>', 'strike tag'],
    ['<sub>sub</sub>', 'subscript tag'],
    ['<sup>sup</sup>', 'superscript tag'],
  ].forEach(([html, label]) => {
    it(`round-trip formatting: ${label}`, () => {
      const runs = htmlToPptTextRuns(html)
      expect(runs.length).toBeGreaterThan(0)
      expect(runs.some((r) => r.text && r.text.trim())).toBe(true)
    })
  })

  // ─── Phase 1: Composite formatting ───────────────────────────────────
  it('bold + italic + color combined', () => {
    const runs = htmlToPptTextRuns('<span style="color:#e74c3c"><strong><em>combined</em></strong></span>')
    expect(runs.length).toBeGreaterThan(0)
    const run = runs.find((r) => r.text === 'combined')
    expect(run.options.bold).toBe(true)
    expect(run.options.italic).toBe(true)
    // normalizeCssColor returns uppercase hex without '#'
    expect(run.options.color?.toUpperCase()).toBe('E74C3C')
  })

  it('converts CSS px and pt font lengths to PowerPoint points', () => {
    const pxRuns = htmlToPptTextRuns('<span style="font-size:32px;letter-spacing:2.7px">large</span>')
    expect(pxRuns[0].options.fontSize).toBe(24)
    expect(pxRuns[0].options.charSpacing).toBe(2)

    const ptRuns = htmlToPptTextRuns('<span style="font-size:24pt;letter-spacing:2pt">large</span>')
    expect(ptRuns[0].options.fontSize).toBe(24)
    expect(ptRuns[0].options.charSpacing).toBe(2)
  })

  it('link inside paragraph preserves alignment', () => {
    const runs = htmlToPptTextRuns('<p style="text-align:center"><a href="https://test.com">centered link</a></p>')
    const centerRun = runs.find((r) => r.options?.align === 'center')
    expect(centerRun).toBeDefined()
  })

  it('text with multiple links in same paragraph', () => {
    const runs = htmlToPptTextRuns('<p>text <a href="https://a.com">link A</a> and <a href="https://b.com">link B</a></p>')
    const links = runs.filter((r) => r.options?.hyperlink)
    expect(links.length).toBe(2)
  })

  it('plain text fallback', () => {
    const runs = htmlToPptTextRuns('plain text no html')
    expect(runs.length).toBeGreaterThan(0)
    expect(runs[0].text).toBe('plain text no html')
  })

  it('stripHtmlToPlainText removes all tags', () => {
    const plain = stripHtmlToPlainText('<p style="color:red"><strong>bold</strong> and <em>italic</em></p>')
    expect(plain).toBe('bold and italic')
    expect(plain).not.toMatch(/<[^>]+>/)
  })

  it('nested list items rendered as bullets', () => {
    const runs = htmlToPptTextRuns('<ul><li>item 1</li><li>item 2</li></ul>')
    const bulletRuns = runs.filter((r) => r.options?.bullet)
    expect(bulletRuns.length).toBe(2)
  })
})
