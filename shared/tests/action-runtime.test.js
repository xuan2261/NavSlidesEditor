import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { generateRevealHTML } from '../src/htmlGenerator.js'
import hyperlinkRenderer from '../src/pptx-run-hyperlink-render.js'

function runtime() {
  const presentation = { id: 'deck', title: 'Actions', slides: [{ id: 'parent', elements: [{
    id: 'action', type: 'shape', shape: 'rect', x: 0, y: 0, width: 100, height: 40,
    fill: '#fff', action: { kind: 'slide', slideId: 'child', label: 'Details' },
  }], children: [{ id: 'child', elements: [] }] }] }
  const dom = new JSDOM(generateRevealHTML(presentation, { portable: true }), {
    runScripts: 'outside-only', url: 'http://localhost/',
  })
  const ready = [], destinations = []
  dom.window.Reveal = {
    on: (event, callback) => { if (event === 'ready') ready.push(callback) },
    initialize: () => { for (const callback of ready) callback() },
    slide: (horizontal, vertical) => destinations.push([horizontal, vertical]),
  }
  dom.window.RevealNotes = {}
  dom.window.RevealHighlight = {}
  for (const script of dom.window.document.querySelectorAll('script[data-navslides-runtime="local"]'))
    dom.window.eval(script.textContent)
  return { dom, destinations, presentation }
}

describe('generated action runtime', () => {
  it('activates a generated child-slide link through keyboard Enter', () => {
    const { dom, destinations } = runtime()
    try {
      const node = dom.window.document.querySelector('[data-ns-action]')
      node.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      expect(destinations).toEqual([[0, 1]])
    } finally { dom.window.close() }
  })

  it('deduplicates equivalent hover fragments but activates a differently edited split run', () => {
    const { dom, destinations, presentation } = runtime()
    try {
      const attributes = (slideId) => hyperlinkRenderer.runHyperlinkAttributes({ componentId: 'source-run',
        hyperlinks: { hover: { componentId: 'source-hover', relationshipId: 'rId1', action: { kind: 'slide', slideId } } } }, presentation)
      const owner = dom.window.document.createElement('div')
      owner.setAttribute('data-ns-element-id', 'source-occurrence')
      owner.innerHTML = `<span${attributes('parent')}>first</span><span${attributes('parent')}>fragment</span><span${attributes('child')}>second</span>`
      dom.window.document.body.append(owner)
      const [first, fragment, second] = owner.children
      const enter = (node, relatedTarget) => node.dispatchEvent(new dom.window.MouseEvent('mouseover', {
        bubbles: true, cancelable: true, relatedTarget,
      }))
      enter(first, null)
      enter(fragment, first)
      expect(destinations).toEqual([[0, 0]])
      enter(second, fragment)
      expect(destinations).toEqual([[0, 0], [0, 1]])
    } finally { dom.window.close() }
  })
})
