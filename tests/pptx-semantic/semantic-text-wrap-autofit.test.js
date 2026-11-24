import { describe, expect, it } from 'vitest'
import { layout } from './text-wrap-autofit-fixture.js'

const text = (line) => line.runs.map((run) => run.text).join('')

describe('measured source-aware wrapping and declared normal autofit', () => {
  it('wraps at word boundaries using actual widths and retains exact offsets', async () => {
    const { result, intact, reference } = await layout({ reference: true })
    expect(result.status).toBe('measured')
    expect(result.lines.map(text)).toEqual(['MM MM ', 'MM'])
    expect(result.lines.map(text)).toEqual(reference)
    expect(result.lines[0].runs[0]).toMatchObject({ componentId: 'r', start: 0, end: 6 })
    expect(result.lines[1].runs[0]).toMatchObject({ componentId: 'r', start: 6, end: 8 })
    expect(result.lines[0].width).toBeCloseTo(4 * 16 * 0.917 + 8, 1)
    expect(result.lines[0].contentWidth).toBeCloseTo(4 * 16 * 0.917 + 4, 1)
    expect(result.overflow.horizontal).toBe(false)
    expect(intact).toBe(true)
    expect(result.qualified).toBe(false)
  })

  it('does not introduce breaks at rich-run boundaries or inside nonbreaking words', async () => {
    const { result } = await layout({
      width: 40,
      runs: [
        { componentId: 'a', kind: 'text', text: 'MM' },
        { componentId: 'b', kind: 'field', text: 'MM', field: { id: 'id', type: 'slidenum' } },
      ],
    })
    expect(result.status).toBe('measured')
    expect(result.lines).toHaveLength(1)
    expect(text(result.lines[0])).toBe('MMMM')
    expect(result.overflow.horizontal).toBe(true)
  })

  it('retains hard breaks, consecutive empty lines and first-line-only indent after wrapping', async () => {
    const { result } = await layout({
      width: 65,
      properties: { indentEmu: 95250 },
      runs: [
        { componentId: 'r', kind: 'text', text: 'MM MM' },
        { componentId: 'br', kind: 'break' },
        { componentId: 'br2', kind: 'break' },
        { componentId: 'last', kind: 'text', text: 'MM' },
      ],
    })
    expect(result.lines.map(text)).toEqual(['MM ', 'MM', '', 'MM'])
    expect(result.lines.map((line) => line.x)).toEqual([10, 0, 0, 0])
    expect(result.lines[1].breakComponentId).toBe('br')
    expect(result.lines[2].breakComponentId).toBe('br2')
  })

  it('uses paragraph margins as the measured wrapping width', async () => {
    const { result } = await layout({
      width: 100,
      properties: { marginLeftEmu: 190500, marginRightEmu: 190500 },
    })
    expect(result.status).toBe('measured')
    expect(result.lines.map(text)).toEqual(['MM ', 'MM ', 'MM'])
    expect(result.lines.every((line) => line.x === 20)).toBe(true)
  })

  it('retains mixed styles and split-run offsets at a measured soft edge', async () => {
    const { result, intact } = await layout({
      width: 50,
      runs: [
        { componentId: 'small', kind: 'text', text: 'M ' },
        { componentId: 'large', kind: 'text', text: 'M M', properties: { fontSizePt: 24 } },
      ],
    })
    expect(result.status).toBe('measured')
    expect(result.lines.map(text)).toEqual(['M M ', 'M'])
    expect(result.lines[0].runs.map((run) => run.fontSizePt)).toEqual([12, 24])
    expect(result.lines[1].runs[0]).toMatchObject({
      componentId: 'large',
      start: 2,
      end: 3,
      properties: { fontSizePt: 24 },
    })
    expect(intact).toBe(true)
  })

  it('applies only source normal font scale and line-space reduction without changing source', async () => {
    const { result, intact } = await layout({
      body: { autofit: { mode: 'normal', fontScale: 50000, lineSpaceReduction: 25000 } },
    })
    const { result: natural } = await layout({
      body: { autofit: { mode: 'normal', fontScale: 50000, lineSpaceReduction: 0 } },
    })
    expect(result.status).toBe('measured')
    expect(result.lines).toHaveLength(1)
    expect(result.height).toBeCloseTo(natural.height * 0.75, 5)
    expect(result.lines[0].runs[0]).toMatchObject({ sourceFontSizePt: 12, fontSizePt: 6 })
    expect(intact).toBe(true)
  })

  it('distinguishes missing source scale from explicit zero and preserves noAutofit overflow', async () => {
    const { result: absent, plan } = await layout({ body: { autofit: { mode: 'normal' } } })
    expect(absent.status).toBe('measured')
    expect(absent.fontScale).toBe(1)
    expect(plan.document.body.autofit).toEqual({ mode: 'normal' })
    const { result: zero } = await layout({ body: { autofit: { mode: 'normal', fontScale: 0 } } })
    expect(zero).toMatchObject({ status: 'unsupported', lines: [] })
    const { result: none } = await layout({ body: { wrap: false }, width: 20 })
    expect(none.fontScale).toBe(1)
    expect(none.overflow.horizontal).toBe(true)
  })

  it('keeps nonbreaking spaces intact, measured overflow and field provenance', async () => {
    const { result } = await layout({
      width: 20,
      runs: [
        {
          componentId: 'field',
          kind: 'field',
          text: 'M\u00a0M',
          field: { id: 'native', type: 'slidenum' },
          properties: { spacingPt: 0, bold: false },
        },
      ],
    })
    expect(result.status).toBe('measured')
    expect(result.lines).toHaveLength(1)
    expect(result.overflow.horizontal).toBe(true)
    expect(result.lines[0].runs[0]).toMatchObject({
      sourceKind: 'field',
      field: { id: 'native', type: 'slidenum' },
      path: 'paragraphs[0].runs[0]',
      properties: { spacingPt: 0, bold: false },
    })
  })

  it('preserves CRLF provenance and paragraph spacing after measured wraps', async () => {
    const properties = {
      lineSpacing: { unit: 'points', value: 15 },
      spaceBefore: { unit: 'points', value: 3 },
      spaceAfter: { unit: 'points', value: 6 },
    }
    const paragraphs = ['first', 'second'].map((componentId) => ({
      componentId,
      properties,
      defaultRunProperties: { fontSizePt: 12, fontLatin: { typeface: 'Main' } },
      runs: [{ componentId: `${componentId}-run`, kind: 'text', text: 'MM MM\r\n' }],
    }))
    const { result } = await layout({ width: 40, paragraphs })
    expect(result.status).toBe('measured')
    expect(result.lines.map(text)).toEqual(['MM ', 'MM', '', 'MM ', 'MM', ''])
    expect(result.lines[1].sourceBreak).toEqual({
      componentId: 'first-run',
      start: 5,
      end: 7,
      text: '\r\n',
    })
    expect(result.lines[3].y).toBe(72)
    expect(result.height).toBe(132)
  })

  it.each(['M\tM', 'M\u00adM', 'M\u200bM', '\u6f22'])(
    'refuses unsupported soft-wrap policy %j without partial layout',
    async (value) => {
      const { result } = await layout({
        runs: [{ componentId: 'r', kind: 'text', text: value }],
        defaults: { fontEastAsian: { typeface: 'Main' } },
      })
      expect(result).toMatchObject({ status: 'unsupported', qualified: false, lines: [] })
      expect(result.issues[0].code).toBe(
        value.includes('\t') ? 'unsupported-soft-wrap-tabs' : 'unsupported-soft-wrap-policy'
      )
    }
  )
})
