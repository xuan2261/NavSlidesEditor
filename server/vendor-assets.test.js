import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import desktopCsp from '../electron/content-security-policy.js'

const savedEnv = Object.fromEntries(
  ['NODE_ENV', 'SLIDES_DATA_DIR', 'SLIDES_UPLOADS_DIR'].map((key) => [key, process.env[key]])
)
let root
let app

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-static-assets-'))
  process.env.SLIDES_DATA_DIR = path.join(root, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
  await fs.mkdir(process.env.SLIDES_DATA_DIR, { recursive: true })
  await fs.mkdir(process.env.SLIDES_UPLOADS_DIR, { recursive: true })
  vi.resetModules()
  process.env.NODE_ENV = 'production'
  const imported = await import('./index.js')
  app = imported.app || imported.default?.app
})

afterAll(async () => {
  vi.resetModules()
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  if (root) await fs.rm(root, { recursive: true, force: true })
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

describe('uploaded SVG documents', () => {
  it.each(['uploaded', 'legacy'])('sandboxes and sanitizes %s SVG independently of desktop presentation policy', async (source) => {
    const content = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="window.__svgAttack = true">' +
      '<rect id="visible-shape" width="24" height="12" fill="red"/>' +
      '<script>window.__svgAttack = true</script>' +
      '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">unsafe-html</div></foreignObject>' +
      '</svg>'
    )
    let url
    if (source === 'uploaded') {
      const upload = await request(app).post('/api/upload').attach('file', content, 'diagram.svg')
      expect(upload.status).toBe(200)
      expect(upload.body.url).toMatch(/^\/uploads\/[^/]+\.svg$/)
      url = upload.body.url
    } else {
      // Legacy files must be sanitized on read, not just when newly uploaded.
      await fs.writeFile(path.join(root, 'uploads', 'legacy.SVG'), content)
      url = '/uploads/legacy.SVG'
    }

    const response = await request(app).get(url).buffer(true)
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toMatch(/^image\/svg\+xml(?:;|$)/)
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin')

    const policy = response.headers['content-security-policy']
    expect(typeof policy).toBe('string')
    const directives = new Map(policy.split(';').map((directive) => {
      const [name, ...values] = directive.trim().split(/\s+/)
      return [name, values]
    }))
    expect(directives.get('sandbox')).toEqual([])
    expect(directives.get('default-src')).toEqual(["'none'"])
    expect(directives.get('script-src') || directives.get('default-src')).toEqual(["'none'"])
    expect(directives.get('img-src')).toEqual(['data:'])
    expect(directives.get('style-src')).toEqual(["'unsafe-inline'"])

    const desktopHeaders = desktopCsp.withDesktopCsp({ 'content-security-policy': [policy] })
    expect(desktopHeaders['content-security-policy']).toEqual([policy])
    expect(desktopHeaders['Content-Security-Policy']).toBeUndefined()

    const payload = response.body.toString('utf8')
    expect(payload).toMatch(/^\s*<svg\b/)
    expect(payload).toMatch(/<rect\b[^>]*\bid="visible-shape"/)
    expect(payload).not.toMatch(/<script\b|<foreignObject\b|\bonload\s*=/i)
    expect(payload).not.toContain('__svgAttack')
    expect(payload).not.toContain('unsafe-html')
  })

  it('does not fall through to raw static serving when a legacy SVG has unsafe external references', async () => {
    const content = '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://attacker.example/private.svg"/></svg>'
    await fs.writeFile(path.join(root, 'uploads', 'unsafe.svg'), content)

    const response = await request(app).get('/uploads/unsafe.svg')
    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'SVG is unavailable' })
    expect(response.text).not.toContain('attacker.example')
  })
})
