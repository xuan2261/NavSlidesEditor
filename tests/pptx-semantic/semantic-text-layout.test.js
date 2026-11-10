import { describe, expect, it } from 'vitest'
import { prepareTextLayout, textLayoutIdentity, layoutTextDocument } from '../../shared/src/pptx-text-layout.js'

const face = { id: 'main', typeface: 'Fixture Main', assetHash: 'd0332f52868370fd83ae7fa46470f90c8f2eab2fcf12bc4f88080b340c95a830' }
const request = () => ({
  document: {
    schemaVersion: 1, componentId: 'body',
    body: { insetLeftEmu: 12700, insetRightEmu: 25400, insetTopEmu: 38100, insetBottomEmu: 50800,
      wrap: false, verticalText: 'horz', verticalAlign: 't', autofit: { mode: 'none' } },
    paragraphs: [{ componentId: 'p', defaultRunProperties: { fontSizePt: 12, fontLatin: { typeface: face.typeface } },
      runs: [{ componentId: 'a', kind: 'text', text: ' M ' }, { componentId: 'br', kind: 'break' },
        { componentId: 'b', kind: 'field', text: '08/07', field: { id: 'date', type: 'datetime' }, properties: { fontSizePt: 24 } }] }],
  },
  shape: { widthEmu: 1905000, heightEmu: 952500, textRectEmu: { l: 1000, t: 2000, r: 1800000, b: 900000 } },
  fontProfile: { schemaVersion: 1, faces: [face] },
  rendererProfile: { id: 'pptx-explicit-lines-v1', sessionId: 'test-planning-only', userAgent: 'fixture',
    platform: 'fixture', language: 'en-US', devicePixelRatio: 1 },
})

