import { afterEach, describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { generatePrintHTML, generateRevealHTML, getBackgroundAttrs } from '../src/htmlGenerator.js'

const documents = []
afterEach(() => {
  for (const dom of documents.splice(0)) dom.window.close()
})
function openDocument(html) {
  const dom = new JSDOM(html)
  documents.push(dom)
  return dom.window.document
}
const assetBaseUrl = 'https://slides.example.test/decks/lesson'

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

  it.each(['reveal', 'print'])(
    'keeps hostile stylesheet, theme, footer and background data outside %s root execution authority',
    (mode) => {
      const attack =
        '</style><script data-navslides-runtime="local" data-attack="root-source-probe">window.rootEscaped=1</script><iframe data-ns-generated-frame="true" data-attack="root-source-probe"></iframe><style>'
      const presentation = {
        title: 'Boundary lesson',
        slides: [
          {
            id: 'boundary-slide',
            background: { type: 'color', color: '#101827' },
            elements: [
              {
                id: 'boundary-text',
                type: 'text',
                x: 20,
                y: 20,
                width: 300,
                height: 90,
                content: '<p><strong>Readable lesson</strong></p>',
              },
            ],
          },
        ],
      }
      const generate = mode === 'reveal' ? generateRevealHTML : generatePrintHTML
      const options = { baseUrl: assetBaseUrl, autoPrint: false, includePrintBar: false }
      const original = openDocument(generate(presentation, options))
      const poisoned = structuredClone(presentation)
      poisoned.customCSS = 'p{line-height:1.5}' + attack
      poisoned.designTokens = { fonts: { body: attack }, colors: { bg: attack } }
      poisoned.showFooter = true
      poisoned.footerMode = 'sequence'
      poisoned.sequenceSections = ['Introduction', attack]
      poisoned.footerInactiveColor = '#ffffff"' + attack
      poisoned.footerFontFamily = 'Arial"' + attack
      poisoned.slides[0].background.color = '#101827"' + attack
      poisoned.slides[0].elements[0].fontFamily = 'Arial"' + attack
      const document = openDocument(generate(poisoned, options))
      expect(document.querySelector('[data-attack="root-source-probe"],iframe')).toBeNull()
      const sourceSet = (doc) =>
        [...doc.scripts].map((script) => ({
          src: script.src,
          type: script.type,
          runtime: script.dataset.navslidesRuntime || '',
        }))
      expect(sourceSet(document)).toEqual(sourceSet(original))
      expect([...document.querySelectorAll('strong')].map((node) => node.textContent)).toContain(
        'Readable lesson'
      )
    }
  )

  it.each(['reveal', 'print'])(
    'resolves Mermaid capabilities against the supplied origin for %s slides',
    (mode) => {
      const diagram = (id, mermaidSource, extra = {}) => ({
        id,
        type: 'html',
        embedKind: 'mermaid',
        mermaidSource,
        x: 0,
        y: 0,
        width: 200,
        height: 100,
        ...extra,
      })
      const parent = {
        id: 'parent',
        elements: [diagram('parent-diagram', 'flowchart TD\n  Parent-->Lesson')],
      }
      const child = {
        id: 'child',
        elements: [
          diagram('child-diagram', 'flowchart TD\n  Child-->Practice', {
            fragment: true,
            fragmentIndex: 1,
          }),
        ],
      }
      const presentation = {
        title: 'Mermaid lesson',
        slides: mode === 'reveal' ? [{ ...parent, children: [child] }] : [parent, child],
      }
      const html =
        mode === 'reveal'
          ? generateRevealHTML(presentation, { baseUrl: assetBaseUrl })
          : generatePrintHTML(presentation, {
              baseUrl: assetBaseUrl,
              autoPrint: false,
              includePrintBar: false,
              fragmentMode: 'final',
            })
      const document = openDocument(html)
      const surfaces = [
        ...document.querySelectorAll(
          mode === 'reveal' ? '.reveal .slides section[data-ns-effective-slide-id]' : '.slide-page'
        ),
      ]
      expect(surfaces).toHaveLength(2)
      const runtimeUrl = new URL('/vendor/mermaid/mermaid.min.js', assetBaseUrl).href
      const sourceOrder = surfaces.map((surface) => {
        const frame = surface.querySelector('iframe')
        expect(frame.getAttribute('sandbox').split(/\s+/)).toEqual(['allow-scripts'])
        const dependencies = JSON.parse(frame.getAttribute('data-html-dependencies'))
        expect(dependencies).toEqual({
          network: true,
          offlineCapable: true,
          resources: [{ url: runtimeUrl, kind: 'script' }],
          dynamicResources: [],
        })
        const content =
          mode === 'print'
            ? decodeURIComponent(frame.getAttribute('data-pdf-iframe'))
            : frame.getAttribute('srcdoc')
        const childDocument = openDocument(content)
        expect(
          [...childDocument.querySelectorAll('script[src]')].map((script) => script.src)
        ).toEqual([runtimeUrl])
        const policy = childDocument.querySelector(
          'meta[http-equiv="Content-Security-Policy"]'
        ).content
        const scriptDirective = policy
          .split(';')
          .map((directive) => directive.trim().split(/\s+/))
          .find(([name]) => name === 'script-src')
        expect(scriptDirective.slice(1)).toEqual(["'unsafe-inline'", new URL(assetBaseUrl).origin])
        return childDocument.querySelector('.mermaid').textContent
      })
      expect(sourceOrder).toEqual([
        'flowchart TD\n  Parent-->Lesson',
        'flowchart TD\n  Child-->Practice',
      ])
    }
  )

  it('should correctly format background attributes', () => {
    expect(getBackgroundAttrs({ type: 'color', color: '#ff0000' })).toBe(
      ' data-background-color="#ff0000"'
    )
    expect(getBackgroundAttrs({ type: 'image', image: 'test.png' })).toContain(
      'data-background-image'
    )
    expect(getBackgroundAttrs({ type: 'image', image: 'test.png' })).toContain('test.png')
    expect(
      getBackgroundAttrs({ type: 'gradient', gradient: 'linear-gradient(to right, red, blue)' })
    ).toContain('data-background-gradient="linear-gradient(to right, red, blue)"')
    expect(
      getBackgroundAttrs({
        type: 'gradient',
        angle: 90,
        stops: [
          { offset: 0, color: '#ff0000' },
          { offset: 1, color: '#0000ff' },
        ],
      })
    ).toContain('data-background-gradient="linear-gradient(90deg, #ff0000 0%, #0000ff 100%)"')
  })

  it('should emit per-slide reveal transition attributes', () => {
    const html = generateRevealHTML({
      title: 'Transitions',
      slides: [
        {
          id: 's1',
          transition: 'fade',
          transitionDirection: 'left',
          transitionDuration: 800,
          elements: [],
        },
      ],
    })

    expect(html).toContain('data-transition="fade"')
    expect(html).toContain('data-transition-direction="left"')
    expect(html).toContain('data-transition-duration="800"')
    expect(html).toContain('transition-duration:800ms;')
    expect(html).toContain('section[data-transition-direction="left"].future')

    const plainHtml = generateRevealHTML({ slides: [{ elements: [] }] })
    expect(plainHtml).not.toContain('section[data-transition-direction="left"].future')
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

  it('renders basic and sequence footer modes in reveal and print HTML', () => {
    const presentation = {
      title: 'Footers',
      showFooter: true,
      showPageNumbers: true,
      footerMode: 'sequence',
      footerFontSize: 16,
      footerColor: '#ffffff',
      footerInactiveColor: '#777777',
      sequenceSections: ['Intro', 'Methods', 'Results'],
      slides: [
        { id: 's1', activeSection: 0, elements: [] },
        { id: 's2', activeSection: 2, elements: [] },
      ],
    }

    const reveal = generateRevealHTML(presentation)
    expect(reveal).toContain('Intro')
    expect(reveal).toContain('Methods')
    expect(reveal).toContain('Results')
    expect(reveal).toContain('font-weight:700')
    expect(reveal).toContain('#777777')

    const basicPrint = generatePrintHTML(
      {
        title: 'Basic Footer',
        showFooter: true,
        showPageNumbers: true,
        footerMode: 'basic',
        slides: [{ id: 's1', section: 'Section A', elements: [] }],
      },
      { autoPrint: false, includePrintBar: false }
    )
    expect(basicPrint).toContain('Section A')
    expect(basicPrint).toContain('1 / 1')
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

    expect(html).toContain('function getLiveRevealIndices()')
    expect(html).toContain('var currentSlide = Reveal.getCurrentSlide && Reveal.getCurrentSlide();')
    expect(html).toContain('verticalIndex: indices.v || 0')
    expect(html).toContain('fragmentIndex: indices.f || 0')
    expect(html).toContain('slideIndex: indices.slideIndex || 0')
    expect(html).toContain('verticalIndex: indices.verticalIndex || 0')
    expect(html).toContain('fragmentIndex: indices.fragmentIndex || 0')
    expect(html).toContain(
      "document.addEventListener('keydown', emitLiveNavigateAfterInput, true);"
    )
    expect(html).toContain("window.addEventListener('hashchange', emitLiveNavigateAfterInput);")
    expect(html).toContain("sock.on('control-navigate'")
  })

  it('uses 16px section base font size and px text spacing in reveal HTML', () => {
    const html = generateRevealHTML({
      title: 'Spacing',
      slides: [
        {
          id: 's1',
          elements: [
            {
              id: 't1',
              type: 'text',
              content: '<p>Body</p>',
              x: 12,
              y: 34,
              width: 200,
              height: 80,
            },
          ],
        },
      ],
    })

    expect(html).toContain('font-size:calc(16px * var(--font-zoom, 1));')
    expect(html).toContain('left:12px;top:34px;width:200px;height:80px')
    expect(html).toContain('.reveal .slides section p  { margin: 0 0 6px;')
    expect(html).toContain('.reveal .slides section ol { padding-left: 24px; margin: 0 0 6px; }')
    expect(html).toContain('.reveal .slides section li { margin-bottom: 3px;')
    expect(html).not.toContain('.reveal .slides section p  { margin: 0 0 0.4em;')
    expect(html).not.toContain('padding-left: 1.5em; margin: 0 0 0.4em;')
  })

  it('generates one final-state print page with visible fragments and export identities', () => {
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

    const document = openDocument(html)
    const pages = [...document.querySelectorAll('.slide-page')]
    expect(pages).toHaveLength(1)
    expect(document.baseURI).toBe('http://test/')
    expect(document.querySelector('#print-bar')).toBeNull()
    expect(pages[0].querySelector('[data-export-element-id="f1"]').textContent).toBe('Fragment')
    expect(pages[0].textContent).toContain('Initial')
  })

  it('does not create extra print pages for hidden fragments', () => {
    const html = generatePrintHTML(
      {
        title: 'Hidden Fragment Print',
        slides: [
          {
            id: 's1',
            elements: [
              {
                id: 'visible',
                type: 'text',
                content: 'Visible',
                x: 0,
                y: 0,
                width: 100,
                height: 40,
              },
              {
                id: 'hidden-fragment',
                type: 'text',
                hidden: true,
                fragment: true,
                fragmentIndex: 1,
                content: 'Hidden fragment',
                x: 0,
                y: 50,
                width: 100,
                height: 40,
              },
            ],
          },
        ],
      },
      { autoPrint: false, includePrintBar: false, fragmentMode: 'expanded' }
    )

    const document = openDocument(html)
    const pages = [...document.querySelectorAll('.slide-page')]
    expect(pages).toHaveLength(1)
    expect(pages[0].textContent).toContain('Visible')
    expect(pages[0].textContent).not.toContain('Hidden fragment')
  })

  it('uses px text spacing in print HTML', () => {
    const html = generatePrintHTML(
      {
        title: 'Print Spacing',
        slides: [
          {
            id: 's1',
            elements: [
              {
                id: 't1',
                type: 'text',
                content: '<p>Body</p>',
                x: 0,
                y: 0,
                width: 100,
                height: 40,
              },
            ],
          },
        ],
      },
      { autoPrint: false, includePrintBar: false }
    )

    expect(html).toContain('.slide-page p  { margin: 0 0 6px;')
    expect(html).toContain(
      '.slide-page ul, .slide-page ol { padding-left: 24px; margin: 0 0 6px; }'
    )
    expect(html).toContain('.slide-page li { margin-bottom: 3px;')
    expect(html).not.toContain('.slide-page p  { margin: 0 0 0.4em;')
    expect(html).not.toContain('.slide-page ul, .slide-page ol { padding-left: 1.5em;')
  })

  it('renders plugin elements as static fallback in print HTML', () => {
    const html = generatePrintHTML(
      {
        title: 'Plugin Print',
        slides: [
          {
            id: 's1',
            elements: [
              {
                id: 'p1',
                type: 'plugin:counter',
                x: 1,
                y: 2,
                width: 300,
                height: 120,
                pluginSlug: 'animated-counter',
                pluginData: { value: 99, suffix: '%' },
                pluginRuntime: { label: 'Animated Counter', sandbox: 'sandbox.html' },
              },
            ],
          },
        ],
      },
      { autoPrint: false, includePrintBar: false }
    )

    expect(html).toContain('data-plugin-fallback="true"')
    expect(html).toContain('99%')
    expect(html).not.toContain('/api/plugins/')
  })
})
