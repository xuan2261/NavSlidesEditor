// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import SlidePanel from '../../client/src/components/SlidePanel'
import { SlideThumbnailPreview, deriveNavigatorContext, deriveNavigatorView } from '../../client/src/components/slide-panel/slide-thumbnail-preview'
import projectionCache from 'revealjs-shared/src/pptx-slide-projection-cache.js'
import { semanticElement } from '../../client/src/utils/pptx-semantic-geometry-bridge'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const semantic = require('../../shared/src/pptx-semantic-document.js')
const records = require('../../shared/src/pptx-semantic-records.js')
import { geometryProjectionFixture } from './geometry-projection-fixture.js'

vi.mock('../../client/src/utils/pptx-semantic-geometry-bridge', async (original) => {
  const actual = await original()
  return { ...actual, semanticElement: vi.fn(actual.semanticElement) }
})
const renders = vi.hoisted(() => new Map())
vi.mock('../../client/src/components/slide-panel/slide-thumbnail-preview', async (original) => {
  const actual = await original()
  return { ...actual, SlideThumbnailPreview: (props) => {
    const id = props.slide.id
    renders.set(id, (renders.get(id) || 0) + 1)
    return <actual.SlideThumbnailPreview {...props} />
  } }
})
afterEach(() => { cleanup(); renders.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('reuses the owned admission and bypasses tree derivation only for an unaffected certified patch', () => {
  const deck = geometryProjectionFixture()
  const tree = require('../../shared/src/pptx-semantic-render-tree.js')
  const input = semantic.normalizePptxSemanticDocument(deck.pptxSemantic)
  const options = { pptxSemantic: input, resolution: { width: 960, height: 540 },
    designTokens: { colors: { bg: 'red' } }, layoutMasters: [] }
  const first = deriveNavigatorView(deck.slides[0], options)
  const spy = vi.spyOn(tree, 'immutableSemanticRenderTree')
  options.pptxSemantic = records.replaceSemanticRecords(input, { instances: {
    i2: { ...input.instances.i2, paintIndex: 12 },
  } })
  expect(deriveNavigatorView(deck.slides[0], options, first)).toBe(first)
  expect(spy).not.toHaveBeenCalled()
  options.resolution.width = 1000
  const resized = deriveNavigatorView(deck.slides[0], options, first)
  expect(resized).not.toBe(first)
  expect(resized.resolution.width).toBe(1000)
  options.designTokens.colors.bg = 'blue'
  const recolored = deriveNavigatorView(deck.slides[0], options, resized)
  expect(recolored).not.toBe(resized)
  options.layoutMasters.push({ id: 'unused', custom: 'changed' })
  expect(deriveNavigatorView(deck.slides[0], options, recolored)).not.toBe(recolored)
  deck.slides[0].elements[0].hidden = true
  expect(deriveNavigatorView(deck.slides[0], options, recolored).effectiveSlide.elements[0].hidden).toBe(true)
})

it('admits shared context once for all parent/child views and observes deep in-place edits', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 240 })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const snapshot = vi.spyOn(projectionCache, 'ownedSlideSnapshot')
  const master = { id: 'master', name: 'Master', placeholders: [], fixedElements: [
    { id: 'fixed', type: 'text', x: 0, y: 0, width: 100, height: 30, content: 'before' },
  ] }
  const child = { id: 'child', layoutId: 'master', elements: [] }
  const props = { slides: [{ id: 'parent', layoutId: 'master', elements: [], children: [child] },
    { id: 'other', layoutId: 'master', elements: [] }], currentIndex: 0,
    resolution: { width: 960, height: 540 }, designTokens: { colors: { bg: 'red' } },
    layoutMasters: [master] }
  const { container, rerender } = render(<SlidePanel {...props} />)
  const contextCalls = () => snapshot.mock.calls.filter(([value]) =>
    value && Object.hasOwn(value, 'layoutMasters') && !Object.hasOwn(value, 'slide'))
  expect(contextCalls()).toHaveLength(1)
  expect(container.textContent.match(/before/g)).toHaveLength(3)
  let before = new Map(renders)
  props.designTokens.colors.bg = 'blue'
  snapshot.mockClear()
  rerender(<SlidePanel {...props} />)
  expect(contextCalls()).toHaveLength(1)
  for (const id of ['parent', 'child', 'other']) expect(renders.get(id)).toBe(before.get(id) + 1)
  expect(container.querySelector('.pointer-events-none').style.backgroundColor).toBe('blue')
  before = new Map(renders)
  props.resolution.width = 1000
  rerender(<SlidePanel {...props} />)
  for (const id of ['parent', 'child', 'other']) expect(renders.get(id)).toBe(before.get(id) + 1)
  expect(container.querySelector('.pointer-events-none').style.aspectRatio).toBe('1000 / 540')
  before = new Map(renders)
  master.fixedElements[0].content = 'after'
  rerender(<SlidePanel {...props} />)
  for (const id of ['parent', 'child', 'other']) expect(renders.get(id)).toBe(before.get(id) + 1)
  expect(container.textContent.match(/after/g)).toHaveLength(3)
  expect(container.textContent).not.toContain('before')
  props.slides[0].locked = true
  props.slides[0].autoAnimate = true
  props.slides[0].section = 'Updated section'
  rerender(<SlidePanel {...props} />)
  expect(container.textContent).toContain('Updated section')
  expect(container.querySelector('.lucide-lock')).not.toBeNull()
  expect(container.querySelector('.lucide-wand-sparkles, .lucide-wand-2')).not.toBeNull()
})

