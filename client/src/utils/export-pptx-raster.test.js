import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildLatexRasterMarkup, renderElementFallbackDataUri } from './export-pptx-raster'

describe('export-pptx-raster', () => {
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  const originalImage = globalThis.Image

  function mockHtmlCaptureEnvironment() {
    let messageHandler = null
    const iframe = {
      contentWindow: {},
      remove: vi.fn(),
      setAttribute: vi.fn(),
      style: {},
      srcdoc: '',
    }

    globalThis.window = {
      addEventListener: vi.fn((type, handler) => {
        if (type === 'message') messageHandler = handler
      }),
      location: { origin: 'http://localhost' },
      removeEventListener: vi.fn(),
    }

    globalThis.document = {
      body: {
        appendChild: vi.fn((node) => {
          const captureId = node.srcdoc.match(/const CAPTURE_ID="([^"]+)"/)?.[1]
          setTimeout(() => {
            messageHandler?.({
              data: {
                __navslidesPptxCapture: true,
                id: captureId,
                kind: 'png',
                payload: 'data:image/png;base64,abc123',
              },
              source: node.contentWindow,
            })
          }, 0)
        }),
      },
      createElement: vi.fn((tag) => {
        if (tag !== 'iframe') throw new Error(`Unexpected tag: ${tag}`)
        return iframe
      }),
    }

    globalThis.Image = class MockImage {}
    return iframe
  }

  afterEach(() => {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow

    if (originalDocument === undefined) delete globalThis.document
    else globalThis.document = originalDocument

    if (originalImage === undefined) delete globalThis.Image
    else globalThis.Image = originalImage

    vi.restoreAllMocks()
  })

  it('captures scripted html embeds through iframe snapshot instead of returning null', async () => {
    const iframe = mockHtmlCaptureEnvironment()

    const result = await renderElementFallbackDataUri({
      type: 'html',
      content: '<script>window.__chart = true</script><div id="viz"></div>',
      width: 480,
      height: 270,
    })

    expect(result).toBe('data:image/png;base64,abc123')
    expect(iframe.setAttribute).toHaveBeenCalledWith('sandbox', 'allow-scripts')
    expect(iframe.srcdoc).toContain('<script>window.__chart = true</script>')
  })

  it('injects the PPTX capture runtime into full html documents without nesting a second document', async () => {
    const iframe = mockHtmlCaptureEnvironment()
    const fullDocument =
      '<!doctype html><html><head><style>body{margin:0}</style></head><body><div id="viz">Hello</div></body></html>'

    const result = await renderElementFallbackDataUri({
      type: 'html',
      content: fullDocument,
      width: 640,
      height: 360,
    })

    expect(result).toBe('data:image/png;base64,abc123')
    expect(iframe.srcdoc.match(/<!doctype html>/gi)).toHaveLength(1)
    expect(iframe.srcdoc).not.toContain('<body><!doctype html>')
    expect(iframe.srcdoc).toContain('<div id="viz">Hello</div>')
    expect(iframe.srcdoc.indexOf('<script data-navslides-pptx-capture="true">')).toBeLessThan(
      iframe.srcdoc.indexOf('<div id="viz">Hello</div>')
    )
    expect(iframe.srcdoc.indexOf('<script data-navslides-pptx-capture="true">')).toBeLessThan(
      iframe.srcdoc.indexOf('</body>')
    )
  })

  it('builds latex raster markup without embedded MathML annotation text', () => {
    const html = buildLatexRasterMarkup('E=mc^2')

    expect(html).toContain('katex-html')
    expect(html).not.toContain('katex-mathml')
    expect(html).not.toContain('<annotation')
  })
})
