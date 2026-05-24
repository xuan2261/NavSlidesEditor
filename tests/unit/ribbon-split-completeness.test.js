import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'

describe('ribbon-layout split by concern', () => {
  const expected = [
    'icon-text-button-clipping',
    'insert-tab-critical-controls-visibility',
    'classic-ribbon-group-contract',
    'home-tab-text-editing-state',
    'format-tab-vertical-rhythm',
    'all-tabs-overflow-matrix',
    'responsive-pressure-points',
    'header-responsive-pressure',
  ]

  for (const slug of expected) {
    it(`tests/e2e/ribbon/${slug}.spec.js exists`, () => {
      expect(existsSync(`tests/e2e/ribbon/${slug}.spec.js`)).toBe(true)
    })
  }

  it('old monolithic ribbon-layout.spec.js is removed', () => {
    expect(existsSync('tests/e2e/ribbon-layout.spec.js')).toBe(false)
  })

  it('does not invent a file tab spec', () => {
    expect(existsSync('tests/e2e/ribbon/file-tab.spec.js')).toBe(false)
  })
})
