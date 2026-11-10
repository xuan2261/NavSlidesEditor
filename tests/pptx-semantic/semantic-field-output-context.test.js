// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import CanvasSemanticInstanceTree from '../../client/src/components/canvas/canvas-semantic-instance-tree.jsx'
import CanvasElement from '../../client/src/components/canvas/canvas-element-wrapper.jsx'
import { createRequire } from 'node:module'
import { fieldFixture, fieldPresentation, nativeFields } from './field-fixtures.js'
import { generateRevealHTML, generatePrintHTML } from '../../shared/src/htmlGenerator.js'
import { semanticRenderTree } from '../../shared/src/pptx-semantic-render-tree.js'
const require = createRequire(import.meta.url)
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector.js')
const fields = nativeFields + '<a:fld id="title" type="slidetitle"><a:t>Cached title</a:t></a:fld>' +
  '<a:fld id="date" type="datetime5"><a:t>Cached date</a:t></a:fld>' +
  '<a:fld id="custom" type="vendor.custom"><a:t>Custom cache</a:t></a:fld>'
const options = { autoPrint: false, pptxFieldContext: { date: new Date('2026-10-20T13:14:15Z'), timeZone: 'UTC', locale: 'en-US' } }
const parse = (html) => new DOMParser().parseFromString(html, 'text/html')
const texts = (root, type) => [...root.querySelectorAll(`[data-pptx-field-type="${type}"]`)].map((node) => node.textContent)
async function fixture() {
  const deck = (await projectSemanticImport({ zip: fieldFixture(fields), presentation: fieldPresentation() })).presentation
  deck.slides[0].title = 'Vertical title'
  deck.slides[1].title = 'Final title'
  deck.slides[0].showPageNumber = false
  deck.slides[0].elements.push({ id: 'fragment', type: 'text', content: '<p>Step</p>', fragment: true, fragmentIndex: 1 })
  deck.slides = [{ id: 'intro', title: 'Intro', elements: [], children: [deck.slides[0]] }, deck.slides[1]]
  deck.showPageNumbers = false
  return deck
}
afterEach(cleanup)
describe('semantic field context across HTML Present Print and vertical navigation', () => {
  it('uses global slide order independent of footer visibility and preserves native caches', async () => {
    const deck = await fixture(), before = structuredClone(deck)
    const dom = parse(generateRevealHTML(deck, options))
    const vertical = dom.querySelector('section[data-ns-effective-slide-id="first"]')
    const final = dom.querySelector('section[data-ns-effective-slide-id="second"]')
    expect(texts(vertical, 'slidenum')).toEqual(['2', '2'])
    expect(texts(final, 'slidenum')).toEqual(['3', '3'])
    expect(texts(vertical, 'slidetitle')).toEqual(['Vertical title'])
    expect(texts(final, 'slidetitle')).toEqual(['Final title'])
    expect(texts(vertical, 'datetime5')).toEqual(['2026-10-20'])
    expect(texts(vertical, 'vendor.custom')).toEqual(['Custom cache'])
    const tree = semanticRenderTree(deck.pptxSemantic, deck.slides[0].children[0], { ...options.pptxFieldContext, slideNumber: 2, slideTitle: 'Vertical title' })
    expect(JSON.stringify(tree)).toContain('2026-10-20')
    expect(deck).toEqual(before)
  })
  it('paints the same evaluated native fields on the actual non-editing canvas text renderer', async () => {
    const deck = await fixture(), before = structuredClone(deck)
    const slide = deck.slides[0].children[0]
    const { container } = render(createElement(CanvasSemanticInstanceTree, {
      document: deck.pptxSemantic, slide, preview: {},
      fieldContext: { ...options.pptxFieldContext, slideNumber: 2, slideTitle: slide.title },
      renderElement: (element) => createElement(CanvasElement, { element, isEditing: false, isSelected: false, iconPaths: {} }),
    }))
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(texts(container, 'slidenum')).toEqual(['2', '2'])
    expect(texts(container, 'slidetitle')).toEqual(['Vertical title'])
    expect(texts(container, 'datetime5')).toEqual(['2026-10-20'])
    expect(deck).toEqual(before)
  })
  it('counts vertical sections once, rather than fragment print pages, in visible print page totals', async () => {
    const deck = await fixture()
    deck.showPageNumbers = true
    deck.slides[0].children[0].showPageNumber = true
    const pages = [...parse(generatePrintHTML(deck, { ...options, fragmentMode: 'expanded' })).querySelectorAll('.slide-page')]
    expect(pages.map((page) => page.lastElementChild.textContent)).toEqual(['1 / 3', '2 / 3', '2 / 3', '3 / 3'])
  })
  it.each(['final', 'expanded'])('prints children in global order and retains the same field number across fragments (%s)', async (fragmentMode) => {
    const deck = await fixture(), before = structuredClone(deck)
    const pages = [...parse(generatePrintHTML(deck, { ...options, fragmentMode })).querySelectorAll('.slide-page')]
    expect(pages).toHaveLength(fragmentMode === 'final' ? 3 : 4)
    expect(texts(pages[1], 'slidenum')).toEqual(['2', '2'])
    if (fragmentMode === 'expanded') expect(texts(pages[2], 'slidenum')).toEqual(['2', '2'])
    expect(texts(pages.at(-1), 'slidenum')).toEqual(['3', '3'])
    expect(texts(pages[1], 'slidetitle')).toEqual(['Vertical title'])
    expect(texts(pages[1], 'datetime5')).toEqual(['2026-10-20'])
    expect(deck).toEqual(before)
  })
})
