import { createRequire } from 'node:module'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { generateRevealHTML } from '../src/htmlGenerator.js'
import {
  BASELINE_REVEAL_VERSION,
  buildEditorContractPresentation,
  buildGeneratedHtmlContractFixtures,
} from './fixtures/editor-contract-fixtures.js'

const require = createRequire(import.meta.url)
const revealEntry = require.resolve('reveal.js', { paths: [path.resolve('server')] })
const installedRevealVersion = require(
  path.resolve(revealEntry, '..', '..', 'package.json')
).version

describe('generated HTML contract fixture', () => {
  it('pins the baseline runtime receipt and cross-surface presentation features', () => {
    const presentation = buildEditorContractPresentation()
    const html = generateRevealHTML(presentation)

    expect(installedRevealVersion).toBe(BASELINE_REVEAL_VERSION)
    expect(presentation.fixtureReceipt.revealVersion).toBe(BASELINE_REVEAL_VERSION)
    expect(html).toContain('<section>\n    <section')
    expect(html).toContain('<aside class="notes">Parent contract notes</aside>')
    expect(html).toContain('<aside class="notes">Child contract notes</aside>')
    expect(html).toMatch(/class="[^"]*fragment[^"]*"/)
    expect(html).toContain('/vendor/highlight.js/styles/monokai.min.css')
    expect(html).toContain('/vendor/reveal.js/dist/plugin/notes.js')
    expect(html).toContain('/vendor/reveal.js/dist/plugin/highlight.js')
    expect(html).not.toContain('/vendor/reveal.js/plugin/')
    expect(html).toContain('/vendor/reveal-plugins/menu/menu.js')
    expect(html).toContain('/vendor/reveal-plugins/chalkboard/plugin.js')
    expect(html).toContain(
      'plugins: [ RevealNotes, RevealHighlight, RevealMenu, RevealChalkboard, RevealCustomControls ]'
    )
    expect(html.match(/Reveal\.initialize\(/g)).toHaveLength(1)
    expect(html.match(/plugins:\s*\[/g)).toHaveLength(1)
  })

  it('exposes reusable fixture dimensions for every legacy generated surface', () => {
    const fixtures = buildGeneratedHtmlContractFixtures()
    expect(fixtures.receipt.revealVersion).toBe(BASELINE_REVEAL_VERSION)
    expect(fixtures.horizontal.slides[0].children).toHaveLength(1)
    expect(fixtures.vertical.id).toBe('contract-slide-child')
    expect(fixtures.fragments).toHaveLength(1)
    expect(fixtures.notes).toEqual({ parent: 'Parent contract notes', child: 'Child contract notes' })
    expect(fixtures.highlight.code.language).toBe('javascript')
    expect(fixtures.themes).toEqual({ theme: 'dracula', codeTheme: 'monokai' })
    expect(fixtures.presenterTools).toMatchObject({ slideMenu: true, chalkboard: true })
    expect(fixtures.iframePreview.preview).toBe(true)
    expect(fixtures.optionalPlugins).toEqual(['menu', 'chalkboard', 'custom-controls'])
  })
 })
