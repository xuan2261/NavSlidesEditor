import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const config = require('../../playwright.config.js')
const isIgnored = (project, file) => {
  const ignore = project.testIgnore
  return Array.isArray(ignore) ? ignore.some((pattern) => pattern.test(file)) : ignore.test(file)
}

describe('playwright config testIgnore', () => {
  const chromium = config.projects.find((project) => project.name === 'chromium')

  it('ignores tests/e2e/live.spec.js flat path', () => {
    expect(isIgnored(chromium, 'tests/e2e/live.spec.js')).toBe(true)
  })

  it('ignores nested live specs', () => {
    expect(isIgnored(chromium, 'tests/e2e/live/annotation-sync-and-persistence.spec.js')).toBe(true)
  })

  it('does not ignore sibling e2e specs', () => {
    expect(isIgnored(chromium, 'tests/e2e/keyboard.spec.js')).toBe(false)
  })

  it('keeps visual specs isolated to the dedicated visual CI lane', () => {
    expect(isIgnored(chromium, 'tests/e2e/visual/editor-canvas-states.spec.js')).toBe(true)
    expect(isIgnored(chromium, 'tests/e2e/visual-regression.spec.js')).toBe(true)
  })

  it('does not ignore mobile specs in chromium project', () => {
    expect(isIgnored(chromium, 'tests/e2e/mobile/touch-gestures.spec.js')).toBe(false)
  })

  it('routes flat and nested live specs to chromium-live project', () => {
    const live = config.projects.find((project) => project.name === 'chromium-live')

    expect(live.testMatch.test('tests/e2e/live.spec.js')).toBe(true)
    expect(live.testMatch.test('tests/e2e/live/annotation-sync-and-persistence.spec.js')).toBe(true)
  })

  it('routes visual specs to the dedicated chromium-visual project', () => {
    const visual = config.projects.find((project) => project.name === 'chromium-visual')

    expect(
      visual.testMatch.some((pattern) =>
        pattern.test('tests/e2e/visual/editor-canvas-states.spec.js')
      )
    ).toBe(true)
    expect(
      visual.testMatch.some((pattern) => pattern.test('tests/e2e/visual-regression.spec.js'))
    ).toBe(true)
  })

  it('routes all PPTX imports through one serialized project', () => {
    const pptxImport = config.projects.find((project) => project.name === 'chromium-pptx-import')
    const visual = config.projects.find((project) => project.name === 'chromium-visual')
    const importSpecs = [
      'tests/e2e/critical-pptx-journey.spec.js',
      'tests/e2e/pptx-import-async.spec.js',
      'tests/e2e/pptx-import-fidelity.spec.js',
      'tests/e2e/pptx-import-real-browser-audit.spec.js',
      'tests/e2e/pptx-import-editor-visual-regression.spec.js',
      'tests/e2e/export/pptx-import-endpoint-roundtrip-across-multiple-fixtures.spec.js',
    ]

    expect(pptxImport.workers).toBe(1)
    expect(pptxImport.snapshotPathTemplate).toBe(visual.snapshotPathTemplate)
    for (const spec of importSpecs) {
      expect(pptxImport.testMatch.some((pattern) => pattern.test(spec))).toBe(true)
      expect(isIgnored(chromium, spec)).toBe(true)
    }
  })

  it('constrains mobile-chromium to the mobile/touch suite when enabled', async () => {
    process.env.PLAYWRIGHT_MOBILE_CHROMIUM = '1'
    delete require.cache[require.resolve('../../playwright.config.js')]
    const mobileConfig = require('../../playwright.config.js')
    delete process.env.PLAYWRIGHT_MOBILE_CHROMIUM

    const mobile = mobileConfig.projects.find((project) => project.name === 'mobile-chromium')
    expect(
      mobile.testMatch.test(
        'tests/e2e/a11y/touch-gestures-tap-double-tap-and-swipe-on-tablet-viewport.spec.js'
      )
    ).toBe(true)
    expect(
      mobile.testMatch.test(
        'tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js'
      )
    ).toBe(false)
  })

  it('publishes the isolated API endpoint to test workers', () => {
    expect(process.env.PLAYWRIGHT_API_BASE_URL).toBe(config.webServer.env.PLAYWRIGHT_API_BASE_URL)
    expect(process.env.PLAYWRIGHT_API_BASE_URL).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/api$/)
  })
})