it('compares owned context without invoking getters and never reuses failed admission', () => {
  const options = { resolution: { width: 960 }, designTokens: { colors: { bg: 'red' } }, layoutMasters: [] }
  const get = vi.fn(() => { throw new Error('live read') })
  const proxy = new Proxy(options, { get })
  const first = deriveNavigatorContext(proxy)
  expect(first.resolution.width).toBe(960)
  expect(deriveNavigatorContext(proxy, first)).toBe(first)
  expect(get).not.toHaveBeenCalled()
  options.designTokens.colors.bg = 'blue'
  expect(deriveNavigatorContext(proxy, first)).not.toBe(first)
  Object.defineProperty(options.designTokens, 'exotic', { enumerable: true, get: () => 'legacy' })
  expect(deriveNavigatorContext(proxy, first)).toBeNull()
  const slide = { id: 'slide', elements: [] }
  const fallback = deriveNavigatorView(slide, options, undefined, null)
  expect(fallback.context).toBeNull()
  expect(fallback.designTokens.exotic).toBe('legacy')
  expect(deriveNavigatorView(slide, options, fallback, null)).not.toBe(fallback)
  const cyclic = { ...options, designTokens: {} }
  cyclic.designTokens.self = cyclic.designTokens
  expect(deriveNavigatorContext(cyclic)).toBeNull()
  expect(() => deriveNavigatorView(slide, cyclic, fallback, null)).toThrow()
})

it('retains effective layout only for unchanged owned slide and context', () => {
  const slide = { id: 'slide', layoutId: 'missing', elements: [], locked: false }
  const options = { resolution: { width: 960 }, layoutMasters: [] }
  const context = deriveNavigatorContext(options)
  const first = deriveNavigatorView(slide, options, undefined, context)
  const next = deriveNavigatorView(slide, options, first, deriveNavigatorContext(options, context))
  expect(next).toBe(first)
  expect(next.effectiveSlide).toBe(first.effectiveSlide)
  slide.locked = true
  const changed = deriveNavigatorView(slide, options, first, context)
  expect(changed.effectiveSlide).not.toBe(first.effectiveSlide)
  expect(changed.slide.locked).toBe(true)
  options.resolution.width = 1000
  const resized = deriveNavigatorView(slide, options, changed, deriveNavigatorContext(options, context))
  expect(resized.effectiveSlide).not.toBe(changed.effectiveSlide)
})

