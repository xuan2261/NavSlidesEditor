import { createRequire } from 'node:module'
import { describe, expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const {
  sanitizeRichTextHtml,
  sanitizeRichTextStyle,
  sanitizeHref,
  convertCssLengthToPx,
} = require('../src/content-safety.js')

describe('shared rich text content safety', () => {
  test('converts supported absolute CSS lengths to px', () => {
    expect(convertCssLengthToPx('40pt', 'font-size')).toBe('53.3px')
    expect(convertCssLengthToPx('2pt', 'letter-spacing')).toBe('2.7px')
    expect(convertCssLengthToPx('30.87pt', 'line-height')).toBe('41.2px')
    expect(convertCssLengthToPx('1in', 'font-size')).toBe('96px')
    expect(convertCssLengthToPx('2.54cm', 'font-size')).toBe('96px')
    expect(convertCssLengthToPx('25.4mm', 'font-size')).toBe('96px')
  })

  test('leaves unsupported or already-normalized CSS values unchanged', () => {
    expect(convertCssLengthToPx('16px', 'font-size')).toBe('16px')
    expect(convertCssLengthToPx('1.2em', 'font-size')).toBe('1.2em')
    expect(convertCssLengthToPx('inherit', 'font-size')).toBe('inherit')
    expect(convertCssLengthToPx('40pt', 'margin')).toBe('40pt')
  })

  test('sanitizes style declarations with unit conversion', () => {
    expect(sanitizeRichTextStyle('color: red; font-size: 40pt; letter-spacing: 2pt')).toBe(
      'color: red; font-size: 53.3px; letter-spacing: 2.7px'
    )
  })

  test('preserves editor-supported line-height and highlight styles', () => {
    expect(sanitizeRichTextStyle('line-height: 1.5; line-height: 30.87pt; background-color: #fef08a')).toBe(
      'line-height: 1.5; line-height: 41.2px; background-color: #fef08a'
    )
  })

  test('removes unsafe style declarations from rich text html', () => {
    const safe = sanitizeRichTextHtml(
      '<p style="font-size: 18pt; position:absolute; background:url(https://example.test/x.png); color: expression(alert(1))">Hi</p>'
    )

    expect(safe).toContain('font-size: 24px')
    expect(safe).not.toContain('position')
    expect(safe).not.toContain('url(')
    expect(safe).not.toContain('expression')
  })

  test('preserves tel links for server client shared parity', () => {
    expect(sanitizeHref('tel:+1234567890')).toBe('tel:+1234567890')
    expect(sanitizeRichTextHtml('<a href="tel:+1234567890">Call</a>')).toContain(
      'href="tel:+1234567890"'
    )
  })
})
