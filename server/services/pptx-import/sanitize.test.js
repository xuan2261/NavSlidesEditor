import { createRequire } from 'node:module'
import { describe, expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const { sanitizeHtml, sanitizeStyle } = require('./sanitize')

describe('sanitizeStyle CSS length unit conversion', () => {
  test('converts font-size pt to px at 4/3 ratio', () => {
    expect(sanitizeStyle('font-size: 40pt')).toBe('font-size: 53.3px')
  })

  test('converts letter-spacing pt to px', () => {
    expect(sanitizeStyle('letter-spacing: 2pt')).toBe('letter-spacing: 2.7px')
  })

  test('keeps already-normalized font sizes unchanged', () => {
    expect(sanitizeStyle('font-size: 16px')).toBe('font-size: 16px')
  })

  test('keeps non-numeric font-size keywords unchanged', () => {
    expect(sanitizeStyle('font-size: inherit')).toBe('font-size: inherit')
    expect(sanitizeStyle('font-size: smaller')).toBe('font-size: smaller')
  })

  test('preserves declaration order and converts only length-bearing props', () => {
    expect(sanitizeStyle('color: red; font-size: 40pt; font-weight: bold')).toBe(
      'color: red; font-size: 53.3px; font-weight: bold'
    )
  })

  test('converts defensive cm mm and in lengths to px', () => {
    expect(sanitizeStyle('font-size: 1in')).toBe('font-size: 96px')
    expect(sanitizeStyle('font-size: 2.54cm')).toBe('font-size: 96px')
    expect(sanitizeStyle('font-size: 25.4mm')).toBe('font-size: 96px')
  })

  test('removes unsafe style declarations', () => {
    expect(
      sanitizeStyle(
        'font-size: 18pt; background: url(https://example.test/x.png); position: absolute; color: expression(alert(1))'
      )
    ).toBe('font-size: 24px')
  })

  test('preserves editor-supported line-height and highlight declarations', () => {
    expect(sanitizeStyle('line-height: 1.5; background-color: #fef08a; font-size: 16px')).toBe(
      'line-height: 1.5; background-color: #fef08a; font-size: 16px'
    )
  })
})

describe('sanitizeHtml CSS length unit conversion', () => {
  test('converts inline pt style in final HTML', () => {
    const out = sanitizeHtml('<span style="font-size: 40pt;font-weight: bold;">Hi</span>')
    expect(out).toMatch(/font-size:\s*53\.3px/)
    expect(out).not.toMatch(/40pt/)
  })
})
