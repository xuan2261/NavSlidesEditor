import { describe, expect, it, vi } from 'vitest'
import rasterModule from './server-raster.js'
import { chromium } from 'playwright'
import { generatePrintHTML } from 'revealjs-shared'
import vendorModule from './server-raster-vendor-route.js'

const { __private } = rasterModule

function makeRoute(url) {
  return {
    request: () => ({ url: () => url }),
    abort: vi.fn(async () => {}),
    continue: vi.fn(async () => {}),
    fulfill: vi.fn(async () => {}),
  }
}

describe('server-raster route isolation', () => {
  it('does not collect hidden elements as raster targets', () => {
    const targets = __private.collectRasterTargets(
      {
        slides: [
          {
            elements: [
              { id: 'html-visible', type: 'html' },
              { id: 'html-hidden', type: 'html', hidden: true },
              { id: 'latex-hidden', type: 'latex', hidden: true },
            ],
          },
        ],
      },
      new Set(['html', 'latex'])
    )

    expect(targets).toEqual([{ id: 'html-visible', slideIndex: 0, type: 'html' }])
  })

  it('assigns fresh ids to visible raster elements missing one', () => {
    const element = { type: 'html', content: '<p>Missing id</p>' }
    const targets = __private.collectRasterTargets(
      { slides: [{ elements: [element] }] },
      new Set(['html'])
    )

    expect(element.id).toEqual(expect.any(String))
    expect(targets).toEqual([{ id: element.id, slideIndex: 0, type: 'html' }])
  })

  it('rejects duplicate visible raster target ids', () => {
    expect(() =>
      __private.collectRasterTargets(
        {
          slides: [
            { elements: [{ id: 'duplicate', type: 'html' }] },
            { elements: [{ id: 'duplicate', type: 'latex' }] },
          ],
        },
        new Set(['html', 'latex'])
      )
    ).toThrow(/Duplicate raster target id/)
  })

  it('collects only safe images with CSS filters or rounded corners', () => {
    const targets = __private.collectRasterTargets(
      {
        slides: [
          {
            elements: [
              { id: 'plain', type: 'image', src: 'data:image/png;base64,AAA' },
              {
                id: 'filtered',
                type: 'image',
                src: 'data:image/png;base64,AAA',
                filterBrightness: 120,
              },
              {
                id: 'rounded-upload',
                type: 'image',
                src: '/uploads/rounded.png',
                borderRadius: 12,
              },
              {
                id: 'remote',
                type: 'image',
                src: 'https://example.com/remote.png',
                filterGrayscale: 100,
              },
              {
                id: 'unsafe-upload-path',
                type: 'image',
                src: '/uploads/%2e%2e/secret.png',
                borderRadius: 12,
              },
            ],
          },
        ],
      },
      new Set(['image'])
    )

    expect(targets).toEqual([
      { id: 'filtered', slideIndex: 0, type: 'image' },
      { id: 'rounded-upload', slideIndex: 0, type: 'image' },
    ])
  })

  it('blocks outbound network requests when baseUrl is empty', async () => {
    let handler
    const page = {
      route: vi.fn(async (_pattern, callback) => {
        handler = callback
      }),
    }

    await __private.installVendorRoute(page, '')

    const route = makeRoute('https://evil.example.com/tracker.js')
    await handler(route)

    expect(route.abort).toHaveBeenCalledWith('blockedbyclient')
    expect(route.continue).not.toHaveBeenCalled()
  })

  it('allows data URLs without baseUrl', async () => {
    let handler
    const page = {
      route: vi.fn(async (_pattern, callback) => {
        handler = callback
      }),
    }

    await __private.installVendorRoute(page, '')

    const route = makeRoute('data:image/png;base64,AAA')
    await handler(route)

    expect(route.continue).toHaveBeenCalled()
    expect(route.abort).not.toHaveBeenCalled()
  })

  it('allows same-origin requests when baseUrl is configured', async () => {
    let handler
    const page = {
      route: vi.fn(async (_pattern, callback) => {
        handler = callback
      }),
    }

    await __private.installVendorRoute(page, 'http://127.0.0.1:3002')

    const route = makeRoute('http://127.0.0.1:3002/uploads/example.png')
    await handler(route)

    expect(route.continue).toHaveBeenCalled()
    expect(route.abort).not.toHaveBeenCalled()
  })

  it('allows same-origin requests when baseUrl has trailing slash', async () => {
    let handler
    const page = {
      route: vi.fn(async (_pattern, callback) => {
        handler = callback
      }),
    }

    await __private.installVendorRoute(page, 'http://127.0.0.1:3002/')

    const route = makeRoute('http://127.0.0.1:3002/uploads/example.png')
    await handler(route)

    expect(route.continue).toHaveBeenCalled()
    expect(route.abort).not.toHaveBeenCalled()
  })

  it('renders offline syntax highlighting and denies outbound and traversal requests', async () => {
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.NAVSLIDES_CHROMIUM_PATH || undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    })
    try {
      const page = await browser.newPage()
      const html = generatePrintHTML(
        {
          slides: [
            {
              id: 'offline',
              elements: [
                {
                  id: 'code',
                  type: 'code',
                  content: 'const answer = 42;',
                  language: 'javascript',
                  x: 0,
                  y: 0,
                  width: 300,
                  height: 100,
                },
              ],
            },
          ],
        },
        { autoPrint: false, includePrintBar: false }
      )
      await vendorModule.loadRasterHTML(page, html, '')
      await page.waitForFunction('window.__navslidesExportReady === true', null, { timeout: 15000 })
      const colors = await page.evaluate(() => {
        const code = document.querySelector('.slide-page code')
        return [
          getComputedStyle(code).color,
          getComputedStyle(code.querySelector('.hljs-keyword')).color,
        ]
      })
      expect(colors[1]).not.toBe(colors[0])
      for (const url of [
        'https://evil.example.com/tracker.js',
        '/vendor/%2e%2e%2fpackage.json',
        '/uploads/private.png',
      ]) {
        const failed = page.waitForEvent('requestfailed', (request) =>
          request.url().endsWith(new URL(url, page.url()).pathname)
        )
        await page.evaluate((url) => fetch(url).catch(() => null), url)
        expect((await failed).failure().errorText).toContain('ERR_BLOCKED_BY_CLIENT')
      }
    } finally {
      await browser.close()
    }
  }, 60000)
})
