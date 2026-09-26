import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SlideThumbnailPreview } from './slide-thumbnail-preview'

const text = (id, content, extra = {}) => ({ id, type: 'text', x: 80, y: 60, width: 400, height: 120, content, ...extra })

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('SlideThumbnailPreview', () => {
  it('scales source geometry and inline typography together when the preview resizes', () => {
    let resize
    const disconnect = vi.fn()
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback) { resize = callback }
      observe() {}
      disconnect = disconnect
    })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 240 })
    const { container, unmount } = render(<SlideThumbnailPreview width={1200} height={800} slide={{ elements: [
      text('title', '<p><span style="font-size:32px;font-weight:700">Source title</span></p>', { fontSize: 48, fontFamily: 'Georgia', rotation: 12, opacity: 0.4, zIndex: 7 }),
    ] }} />)
    const host = container.firstChild
    const canvas = host.firstChild
    const title = screen.getByText('Source title')
    const content = title.closest('.slide-text-content')
    expect(host.style.aspectRatio).toBe('1200 / 800')
    expect(canvas.style.width).toBe('1200px')
    expect(canvas.style.height).toBe('800px')
    expect(canvas.style.transform).toBe('scale(0.2)')
    expect(title.style.fontSize).toBe('32px')
    expect(title.style.fontWeight).toBe('700')
    expect(content.style.fontFamily).toBe('Georgia')
    expect(content.style.fontSize).toBe('48px')
    expect(content.parentElement.style.left).toBe('80px')
    expect(content.parentElement.style.width).toBe('400px')
    expect(content.parentElement.style.transform).toBe('rotate(12deg)')
    expect(content.parentElement.style.opacity).toBe('0.4')
    expect(content.parentElement.style.zIndex).toBe('7')
    act(() => resize([{ contentRect: { width: 120 } }]))
    expect(canvas.style.transform).toBe('scale(0.1)')
    expect(title.style.fontSize).toBe('32px')
    unmount()
    expect(disconnect).toHaveBeenCalledOnce()
  })

  it('resolves master geometry, visibility, and token precedence without mutating the slide', () => {
    const slide = {
      layoutId: 'master', background: { type: 'none' }, designTokens: { colors: { text: '#abcdef' } },
      layoutOverrides: { hiddenElementIds: ['hidden-master'], placeholderBindings: { title: 'bound' } },
      elements: [text('bound', 'Bound title', { textColor: 'auto' }), text('hidden', 'Hidden slide text', { hidden: true })],
    }
    const layoutMasters = [{
      id: 'master', name: 'Master', tokens: { colors: { bg: '#101020', text: '#123456' } },
      fixedElements: [text('brand', 'Master brand'), text('hidden-master', 'Hidden master text')],
      placeholders: [{ id: 'title', role: 'title', type: 'text', x: 160, y: 90, width: 600, height: 150 }],
    }]
    const { container } = render(<SlideThumbnailPreview slide={slide} layoutMasters={layoutMasters} designTokens={{ colors: { bg: '#ffffff', accent: '#998877' } }} />)
    expect(container.firstChild.style.backgroundColor).toBe('rgb(16, 16, 32)')
    expect(container.firstChild.style.getPropertyValue('--ns-accent')).toBe('#998877')
    expect(screen.getByText('Master brand')).toBeTruthy()
    const bound = screen.getByText('Bound title')
    expect(bound.style.color).toBe('rgb(171, 205, 239)')
    expect(bound.parentElement.style.left).toBe('160px')
    expect(bound.parentElement.style.width).toBe('600px')
    expect(screen.queryByText('Hidden master text')).toBeNull()
    expect(screen.queryByText('Hidden slide text')).toBeNull()
    expect(slide.elements[0].x).toBe(80)
  })

  it('renders real static table and shape content but never mounts active element runtimes', () => {
    const elements = ['html', 'game', 'video', 'audio', 'chart', 'latex'].map((type) => ({ ...text(type, '<script>throw new Error("active")</script>'), type }))
    elements.push({ id: 'shape', type: 'shape', x: 20, y: 20, width: 120, height: 80, fill: '#ff0000', shape: 'rect' })
    elements.push({ id: 'table', type: 'table', x: 200, y: 20, width: 200, height: 80, data: [['Revenue', '42']] })
    const { container } = render(<SlideThumbnailPreview slide={{ elements }} />)
    expect(container.querySelector('iframe,script,video,audio,canvas,textarea')).toBeNull()
    expect(container.firstChild.hasAttribute('inert')).toBe(true)
    expect(container.firstChild.style.pointerEvents).toBe('none')
    for (const label of ['HTML', 'Game', 'Video', 'Audio', 'Chart', 'LaTeX']) expect(screen.getByText(label)).toBeTruthy()
    expect(container.querySelector('svg rect')?.getAttribute('width')).toBe('120')
    expect(screen.getByText('Revenue').closest('td')).toBeTruthy()
    expect(screen.getByText('42')).toBeTruthy()
  })

  it.each(['text', 'markdown', 'shape'])('keeps safe %s formatting while dropping stylesheet and media markup', (type) => {
    const markup = '<style>body { background: red }</style><link rel="stylesheet" href="https://example.test/evil.css"><audio controls src="https://example.test/a.mp3"></audio><video autoplay src="https://example.test/v.mp4"></video><source src="https://example.test/v.webm"><script>bad()</script><p><strong>Visible</strong> <span style="color:#112233;font-size:18px" onclick="bad()">caption</span> <img src="/assets/preview.png" alt="Preview"></p>'
    const element = type === 'shape'
      ? { id: 'shape', type, x: 0, y: 0, width: 300, height: 100, shape: 'rect', textHtml: markup }
      : { ...text(type, markup), type }
    const { container } = render(<SlideThumbnailPreview slide={{ elements: [element] }} />)
    expect(container.querySelector('style,link,audio,video,source,script,iframe,object,embed')).toBeNull()
    expect(container.querySelector('[onclick],[onload],[srcset]')).toBeNull()
    expect(screen.getByText('Visible').tagName.toLowerCase()).toBe('strong')
    expect(screen.getByText('caption').style.color).toBe('rgb(17, 34, 51)')
    expect(container.querySelector('img[alt="Preview"]')?.getAttribute('src')).toBe('/assets/preview.png')
  })

  it('keeps static SVG vectors and local gradients but drops stylesheets, media and executable SVG nodes', () => {
    const inlineImage = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    const content = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40"><defs><style>body { display:none }</style><linearGradient id="ink"><stop offset="0%" stop-color="#ff0000"/></linearGradient></defs><rect width="60" height="40" fill="url(#ink)" onload="bad()"/><text x="4" y="12">Vector</text><image href="${inlineImage}" width="10" height="10"/><a href="https://example.test"><circle r="5"/></a><foreignObject><video autoplay="autoplay" src="https://example.test/a.mp4"/></foreignObject><script>bad()</script></svg>`
    const { container } = render(<SlideThumbnailPreview slide={{ elements: [{ id: 'svg', type: 'svg', x: 0, y: 0, width: 100, height: 100, content }] }} />)
    expect(container.querySelector('style,link,audio,video,source,script,foreignObject,a')).toBeNull()
    expect(container.querySelector('svg [onload]')).toBeNull()
    expect(container.querySelector('svg linearGradient stop')?.getAttribute('stop-color')).toBe('#ff0000')
    expect(container.querySelector('svg rect')?.getAttribute('fill')).toBe('url(#ink)')
    expect(container.querySelector('svg image')?.getAttribute('href')).toBe(inlineImage)
    expect(screen.getByText('Vector')).toBeTruthy()
  })
})
