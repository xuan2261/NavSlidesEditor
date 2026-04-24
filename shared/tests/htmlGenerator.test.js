import { describe, it, expect } from 'vitest'
import { generatePrintHTML, generateRevealHTML, getBackgroundAttrs } from '../src/htmlGenerator.js'

describe('htmlGenerator', () => {
  it('should generate a basic HTML presentation structure', () => {
    const presentation = {
      title: 'Test Presentation',
      theme: 'dracula',
      slides: [
        {
          id: 'slide-1',
          elements: [
            { type: 'text', content: 'Hello World', x: 100, y: 100, width: 200, height: 50 },
          ],
        },
      ],
    }

    const html = generateRevealHTML(presentation)
    expect(html).toContain('<title>Test Presentation</title>')
    expect(html).toContain('dracula.css')
    expect(html).toContain('Hello World')
  })

  it('should correctly format background attributes', () => {
    expect(getBackgroundAttrs({ type: 'color', color: '#ff0000' })).toBe(
      ' data-background-color="#ff0000"'
    )
    expect(getBackgroundAttrs({ type: 'image', image: 'test.png' })).toContain(
      'data-background-image="test.png"'
    )
    expect(
      getBackgroundAttrs({ type: 'gradient', gradient: 'linear-gradient(to right, red, blue)' })
    ).toContain('data-background-gradient="linear-gradient(to right, red, blue)"')
  })

  it('should not contain the old hardcoded fs-btn in body, but inject it in presenter-toolbar', () => {
    const presentation = { title: 'Test', slides: [] }
    const html = generateRevealHTML(presentation)

    // It should no longer be a direct child in body before script tags
    expect(html).not.toMatch(
      /<\/div>\s*<button id="fs-btn"[^>]*>.*<\/button>\s*<script src="\/vendor\/reveal.js/g
    )

    // It should be inside the presenter-toolbar
    expect(html).toContain(
      '<button id="fs-btn" title="Enter fullscreen (F)" onclick="document.documentElement.requestFullscreen&&document.documentElement.requestFullscreen()">&#x26F6;</button>'
    )
  })

  it('should contain the new translucent CSS for presenter tools', () => {
    const presentation = { title: 'Test', slides: [] }
    const html = generateRevealHTML(presentation)

    expect(html).toContain('opacity: 0.15;')
    expect(html).toContain(
      '.slide-menu-button, #customcontrols, .reveal .controls, .palette, .boardhandle { opacity: 0.15 !important;'
    )
  })

  it('should include global settings in revealConfig', () => {
    const presentation = {
      title: 'Global Settings',
      slides: [],
      autoSlide: 5000,
      autoSlideLoop: true,
      navigationMode: 'linear',
    }
    const html = generateRevealHTML(presentation)

    expect(html).toContain('revealConfig.autoSlide = 5000;')
    expect(html).toContain('revealConfig.loop = true;')
    expect(html).toContain("revealConfig.navigationMode = 'linear';")
  })

  it('should render legacy speakerNotes through canonical notes helpers', () => {
    const html = generateRevealHTML({
      title: 'Notes',
      slides: [{ id: 's1', speakerNotes: 'Legacy note', elements: [] }],
    })

    expect(html).toContain('<aside class="notes">Legacy note</aside>')
  })

  it('should broadcast vertical and fragment indices separately in live mode', () => {
    const html = generateRevealHTML({ id: 'p1', title: 'Live', slides: [] })

    expect(html).toContain('verticalIndex: indices.v || 0')
    expect(html).toContain('fragmentIndex: indices.f || 0')
    expect(html).toContain("sock.on('control-navigate'")
  })

  it('should generate capture-ready print HTML without auto print', () => {
    const html = generatePrintHTML(
      {
        title: 'Capture',
        slides: [
          {
            id: 's1',
            elements: [
              { id: 't1', type: 'text', content: 'Initial', x: 0, y: 0, width: 100, height: 40 },
              {
                id: 'f1',
                type: 'text',
                content: 'Fragment',
                x: 0,
                y: 50,
                width: 100,
                height: 40,
                fragment: true,
                fragmentIndex: 1,
              },
            ],
          },
        ],
      },
      {
        autoPrint: false,
        includePrintBar: false,
        fragmentMode: 'final',
        baseUrl: 'http://test',
        exportElementIds: true,
      }
    )

    expect(html.match(/class="slide-page"/g)).toHaveLength(1)
    expect(html).toContain('<base href="http://test/">')
    expect(html).not.toContain('id="print-bar"')
    expect(html).toContain('window.__navslidesExportReady = true;')
    expect(html).toContain('data-export-element-id="f1"')
    expect(html).toContain('if (false) window.print();')
    expect(html).toContain('Fragment')
  })
})
