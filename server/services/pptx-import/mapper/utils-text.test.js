import { describe, expect, it } from 'vitest'
import textUtils from './utils-text.js'

const {
  buildBaseTextStyle,
  extractTextInsets,
  extractTextMetadata,
  normalizeFontFamily,
  normalizeFontSize,
  plainText,
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

  it('extracts inline text metadata over element fallback style', () => {
    const metadata = extractTextMetadata(
      '<p style="text-align:right"><span style="font-size:22pt;font-family:Calibri;color:#abcdef">Hi</span></p>',
      { textAlign: 'left', fontSize: 12, fontFamily: 'Arial', textColor: '#111111' }
    )
    expect(metadata).toMatchObject({
      textAlign: 'right',
      fontSize: 29.3,
      fontFamily: 'Calibri',
      textColor: '#abcdef',
    })
  })

  it('extracts metadata from the longest styled text run', () => {
    const metadata = extractTextMetadata(
      '<span style="font-size:24px;color:red">Hi</span><span style="font-size:14px;color:black">This is the dominant body run.</span>'
    )

    expect(metadata.fontSize).toBe(14)
    expect(metadata.textColor).toBe('black')
  })

  it('treats nested text under the same styled element as one run', () => {
    const metadata = extractTextMetadata(
      '<span style="font-size:24px;color:red">Long <strong>dominant</strong> text</span><span style="font-size:12px;color:black">secondaryyyyy</span>'
    )

    expect(metadata.fontSize).toBe(24)
    expect(metadata.textColor).toBe('red')
  })

  it('does not aggregate a styled parent when visible child text overrides it', () => {
    const metadata = extractTextMetadata(
      '<span style="font-size:24px;color:red"><span style="font-size:12px;color:blue">All visible text lives here and is much longer</span></span>',
      { fontSize: 10, fontFamily: 'Arial', textColor: '#000000', textAlign: 'left' }
    )

    expect(metadata.fontSize).toBe(12)
    expect(metadata.textColor).toBe('blue')
  })

  it('extracts text inset aliases only when at least one is present', () => {
    expect(extractTextInsets({ lIns: 1, insetR: 2, marginTop: 3, bIns: 4 })).toEqual({
      left: 1.3,
      right: 2.7,
      top: 4,
      bottom: 5.3,
    })
    expect(extractTextInsets({})).toBeNull()
  })

  it('converts text insets from pt to scaled canvas px', () => {
    const result = extractTextInsets(
      { insetLeft: 7.2, insetRight: 7.2, insetTop: 3.6, insetBottom: 3.6 },
      { x: 4 / 3, y: 4 / 3 },
      { width: 200, height: 80 }
    )

    expect(result).toEqual({
      left: 12.8,
      right: 12.8,
      top: 6.4,
      bottom: 6.4,
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
