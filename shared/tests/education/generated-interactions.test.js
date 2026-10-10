import { afterEach, describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { createRequire } from 'node:module'
import { generateRevealHTML } from '../../src/htmlGenerator.js'
const require = createRequire(import.meta.url)
const { attachRevealLifecycle } = require('../../src/education/browser/reveal-lifecycle.js')
const { getDocumentVariables } = require('../../src/education/browser/document-variables.js')

const active = []
afterEach(() => {
  for (const entry of active.splice(0)) {
    entry.controller.destroy()
    entry.dom.window.close()
  }
})
const shape = (id, action, extra = {}) => ({
  id,
  type: 'shape',
  x: 20,
  y: 20,
  width: 100,
  height: 80,
  shape: 'rect',
  fill: '#6366f1',
  action,
  ...extra,
})
function open(slides) {
  const dom = new JSDOM(
    generateRevealHTML({
      id: 'deck',
      title: 'Interactions',
      interactionVariables: [{ id: 'blue', name: 'Blue score', initialValue: 2, min: 0, max: 10 }],
      slides,
    }),
    { pretendToBeVisual: true, runScripts: 'outside-only' }
  )
  const { document } = dom.window
  let current = document.querySelector('[data-ns-effective-slide-id]'),
    config = {}
  const listeners = new Map()
  const reveal = {
    getCurrentSlide: () => current,
    getConfig: () => config,
    configure: (next) => {
      config = { ...config, ...next }
    },
    on: (name, handler) => {
      if (!listeners.has(name)) listeners.set(name, new Set())
      listeners.get(name).add(handler)
    },
    off: (name, handler) => listeners.get(name)?.delete(handler),
    navigateFragment: () => {},
    isFocused: () => true,
    initialize: () => {
      queueMicrotask(() => {
        for (const handler of listeners.get('ready') || []) handler()
      })
      return Promise.resolve()
    },
    getSlides: () => [...document.querySelectorAll('[data-ns-effective-slide-id]')],
  }
  const controller = attachRevealLifecycle(document, reveal)
  active.push({ dom, controller })
  const variables = getDocumentVariables(document)
  return {
    dom,
    document,
    variables,
    reveal,
    current: () => current,
    change: (section) => {
      current = section
      for (const handler of listeners.get('slidechanged') || []) handler()
    },
  }
}
function action(section, id) {
  return section.querySelector(`[data-ns-element-for="${id}"]`)
}
function target(section, id) {
  return section.querySelector(`[data-ns-element-id="${id}"]`)
}

describe('generated interaction documents', () => {
  it('loads authored variable bounds, changes score once, and restores scoped visibility on reset', () => {
    const view = open([
      {
        id: 's',
        elements: [
          shape('hidden', null, { initialVisibility: 'hidden' }),
          shape('show', { kind: 'show', targetElementId: 'hidden' }),
          shape('add', { kind: 'score-add', variableId: 'blue', amount: 3 }),
          shape('reset', { kind: 'reset-slide', resetVariables: false }),
          shape('reset-all', { kind: 'reset-slide', resetVariables: true }),
        ],
      },
    ])
    const section = view.current()
    expect(view.variables.read('blue')).toBe(2)
    expect(target(section, 'hidden').hidden).toBe(true)
    action(section, 'show').click()
    expect(target(section, 'hidden').hidden).toBe(false)
    action(section, 'add').click()
    expect(view.variables.read('blue')).toBe(5)
    for (let i = 0; i < 4; i++) action(section, 'add').click()
    expect(view.variables.read('blue')).toBe(10)
    action(section, 'reset').click()
    expect(target(section, 'hidden').hidden).toBe(true)
    expect(view.variables.read('blue')).toBe(10)
    action(section, 'reset-all').click()
    expect(view.variables.read('blue')).toBe(2)
  })

  it('keeps repeated child IDs scoped and blocks a copied unresolved reference despite a collision', () => {
    const elements = [
      shape('answer', null, { initialVisibility: 'hidden' }),
      shape('show', { kind: 'show', targetElementId: 'answer' }),
    ]
    const view = open([
      {
        id: 'parent',
        elements,
        children: [
          {
            id: 'child',
            elements: [
              shape('answer', null, { initialVisibility: 'hidden' }),
              shape('broken', {
                kind: 'show',
                targetElementId: 'answer',
                referenceError: 'Copied target is unavailable. Choose a new target.',
              }),
            ],
          },
        ],
      },
    ])
    const parent = view.current(),
      child = view.document.querySelector('[data-ns-effective-slide-id="child"]')
    action(parent, 'show').click()
    expect(target(parent, 'answer').hidden).toBe(false)
    expect(target(child, 'answer').hidden).toBe(true)
    view.change(child)
    action(child, 'broken').click()
    expect(target(child, 'answer').hidden).toBe(true)
    expect(child.querySelector('[role="alert"]').textContent).toContain('Choose a new target')
  })

  it('does not route interaction actions through the legacy navigation handler or double activate native buttons', async () => {
    const view = open([
      { id: 's', elements: [shape('add', { kind: 'score-add', variableId: 'blue', amount: 3 })] },
    ])
    const window = view.dom.window
    window.Reveal = view.reveal
    for (const name of [
      'RevealNotes',
      'RevealHighlight',
      'RevealMarkdown',
      'RevealSearch',
      'RevealZoom',
    ])
      window[name] = {}
    window.RevealMath = { KaTeX: {} }
    const script = [...view.document.querySelectorAll('script:not([src])')].find((node) =>
      node.textContent.includes('var revealConfig')
    )
    window.eval(script.textContent)
    await Promise.resolve()
    const button = action(view.current(), 'add')
    button.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(view.variables.read('blue')).toBe(2)
    button.click()
    expect(view.variables.read('blue')).toBe(5)
    expect(view.document.querySelector('#ns-action-feedback').textContent).toBe('')
  })
})
