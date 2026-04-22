import { describe, it, expect } from 'vitest'
import { generateRevealHTML, getBackgroundAttrs } from '../src/htmlGenerator.js'

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
})
