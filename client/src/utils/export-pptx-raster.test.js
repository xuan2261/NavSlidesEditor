import { afterEach, describe, expect, it, vi } from 'vitest'
import { Buffer } from 'node:buffer'
import QRCode from 'qrcode'
import { buildLatexRasterMarkup, renderElementFallbackDataUri } from './export-pptx-raster'

describe('export-pptx-raster', () => {
  function mockHtmlCaptureEnvironment() {
    const iframe = document.createElement('iframe')
    const createElement = document.createElement.bind(document)
    const appendChild = document.body.appendChild.bind(document.body)

    vi.spyOn(document, 'createElement').mockImplementation((tag, options) =>
      tag === 'iframe' ? iframe : createElement(tag, options)
    )
    // Snapshot rendering is a browser-only boundary; deliver its message through the real window.
    vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      const result = appendChild(node)
      const captureId = node.srcdoc.match(/const CAPTURE_ID="([^"]+)"/)?.[1]
      setTimeout(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: {
              __navslidesPptxCapture: true,
              id: captureId,
              kind: 'png',
              payload: 'data:image/png;base64,abc123',
            },
            source: node.contentWindow,
          })
        )
      }, 0)
      return result
    })

    return iframe
  }

  afterEach(() => {
    document.querySelectorAll('iframe').forEach((iframe) => iframe.remove())
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
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')
    expect(iframe.isConnected).toBe(false)
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

  it('returns no QR raster when QR generation rejects so the caller can insert a placeholder', async () => {
    vi.spyOn(QRCode, 'toDataURL').mockRejectedValueOnce(new Error('QR payload is too large'))

    await expect(
      renderElementFallbackDataUri({
        type: 'qrcode',
        qrData: 'too-large',
        width: 180,
        height: 180,
      })
    ).resolves.toBeNull()
  })

  it('[cap:element.svg depth:export] sanitizes SVG fallback data URIs for PPTX', async () => {
    const result = await renderElementFallbackDataUri({
      type: 'svg',
      content:
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect onload="evil()" width="10" height="10"/></svg>',
      width: 100,
      height: 100,
    })
    const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf8')

    expect(svg).toContain('<svg')
    expect(svg).toContain('<rect')
    expect(svg).not.toContain('<script')
    expect(svg).not.toContain('onload')
  })
})
