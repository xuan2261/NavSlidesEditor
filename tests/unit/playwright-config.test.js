import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const config = require('../../playwright.config.js')

describe('playwright config testIgnore', () => {
  const chromium = config.projects.find((project) => project.name === 'chromium')

  it('ignores tests/e2e/live.spec.js flat path', () => {
    expect(chromium.testIgnore.test('tests/e2e/live.spec.js')).toBe(true)
  })

  it('ignores nested live specs', () => {
    expect(chromium.testIgnore.test('tests/e2e/live/annotation-sync-and-persistence.spec.js')).toBe(
      true
    )
  })

  it('does not ignore sibling e2e specs', () => {
    expect(chromium.testIgnore.test('tests/e2e/keyboard.spec.js')).toBe(false)
  })

  it('does not ignore visual specs in chromium project', () => {
    expect(chromium.testIgnore.test('tests/e2e/visual/editor-canvas-states.spec.js')).toBe(false)
  })

  it('does not ignore mobile specs in chromium project', () => {
    expect(chromium.testIgnore.test('tests/e2e/mobile/touch-gestures.spec.js')).toBe(false)
  })

  it('routes flat and nested live specs to chromium-live project', () => {
    const live = config.projects.find((project) => project.name === 'chromium-live')

    expect(live.testMatch.test('tests/e2e/live.spec.js')).toBe(true)
    expect(live.testMatch.test('tests/e2e/live/annotation-sync-and-persistence.spec.js')).toBe(
      true
    )
  })
})
