import { describe, expect, it } from 'vitest'
import textUtils from './utils-text.js'

const {
  buildBaseTextStyle,
  extractTextInsets,
  extractTextMetadata,
  normalizeFontFamily,
  normalizeFontSize,
  plainText,
} = textUtils

describe('pptx mapper text utilities', () => {
  it('normalizes plain text, font size, and font family', () => {
    expect(plainText('<p>Hello <strong>world</strong><script>bad()</script></p>')).toBe('Hello world')
    expect(normalizeFontSize('24pt')).toBe(24)
    expect(normalizeFontSize('0')).toBeUndefined()
    expect(normalizeFontFamily('"Aptos", sans-serif')).toBe('Aptos')
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
      fontSize: 22,
      fontFamily: 'Calibri',
      textColor: '#abcdef',
    })
  })

  it('extracts text inset aliases only when at least one is present', () => {
    expect(extractTextInsets({ lIns: 1, insetR: 2, marginTop: 3, bIns: 4 })).toEqual({
      left: 1,
      right: 2,
      top: 3,
      bottom: 4,
    })
    expect(extractTextInsets({})).toBeNull()
  })
})
