import { beforeAll, describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'
import { familyDocumentsFixture } from './family-documents-fixture'
const require = createRequire(import.meta.url)
const { generateRevealHTML, generatePrintHTML } = require('../../shared/src/htmlGenerator')
let fixtures
beforeAll(async () => {
  fixtures = await familyDocumentsFixture()
})
describe('canonical generated output dispatch', () => {
  it.each(['table', 'chart', 'diagram', 'equation'])(
    'mounts %s from canonical authority, never poisoned compatibility',
    (kind) => {
      const semantic = structuredClone(fixtures[kind])
      Object.values(semantic.definitions)[0].content.extent = { cx: 914400, cy: 1828800 }
      const presentation = {
        pptxSemantic: semantic,
        slides: [
          {
            id: 's1',
            elements: [
              {
                id: 'el',
                pptxInstanceId: 'occurrence',
                type: kind === 'equation' ? 'latex' : kind,
                width: 999,
                height: 999,
                data: [['POISON']],
                content: 'POISON',
                chartData: 'POISON',
                tableDocument: {},
                smartArtDocument: {},
                ommlDocument: {},
                fragment: true,
                fragmentIndex: 1,
              },
            ],
          },
        ],
      }
      const before = JSON.stringify(presentation)
      for (const generate of [generateRevealHTML, generatePrintHTML]) {
        const html = generate(presentation, { portable: true })
        expect(html).toContain('data-pptx-semantic-mount="occurrence"')
        expect(html).toContain('data-pptx-semantic-slide="s1"')
        expect(html).toContain('width:96px;height:192px')
        expect(html).toContain('data-navslides-semantic-payload')
        expect(html).not.toContain('POISON')
        const output = new JSDOM(html)
        expect(output.window.document.querySelector('[data-chart-config]')).toBeNull()
        expect(output.window.document.querySelector('[data-math-latex]')).toBeNull()
        output.window.close()
      }
      expect(generatePrintHTML(presentation).match(/data-pptx-semantic-mount=/g)).toHaveLength(2)
      expect(JSON.stringify(presentation)).toBe(before)
    }
  )
  it('keeps legacy output without semantic payloads', () => {
    const html = generateRevealHTML({
      slides: [{ elements: [{ type: 'table', data: [['legacy']] }] }],
    })
    expect(html).toContain('legacy')
    expect(html).not.toContain('data-navslides-semantic-payload')
  })
})