describe('bounded canonical text layout planning (not font measurement)', () => {
  it('preserves source values, field cache, whitespace and explicit lines without fitting', () => {
    const input = request(), before = structuredClone(input)
    const result = prepareTextLayout(input)
    expect(result.issues).toEqual([])
    expect(result.document).toEqual(before.document)
    expect(result.textRectEmu).toEqual({ l: 13700, t: 40100, r: 1774600, b: 849200 })
    expect(result.paragraphs[0].lines.map((line) => line.items.map((item) => item.text).join(''))).toEqual([' M ', '08/07'])
    expect(result.paragraphs[0].lines[1].items[0]).toMatchObject({ componentId: 'b', start: 0, end: 5,
      properties: { fontSizePt: 24 }, faceId: 'main' })
    expect(input).toEqual(before)
    result.document.paragraphs[0].runs[0].text = 'other'
    expect(input).toEqual(before)
  })

  it('retains explicit false/zero and source offsets through CRLF, tabs and consecutive breaks', () => {
    const input = request(), p = input.document.paragraphs[0]
    p.defaultRunProperties.bold = true
    p.properties = { tabs: [{ positionEmu: 914400, alignment: 'l' }], defaultTabSizeEmu: 914400 }
    p.runs = [{ componentId: 'r', kind: 'text', text: 'A\r\n\t\nB', properties: { bold: false, spacingPt: 0 } }]
    const lines = prepareTextLayout(input).paragraphs[0].lines
    expect(lines).toHaveLength(3)
    expect(lines[1].items[0]).toMatchObject({ kind: 'tab', start: 3, end: 4 })
    expect(lines[2].items[0]).toMatchObject({ text: 'B', start: 5, end: 6,
      properties: { bold: false, spacingPt: 0 } })
  })

  it('selects script-specific declared faces without inserting fallback fonts', () => {
    const input = request(), p = input.document.paragraphs[0]
    input.fontProfile.faces.push({ ...face, id: 'ea', typeface: 'East Asian' }, { ...face, id: 'cs', typeface: 'Complex' })
    p.defaultRunProperties.fontEastAsian = { typeface: 'East Asian', script: 'Jpan' }
    p.defaultRunProperties.fontComplexScript = { typeface: 'Complex', script: 'Hebr' }
    p.runs = [{ componentId: 'mixed', kind: 'text', text: 'A\u6f22\u05d0' }]
    const result = prepareTextLayout(input)
    expect(result.issues).toEqual([])
    expect(result.paragraphs[0].lines[0].items.map(({ text, faceId }) => [text, faceId]))
      .toEqual([['A', 'main'], ['\u6f22', 'ea'], ['\u05d0', 'cs']])
  })

  it.each([[['\u6f22', '\u3001', '\u5b57']], [['(', '\u6f22', ')']], [['\u6f22', '\u0301']]])(
    'keeps script context across authored run boundaries for %j', (parts) => {
      const input = request(), p = input.document.paragraphs[0]
      input.fontProfile.faces.push({ ...face, id: 'ea', typeface: 'East Asian' })
      p.defaultRunProperties.fontEastAsian = { typeface: 'East Asian', script: 'Jpan' }
      p.runs = [{ componentId: 'whole', kind: 'text', text: parts.join('') }]
      const whole = prepareTextLayout(input)
      p.runs = parts.map((text, index) => ({ componentId: `part${index}`, kind: 'text', text }))
      const split = prepareTextLayout(input)
      expect(split.issues).toEqual([])
      expect(whole.paragraphs[0].lines[0].items.every((item) => item.faceId === 'ea')).toBe(true)
      expect(split.paragraphs[0].lines[0].items.every((item) => item.faceId === 'ea')).toBe(true)
    }
  )

  it.each([
    ['verticalText', 'eaVert', 'unsupported-vertical-text'],
    ['rotation', 60000, 'unsupported-text-rotation'],
    ['rtlColumns', true, 'unsupported-rtl-columns'],
    ['columnCount', 2, 'unsupported-text-columns'],
    ['compatibleLineSpacing', true, 'unsupported-compatible-line-spacing'],
    ['anchorCenter', true, 'unsupported-anchor-center'],
    ['autofit', { mode: 'shape' }, 'shape-autofit-needs-geometry'],
    ['autofit', { mode: 'normal', fontScale: 0 }, 'zero-autofit-font-scale'],
  ])('locates unsupported body %s instead of claiming layout', (property, value, code) => {
    const input = request()
    input.document.body[property] = value
    expect(prepareTextLayout(input).issues).toContainEqual(expect.objectContaining({ code, componentId: 'body', path: `body.${property}` }))
    expect(layoutTextDocument(input, null)).toMatchObject({ status: 'unsupported', qualified: false, lines: [] })
  })

  it.each([
    ['alignment', 'dist'], ['fontAlignment', 't'], ['bullet', { kind: 'number', scheme: 'circleNumWdBlackPlain' }],
    ['tabs', [{ positionEmu: 914400 }, { positionEmu: 914400 }]], ['hangingPunctuation', true],
  ])('locates unsupported paragraph %s', (property, value) => {
    const input = request()
    input.document.paragraphs[0].properties = { [property]: value }
    expect(prepareTextLayout(input).issues).toContainEqual(expect.objectContaining({ componentId: 'p', path: `paragraphs[0].properties.${property}` }))
  })

  it('does not invent missing inherited body, size, script or font information', () => {
    const input = request()
    delete input.document.body.insetTopEmu
    delete input.document.paragraphs[0].defaultRunProperties.fontSizePt
    input.document.paragraphs[0].runs[0].text = '\u6f22'
    const issues = prepareTextLayout(input).issues
    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['unresolved-body-property', 'unresolved-font-size', 'unresolved-script-font']))
    expect(() => prepareTextLayout({ ...request(), document: { ...request().document, body: { rtlColumns: 0 } } })).toThrow(TypeError)
  })

  it('preserves absent versus explicit false rtlColumns through shared canonical validation', () => {
    const input = request(), absent = prepareTextLayout(input)
    expect(absent.document.body).not.toHaveProperty('rtlColumns')
    input.document.body.rtlColumns = false
    const explicit = prepareTextLayout(input)
    expect(explicit.issues).toEqual([])
    expect(explicit.document.body.rtlColumns).toBe(false)
    expect(explicit.cacheKey).not.toBe(absent.cacheKey)
  })

  it('locates an alternate-language declaration instead of silently ignoring shaping context', () => {
    const input = request()
    input.document.paragraphs[0].defaultRunProperties.altLanguage = 'ja-JP'
    expect(prepareTextLayout(input).issues).toContainEqual(expect.objectContaining({
      code: 'unsupported-alternate-language', componentId: 'a',
      path: 'paragraphs[0].runs[0].properties.altLanguage',
    }))
  })
  it.each([
    ['kumimoji', true, 'unsupported-kumimoji'],
    ['capitalization', 'small', 'unsupported-capitalization'],
    ['capitalization', 'all', 'unsupported-capitalization'],
    ['normalizeHeight', true, 'unsupported-normalize-height'],
  ])('locates active typography %s on text, fields, breaks, equations and paragraph-end struts', (key, value, code) => {
    const input = request(), paragraph = input.document.paragraphs[0]
    paragraph.defaultRunProperties[key] = value
    paragraph.endRunProperties = { [key]: value }
    const namespaceUri = 'http://schemas.openxmlformats.org/officeDocument/2006/math'
    const node = (componentId, type, children = [], text) => ({ componentId, namespaceUri, type,
      attributes: [], children, ...(text === undefined ? {} : { text }) })
    paragraph.runs.push({ componentId: 'equation', kind: 'equation', ommlDocument: { schemaVersion: 1,
      root: node('math', 'oMath', [node('math-run', 'r', [node('math-text', 't', [], 'x')])]) } })
    const result = layoutTextDocument(input, null)
    expect(result).toMatchObject({ status: 'unsupported', qualified: false, lines: [] })
    for (const componentId of ['a', 'b', 'br', 'equation', 'p'])
      expect(result.issues).toContainEqual(expect.objectContaining({ code, componentId }))
    expect(result.issues).toContainEqual({ code, componentId: 'equation', path: `paragraphs[0].runs[3].properties.${key}` })
    expect(result.issues).toContainEqual({ code, componentId: 'p', path: `paragraphs[0].endRunProperties.${key}` })
  })
  it('lets explicit false and none defeat inherited active typography without injecting declarations', () => {
    const input = request(), paragraph = input.document.paragraphs[0]
    const absent = prepareTextLayout(input)
    paragraph.defaultRunProperties = { ...paragraph.defaultRunProperties, kumimoji: true, capitalization: 'all', normalizeHeight: true }
    const disabled = { kumimoji: false, capitalization: 'none', normalizeHeight: false }
    for (const run of paragraph.runs) run.properties = { ...run.properties, ...disabled }
    paragraph.endRunProperties = disabled
    const result = prepareTextLayout(input)
    expect(result.issues).toEqual([])
    expect(result.document.paragraphs[0].runs[0].properties).toEqual(disabled)
    expect(absent.document.paragraphs[0].runs[0]).not.toHaveProperty('properties')
    expect(result.cacheKey).not.toBe(absent.cacheKey)
  })
  it.each([{ kumimoji: 0 }, { capitalization: 'uppercase' }, { normalizeHeight: 'false' }])(
    'rejects malformed canonical run typography %j rather than normalizing it to a default', (properties) => {
      const input = request()
      input.document.paragraphs[0].runs[0].properties = properties
      expect(() => prepareTextLayout(input)).toThrow(TypeError)
    }
  )

  it.each(['missing', 'substituted', 'ambiguous'])('refuses %s font identity', (status) => {
    const input = request()
    if (status === 'missing') input.fontProfile.faces = []
    if (status === 'substituted') input.fontProfile.faces = [{ ...face, typeface: 'Other', substituteFor: face.typeface }]
    if (status === 'ambiguous') input.fontProfile.faces.push({ ...face, id: 'other' })
    expect(prepareTextLayout(input).issues.map((issue) => issue.code)).toContain(`font-${status}`)
  })
  it('explicitly invalidates qualification when a font is substituted or missing', () => {
    const substituted = request()
    substituted.fontProfile.faces = [{ ...face, typeface: 'Substituted Face', substituteFor: face.typeface }]
    const subResult = layoutTextDocument(substituted, null)
    expect(subResult).toMatchObject({ status: 'unsupported', qualified: false })
    expect(subResult.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'font-substituted', path: 'paragraphs[0].runs[0].properties.fontLatin' }),
    ]))

    const missing = request()
    missing.fontProfile.faces = []
    const missResult = layoutTextDocument(missing, null)
    expect(missResult).toMatchObject({ status: 'unsupported', qualified: false })
    expect(missResult.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'font-missing', path: 'paragraphs[0].runs[0].properties.fontLatin' }),
    ]))
  })

  it('handles native normal autofit scaling without minimum font size truncation', () => {
    const input = request()
    input.document.body.autofit = { mode: 'normal', fontScale: 62500, lineSpaceReduction: 15000 }
    input.document.paragraphs[0].runs[0].properties = { fontSizePt: 6.4 }
    const plan = prepareTextLayout(input)
    expect(plan.issues).toEqual([])
    expect(plan.fontScale).toBe(0.625)
    expect(plan.paragraphs[0].lines[0].items[0].properties.fontSizePt).toBe(6.4)
  })

  it('rejects shape autofit and zero font scale as unsupported in measured layout', () => {
    const shape = request()
    shape.document.body.autofit = { mode: 'shape' }
    expect(layoutTextDocument(shape, null)).toMatchObject({
      status: 'unsupported', qualified: false,
      issues: [expect.objectContaining({ code: 'shape-autofit-needs-geometry', path: 'body.autofit' })],
    })

    const zero = request()
    zero.document.body.autofit = { mode: 'normal', fontScale: 0 }
    expect(layoutTextDocument(zero, null)).toMatchObject({
      status: 'unsupported', qualified: false,
      issues: [expect.objectContaining({ code: 'zero-autofit-font-scale', path: 'body.autofit' })],
    })
  })


  it('binds exact source, rectangle, extent, all font evidence and renderer/DPR in cache identity', () => {
    const input = request(), key = textLayoutIdentity(input)
    for (const mutate of [
      (v) => { v.document.paragraphs[0].runs[0].text += ' ' },
      (v) => { v.document.paragraphs[0].runs[1].properties = { fontSizePt: 7 } },
      (v) => { v.shape.widthEmu++ }, (v) => { v.shape.textRectEmu.l++ },
      (v) => { v.fontProfile.faces[0].assetHash = 'a'.repeat(64) },
      (v) => { v.rendererProfile.devicePixelRatio = 2 },
      (v) => { v.rendererProfile.sessionId = 'stale' },
    ]) {
      const changed = structuredClone(input)
      mutate(changed)
      expect(textLayoutIdentity(changed)).not.toBe(key)
    }
    expect(textLayoutIdentity(structuredClone(input))).toBe(key)
  })

  it('resolves authored numbering, nested continuation and explicit restart without mutating runs', () => {
    const input = request(), source = input.document.paragraphs[0]
    input.document.paragraphs = [
      { level: 0, scheme: 'arabicPeriod', startAt: 3 },
      { level: 1, scheme: 'alphaLcParenR' },
      { level: 0, scheme: 'arabicPeriod' },
      { level: 0, scheme: 'romanUcPeriod', startAt: 9 },
    ].map(({ level, scheme, startAt }, index) => ({
      ...source, componentId: `p${index}`, properties: { level,
        bullet: { kind: 'number', scheme, ...(startAt ? { startAt } : {}) },
        bulletColor: { kind: 'srgb', value: '123456' },
        bulletSize: { unit: 'percent', value: 75000 } },
      runs: [{ componentId: `r${index}`, kind: 'text', text: 'M' }],
    }))
    const before = structuredClone(input), plan = prepareTextLayout(input)
    expect(plan.issues).toEqual([])
    expect(plan.paragraphs.map((paragraph) => paragraph.bullet.text)).toEqual(['3.', 'a)', '4.', 'IX.'])
    expect(plan.paragraphs[0].bullet.properties).toMatchObject({ fontSizePt: 9,
      color: { kind: 'srgb', value: '123456' } })
    expect(input).toEqual(before)
  })

  it('admits decimal tab alignment only to the measured browser boundary, not estimated widths', () => {
    const input = request()
    input.document.paragraphs[0].properties = { tabs: [{ positionEmu: 914400, alignment: 'dec' }] }
    input.document.paragraphs[0].runs = [{ componentId: 'r', kind: 'text', text: 'M\t12.5' }]
    expect(prepareTextLayout(input).issues).toEqual([])
    expect(layoutTextDocument(input, null)).toMatchObject({ status: 'unsupported', lines: [],
      issues: [expect.objectContaining({ code: 'browser-measurement-required' })] })
  })

  it('rejects malformed geometry and refuses an absent measurement boundary', () => {
    const input = request()
    expect(() => prepareTextLayout({ ...input, shape: { ...input.shape, widthEmu: NaN } })).toThrow(TypeError)
    expect(layoutTextDocument(input, null)).toMatchObject({ status: 'unsupported', qualified: false,
      issues: [expect.objectContaining({ code: 'browser-measurement-required' })] })
  })
})
