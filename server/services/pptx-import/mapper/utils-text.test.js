import { describe, expect, it } from 'vitest'
import textUtils from './utils-text.js'

const {
  buildBaseTextStyle,
  extractTextInsets,
  extractTextMetadata,
  normalizeFontFamily,
  normalizeFontSize,
  plainText,
  ptToCanvasPx,
  normalizeImportedRichTextHtml,
} = textUtils

describe('pptx mapper text utilities', () => {
  it('normalizes plain text, font size, and font family', () => {
    expect(plainText('<p>Hello <strong>world</strong><script>bad()</script></p>')).toBe('Hello world')
    expect(normalizeFontSize('24pt')).toBe(24)
    expect(normalizeFontSize('0')).toBeUndefined()
    expect(normalizeFontFamily('"Aptos", sans-serif')).toBe('Aptos')
    expect(normalizeFontFamily('Arial; background:url(x)')).toBeUndefined()
    expect(normalizeFontFamily('url(EvilFont)')).toBeUndefined()
  })

  it('builds fallback text style from PPTX element fields', () => {
    expect(buildBaseTextStyle({
      paragraphAlign: 'center',
      fontSz: '18',
      fontName: 'Arial, sans-serif',
      fontColor: '#123456',
    })).toEqual({
      align: 'center',
      fontSize: 18,
      fontFace: 'Arial',
      color: '#123456',
    })
  })

  it('converts points to canvas px using the height-proportional scale axis', () => {
    // 72-DPI canvas (960×540): 1pt → 1px when scale.y === 1.
    expect(ptToCanvasPx(18, { x: 1, y: 1 })).toBe(18)
    // Non-uniform deck: font follows scale.y (height-proportional), not scale.x.
    expect(ptToCanvasPx(18, { x: 1, y: 0.75 })).toBe(13.5)
    expect(ptToCanvasPx(24, { x: 2, y: 2 })).toBe(48)
    // Defensive: missing/invalid scale falls back to identity.
    expect(ptToCanvasPx(18)).toBe(18)
    expect(ptToCanvasPx(undefined, { x: 1, y: 1 })).toBeUndefined()
  })

  it('extracts inline text metadata over element fallback style at canvas scale', () => {
    // Inline 22pt on a scale.y=1 deck → 22 canvas px (NOT 29.3 = 22×96/72).
    // The old ×96/72 inflation made imported text 1.333× too large for its box.
    const metadata = extractTextMetadata(
      '<p style="text-align:right"><span style="font-size:22pt;font-family:Calibri;color:#abcdef">Hi</span></p>',
      { textAlign: 'left', fontSize: 12, fontFamily: 'Arial', textColor: '#111111' }
    )
    expect(metadata).toMatchObject({
      textAlign: 'right',
      fontSize: 22,
      fontFamily: 'Calibri',
      textColor: '#abcdef',
    })
  })

  it('scales the dominant run font by a non-uniform deck scale.y', () => {
    const metadata = extractTextMetadata(
      '<p><span style="font-size:24pt">Scaled body text run</span></p>',
      { fontSize: 24 },
      { x: 1, y: 0.5 }
    )
    expect(metadata.fontSize).toBe(12)
  })

  it('recovers a child font size that numerically collides with the inherited pt value', () => {
    // Inherited 24pt; dominant child sets 18pt. Since 18 * 96/72 === 24, a
    // magnitude comparison would wrongly treat the child as "unchanged" and
    // leave it at 24 (33% too large). Detection must be structural.
    const metadata = extractTextMetadata(
      '<p><span style="font-size:18pt">This dominant run sets its own size</span></p>',
      { fontSize: 24 }
    )
    expect(metadata.fontSize).toBe(18)
  })

  it('extracts metadata from the longest styled text run', () => {
    // Import treats inline font-size as point-origin (parser emits pt → 96-DPI px);
    // recovered to canvas px: 14pt-origin px (14) → 14×72/96 = 10.5 at scale.y=1.
    const metadata = extractTextMetadata(
      '<span style="font-size:24px;color:red">Hi</span><span style="font-size:14px;color:black">This is the dominant body run.</span>'
    )

    expect(metadata.fontSize).toBe(10.5)
    expect(metadata.textColor).toBe('black')
  })

  it('treats nested text under the same styled element as one run', () => {
    const metadata = extractTextMetadata(
      '<span style="font-size:24px;color:red">Long <strong>dominant</strong> text</span><span style="font-size:12px;color:black">secondaryyyyy</span>'
    )

    expect(metadata.fontSize).toBe(18)
    expect(metadata.textColor).toBe('red')
  })

  it('does not aggregate a styled parent when visible child text overrides it', () => {
    const metadata = extractTextMetadata(
      '<span style="font-size:24px;color:red"><span style="font-size:12px;color:blue">All visible text lives here and is much longer</span></span>',
      { fontSize: 10, fontFamily: 'Arial', textColor: '#000000', textAlign: 'left' }
    )

    expect(metadata.fontSize).toBe(9)
    expect(metadata.textColor).toBe('blue')
  })

  it('extracts text inset aliases only when at least one is present', () => {
    // Standard deck (scale 1): pt → px is identity (no 96/72 inflation).
    expect(extractTextInsets({ lIns: 1, insetR: 2, marginTop: 3, bIns: 4 })).toEqual({
      left: 1,
      right: 2,
      top: 3,
      bottom: 4,
    })
    expect(extractTextInsets({})).toBeNull()
  })

  it('converts text insets from pt to scaled canvas px', () => {
    const result = extractTextInsets(
      { insetLeft: 7.2, insetRight: 7.2, insetTop: 3.6, insetBottom: 3.6 },
      { x: 4 / 3, y: 4 / 3 },
      { width: 200, height: 80 }
    )

    // Insets follow the box axis scale only: 7.2 × 4/3 = 9.6, 3.6 × 4/3 = 4.8.
    expect(result).toEqual({
      left: 9.6,
      right: 9.6,
      top: 4.8,
      bottom: 4.8,
    })
  })

  it('normalizes invalid and extreme text insets', () => {
    const result = extractTextInsets(
      { insetLeft: -2, insetRight: '1e9', insetTop: 'bad', insetBottom: Infinity },
      { x: 1, y: 1 },
      { width: 120, height: 40 }
    )

    expect(result).toEqual({ left: 0, right: 60, top: null, bottom: null })
  })

  it('removes imported run font sizing so element-level fit can control layout', () => {
    expect(
      normalizeImportedRichTextHtml('<p style="font-size:24px;line-height:1.4;color:#123456">Hello</p>')
    ).toBe('<p style="color:#123456">Hello</p>')
  })
})
