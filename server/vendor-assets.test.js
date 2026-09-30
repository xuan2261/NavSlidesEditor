import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const originalNodeEnv = process.env.NODE_ENV
let app

beforeAll(async () => {
  vi.resetModules()
  process.env.NODE_ENV = 'production'
  const imported = await import('./index.js')
  app = imported.app || imported.default?.app
})

afterAll(() => {
  vi.resetModules()
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnv
})

describe('vendor assets', () => {
  it.each([
    '/vendor/chart.js/dist/chart.umd.js',
    '/vendor/katex/dist/katex.min.css',
    '/vendor/katex/dist/katex.min.js',
    '/vendor/tikzjax/fonts.css',
    '/vendor/tikzjax/tikzjax.js',
  ])('serves %s locally', async (assetPath) => {
    const res = await request(app).get(assetPath)
    expect(res.status).toBe(200)
  })

  it('allows opaque-origin KaTeX frames to load fonts without opening other assets to cross-origin reads', async () => {
    const font = await request(app)
      .get('/vendor/katex/dist/fonts/KaTeX_Main-Regular.woff2')
      .set('Origin', 'null')
    const css = await request(app).get('/vendor/katex/dist/katex.min.css').set('Origin', 'null')
    const api = await request(app).get('/api/settings').set('Origin', 'null')

    expect(font.status).toBe(200)
    expect(font.headers['content-type']).toMatch(/font\/woff2/)
    expect(font.headers['access-control-allow-origin']).toBe('*')
    expect(css.status).toBe(200)
    expect(css.headers['access-control-allow-origin']).toBeUndefined()
    expect(api.headers['access-control-allow-origin']).toBeUndefined()
  })
})
