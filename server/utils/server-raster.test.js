import { describe, expect, it, vi } from 'vitest'
import rasterModule from './server-raster.js'

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
})
