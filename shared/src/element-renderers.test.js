import { describe, expect, it } from 'vitest'
import renderers from './element-renderers.js'
import { JSDOM } from 'jsdom'

const { renderElement } = renderers
const { DOMParser } = new JSDOM('').window

function textElement(overrides = {}) {
  return {
    id: 'text-1',
    type: 'text',
    x: 0,
    y: 0,
    width: 200,
    height: 80,
    zIndex: 1,
    content: '<p>Hello</p>',
    fontSize: 24,
    ...overrides,
  }
}

describe('shared text element rendering', () => {
  it('renders imported PowerPoint text insets in canvas pixels', () => {
    const html = renderElement(
      textElement({
        _pptxImportMeta: {
          fitFontSizePx: 24,
          textInsetsUnit: 'px',
          textInsets: { left: 7.2, right: 7.2, top: 3.6, bottom: 3.6 },
        },
      }),
      {}
    )

    expect(html).toContain('padding:3.6px 7.2px 3.6px 7.2px;')
  })

  it('keeps editor-created text padding unchanged', () => {
    const html = renderElement(textElement(), {})

    expect(html).toContain('padding:8px 12px;')
  })
  it('allows no-autofit imported text to overflow its PowerPoint box', () => {
    const html = renderElement(
      textElement({
        _pptxImportMeta: { textFit: 'wrap', version: 1 },
      }),
      {}
    )

    expect(html).toContain('overflow:visible;')
    expect(html).not.toContain('overflow:hidden;')
  })
})

describe('shared media accessibility rendering', () => {
  it('renders decorative images silently and associates non-decorative long descriptions', () => {
    const decorative = renderElement(
      {
        id: 'image-1',
        type: 'image',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        decorative: true,
        alt: 'ignored',
        src: '/uploads/a.png',
      },
      {}
    )
    const descriptive = renderElement(
      {
        id: 'image-2',
        type: 'image',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        alt: 'Chart',
        longDescription: 'Detailed chart',
        src: '/uploads/a.png',
      },
      {}
    )
    expect(decorative).toContain('alt=""')
    expect(descriptive).toContain('aria-describedby="image-description-')
    expect(descriptive).toContain('Detailed chart')
  })

  it('renders safe normalized media tracks and transcript metadata', () => {
    const html = renderElement(
      {
        id: 'video-1',
        type: 'video',
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        src: '/uploads/a.mp4',
        tracks: [
          { src: '/uploads/a.vtt', srcLang: 'en', label: 'English', default: true },
          { src: 'javascript:bad' },
        ],
        transcript: 'Transcript',
      },
      {}
    )
    const document = new DOMParser().parseFromString(html, 'text/html')
    const track = document.querySelector('track')
    expect(track.getAttribute('src')).toBe('http://localhost:3000/uploads/a.vtt')
    expect(track.getAttribute('kind')).toBe('captions')
    expect(track.getAttribute('srclang')).toBe('en')
    expect(track.hasAttribute('default')).toBe(true)
    expect(document.querySelectorAll('track')).toHaveLength(1)
    expect(document.querySelector('video').querySelector('script')).toBeNull()
  })
})

describe('Reveal Mermaid rendering', () => {
  it('keeps local Mermaid assets resolvable in an embedded presentation', () => {
    const html = renderElement(
      {
        id: 'diagram-1',
        type: 'html',
        embedKind: 'mermaid',
        mermaidSource: 'graph TD; A-->B',
        x: 0,
        y: 0,
        width: 400,
        height: 200,
      },
      {}
    )

    expect(html).toContain('srcdoc="')
    expect(html).toContain('/vendor/mermaid/mermaid.min.js')
    expect(html).not.toContain('src="data:text/html')
  })
})