it('renders the descriptor-owned navigator slide rather than a proxy get view', () => {
  const deck = geometryProjectionFixture()
  const get = vi.fn(() => { throw new Error('Live proxy read') })
  const slide = new Proxy(deck.slides[0], { get })
  const options = { pptxSemantic: semantic.normalizePptxSemanticDocument(deck.pptxSemantic) }
  const first = deriveNavigatorView(slide, options)
  expect(first.slide.id).toBe('s1')
  expect(first.effectiveSlide.elements).toEqual(deck.slides[0].elements)
  expect(get).not.toHaveBeenCalled()
  expect(deriveNavigatorView(slide, options, first)).toBe(first)
  deck.slides[0].elements[0].hidden = true
  expect(deriveNavigatorView(slide, options, first)).not.toBe(first)
  expect(get).not.toHaveBeenCalled()
})

it.each([false, true])('navigator rerenders only affected output (raw mutable: %s)', raw => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 240 })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const deck = geometryProjectionFixture()
  const props = { slides: deck.slides, currentIndex: 0, onSelect: vi.fn(), onAdd: vi.fn(),
    onDelete: vi.fn(), onDuplicate: vi.fn(), onMove: vi.fn(),
    pptxSemantic: raw ? deck.pptxSemantic : semantic.normalizePptxSemanticDocument(deck.pptxSemantic) }
  const { container, rerender } = render(<SlidePanel {...props} />)
  const transforms = () => [...container.querySelectorAll('[data-thumbnail-instance-id]')].map(node => node.style.transform)
  expect(transforms()).toEqual(['matrix(-1,0,0,1,100,0)', 'matrix(-1,0,0,1,100,0)'])
  const before = new Map(renders)
  if (raw) props.pptxSemantic.instances.i1.localTransform[4] = 1905000
  else props.pptxSemantic = records.replaceSemanticRecords(props.pptxSemantic, { instances: {
    i1: { ...props.pptxSemantic.instances.i1, localTransform: [-1, 0, 0, 1, 1905000, 0] },
  } })
  rerender(<SlidePanel {...props} />)
  expect(transforms()).toEqual(['matrix(-1,0,0,1,200,0)', 'matrix(-1,0,0,1,100,0)'])
  expect(renders.get('s1')).toBe(before.get('s1') + 1)
  expect(renders.get('s2')).toBe(before.get('s2'))
  props.slides[1].elements[0].hidden = true
  rerender(<SlidePanel {...props} />)
  expect(transforms()).toEqual(['matrix(-1,0,0,1,200,0)'])
  expect(renders.get('s2')).toBe(before.get('s2') + 1)
})

it('skips derived projection and DOM work on unrelated edits but observes slide and raw mutations', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 240 })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  const deck = geometryProjectionFixture()
  const slide = deck.slides[0]
  const input = semantic.normalizePptxSemanticDocument(deck.pptxSemantic)
  const preview = (document) => <SlideThumbnailPreview slide={slide} pptxSemantic={document} width={960} height={540} />
  const { container, rerender } = render(preview(input))
  const calls = semanticElement.mock.calls.length
  expect(calls).toBeGreaterThan(0)
  const observer = new MutationObserver(() => {})
  observer.observe(container, { attributes: true, childList: true, subtree: true, characterData: true })
  const next = records.replaceSemanticRecords(input, { instances: {
    i2: { ...input.instances.i2, paintIndex: 12 },
  } })
  rerender(preview(next))
  expect(semanticElement.mock.calls.length).toBe(calls)
  expect(observer.takeRecords()).toEqual([])
  observer.disconnect()
  slide.elements[0].hidden = true
  rerender(preview(next))
  expect(container.querySelector('[data-thumbnail-instance-id]')).toBeNull()
  slide.elements[0].hidden = false
  rerender(preview(deck.pptxSemantic))
  deck.pptxSemantic.instances.i1.localTransform[4] = 1905000
  rerender(preview(deck.pptxSemantic))
  expect(container.querySelector('[data-thumbnail-instance-id]').style.transform).toContain('200,0)')
  deck.pptxSemantic.instances.i1.localTransform[4] = NaN
  rerender(preview(deck.pptxSemantic))
  expect(container.querySelector('[data-thumbnail-error]')).not.toBeNull()
})
