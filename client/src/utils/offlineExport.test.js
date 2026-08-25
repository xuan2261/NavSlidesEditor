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
    vi.stubGlobal(
      'FileReader',
      class {
        readAsDataURL(blob) {
          // Convert Blob chunks to base64 using Response.arrayBuffer
          const resp = new Response(blob)
          resp.arrayBuffer().then((ab) => {
            const bytes = Buffer.from(ab)
            this.result = `data:${blob.type || 'image/png'};base64,${bytes.toString('base64')}`
            this.onloadend?.()
          })
        }
      }
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        const requestUrl = String(url)
        if (requestUrl.includes('theme/black.css')) {
          return {
            ok: true,
            text: async () =>
              '@import "https://fonts.googleapis.com/css?family=Lato";.reveal{background:#000}',
          }
        }
        if (requestUrl.includes('reveal-overrides.css')) {
          return {
            ok: true,
            text: async () => '.reveal section{line-height:normal!important}',
          }
        }
        if (requestUrl.includes('reveal.js')) {
          return {
            ok: true,
            text: async () => 'window.Reveal={initialize(){}};// </script safe',
          }
        }
        if (requestUrl.includes('mermaid/mermaid.min.js')) {
          return {
            ok: true,
            text: async () => 'window.mermaid={initialize(){},run(){}};',
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
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('inlines vendor CSS/JS, escapes script endings, removes base tags, and embeds uploads', async () => {
    const html = `<!doctype html><html><head>
<base href="http://localhost:4173/">
<link rel="stylesheet" href="/vendor/reveal.js/dist/theme/black.css">
<link rel="stylesheet" href="/reveal-overrides.css">
</head><body>
<img src="/uploads/image.png">
<script src="/vendor/reveal.js/dist/reveal.js"></script>
<script>Reveal.initialize({});</script>
</body></html>`

    const offline = await generateOfflineHTML(html)

    expect(offline).not.toContain('<base')
    expect(offline).not.toContain('href="/vendor/reveal.js/dist/theme/black.css"')
    expect(offline).not.toContain('href="/reveal-overrides.css"')
    expect(offline).not.toContain('src="/vendor/reveal.js/dist/reveal.js"')
    expect(offline).toContain('<style>/* /vendor/reveal.js/dist/theme/black.css */')
    expect(offline).toContain('<style>/* /reveal-overrides.css */')
    expect(offline).toContain('<\\/script safe')
    expect(offline).toContain('data:image/png;base64')
    expect(offline).not.toContain('fonts.googleapis.com')
  })

  it('embeds local caption track sources for offline playback', async () => {
    fetch.mockImplementation(async (url) => String(url).includes('/uploads/captions.vtt') ? { ok: true, blob: async () => blobFrom('WEBVTT', 'text/vtt') } : { ok: false, text: async () => '', blob: async () => blobFrom('') })
    const offline = await generateOfflineHTML('<video><track src="/uploads/captions.vtt" kind="captions"></video>')
    expect(offline).toContain('data:text/vtt;base64,')
  })

  it('embeds local assets referenced by required Reveal theme CSS', async () => {
    fetch.mockImplementation(async (url) => {
      const requestUrl = String(url)
      if (requestUrl.endsWith('/vendor/reveal.js/dist/theme/black.css')) {
        return {
          ok: true,
          text: async () =>
            '@import "https://fonts.googleapis.com/css?family=Lato";@font-face{font-family:Local;src:url(../fonts/theme.woff2)}',
        }
      }
      if (requestUrl.endsWith('/vendor/reveal.js/dist/fonts/theme.woff2')) {
        return { ok: true, blob: async () => blobFrom('font-bytes', 'font/woff2') }
      }
      return { ok: false, text: async () => '', blob: async () => blobFrom('') }
    })
    const html = '<link rel="stylesheet" href="/vendor/reveal.js/dist/theme/black.css">'

    const offline = await generateOfflineHTML(html, { strictRequiredAssets: true })

    expect(offline).not.toContain('fonts.googleapis.com')
    expect(offline).toContain('data:font/woff2;base64,')
    expect(offline).not.toContain('../fonts/theme.woff2')
  })

  it('inlines Mermaid runtime inside data-url html embed iframes', async () => {
    const iframeHtml = encodeURIComponent(
      `<!doctype html><html><head><script src="/vendor/mermaid/mermaid.min.js"></script></head><body><pre class="mermaid">flowchart TD\nA-->B</pre></body></html>`
    )
    const html = `<!doctype html><html><body><iframe src="data:text/html;charset=utf-8,${iframeHtml}"></iframe></body></html>`

    const offline = await generateOfflineHTML(html)

    expect(offline).toContain('data-offline-id="__offline_iframe_0"')
    expect(fetch).toHaveBeenCalledWith('http://localhost:4173/vendor/mermaid/mermaid.min.js')
  })

  it('rejects when strict mode cannot inline a required Reveal asset', async () => {
    const html = '<link rel="stylesheet" href="/vendor/katex/dist/strict-missing.css">'

    await expect(generateOfflineHTML(html, { strictRequiredAssets: true })).rejects.toThrow(
      'offline-asset-fetch-failed'
    )
  })

  it('[cap:runtime.reveal6-assets] treats Reveal 6 dist plugin scripts as required offline assets', async () => {
    const html = '<script src="/vendor/reveal.js/dist/plugin/notes.js"></script>'
    fetch.mockResolvedValueOnce({ ok: false, text: async () => '' })

    await expect(generateOfflineHTML(html, { strictRequiredAssets: true })).rejects.toThrow(
      'offline-asset-fetch-failed'
    )
  })
  it('fails closed when a required Reveal asset is missing inside iframe HTML', async () => {
    const html =
      '<iframe srcdoc="&lt;script src=&quot;/vendor/reveal.js/dist/plugin/notes.js&quot;&gt;&lt;/script&gt;"></iframe>'
    fetch.mockResolvedValueOnce({ ok: false, text: async () => '' })

    await expect(generateOfflineHTML(html, { strictRequiredAssets: true })).rejects.toThrow(
      'offline-asset-fetch-failed'
    )
  })

  it('does not cache failed required assets and retries after recovery', async () => {
    const html = '<link rel="stylesheet" href="/vendor/reveal.js/dist/theme/strict-recovery.css">'
    const fetchMock = globalThis.fetch
    fetchMock
      .mockImplementationOnce(async () => ({ ok: false, text: async () => '' }))
      .mockImplementationOnce(async () => ({ ok: true, text: async () => '.reveal{}' }))

    await expect(generateOfflineHTML(html, { strictRequiredAssets: true })).rejects.toThrow(
      'offline-asset-fetch-failed'
    )
    const offline = await generateOfflineHTML(html, { strictRequiredAssets: true })

    expect(offline).toContain('/* /vendor/reveal.js/dist/theme/strict-recovery.css */')
    expect(offline).toContain('.reveal{}')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
