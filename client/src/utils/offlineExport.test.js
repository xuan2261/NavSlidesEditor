import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Buffer } from 'node:buffer'
import { generateOfflineHTML } from './offlineExport'

function blobFrom(text, type = 'text/plain') {
  return new Blob([text], { type })
}

describe('generateOfflineHTML', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: new URL('http://localhost:4173/editor/deck-1'),
    })
    vi.stubGlobal('FileReader', class {
      readAsDataURL(blob) {
        // Convert Blob chunks to base64 using Response.arrayBuffer
        const resp = new Response(blob)
        resp.arrayBuffer().then((ab) => {
          const bytes = Buffer.from(ab)
          this.result = `data:${blob.type || 'image/png'};base64,${bytes.toString('base64')}`
          this.onloadend?.()
        })
      }
    })
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const requestUrl = String(url)
      if (requestUrl.includes('theme/black.css')) {
        return {
          ok: true,
          text: async () => '.reveal{background:#000}',
        }
      }
      if (requestUrl.includes('reveal.js')) {
        return {
          ok: true,
          text: async () => 'window.Reveal={initialize(){}};// </script safe',
        }
      }
      if (requestUrl.includes('/uploads/image.png')) {
        return {
          ok: true,
          blob: async () => blobFrom('png-bytes', 'image/png'),
        }
      }
      return {
        ok: false,
        text: async () => '',
        blob: async () => blobFrom(''),
      }
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('inlines vendor CSS/JS, escapes script endings, removes base tags, and embeds uploads', async () => {
    const html = `<!doctype html><html><head>
<base href="http://localhost:4173/">
<link rel="stylesheet" href="/vendor/reveal.js/dist/theme/black.css">
</head><body>
<img src="/uploads/image.png">
<script src="/vendor/reveal.js/dist/reveal.js"></script>
<script>Reveal.initialize({});</script>
</body></html>`

    const offline = await generateOfflineHTML(html)

    expect(offline).not.toContain('<base')
    expect(offline).not.toContain('href="/vendor/reveal.js/dist/theme/black.css"')
    expect(offline).not.toContain('src="/vendor/reveal.js/dist/reveal.js"')
    expect(offline).toContain('<style>/* /vendor/reveal.js/dist/theme/black.css */')
    expect(offline).toContain('<\\/script safe')
    expect(offline).toContain('data:image/png;base64')
  })
})
