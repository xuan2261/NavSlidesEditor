import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Buffer } from 'node:buffer'
import { runInNewContext } from 'node:vm'
import { generateOfflineHTML } from './offlineExport.js'
import { serializeEducationConfig } from 'revealjs-shared/src/education/config-serialization.js'
import { buildSandboxFrameDocument } from 'revealjs-shared/src/education/html-sandbox-policy.js'
const local = { network: false, offlineCapable: true, resources: [], dynamicResources: [] }
const options = { baseUrl: 'https://lesson.example/', htmlDependencies: local }
const attribute = (text) =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const parse = (html) => new DOMParser().parseFromString(html, 'text/html')
function exerciseRelay(wrapper) {
  const frame = wrapper.querySelector('#ns-sandbox-child')
  const context = { deferredSource: frame.getAttribute('data-ns-srcdoc') }
  const setup = `
    const listeners = new Map(), messages = [];
    const window = { parent: { postMessage() {} },
      addEventListener(type, listener) { listeners.set(type, listener) }, removeEventListener() {} };
    const loads = new Set();
    const child = { contentWindow: { postMessage(message) { messages.push(message) } },
      getAttribute(name) { return name === 'data-ns-srcdoc' ? deferredSource : null },
      addEventListener(type, listener) { if (type === 'load') loads.add(listener) },
      removeEventListener(type, listener) { loads.delete(listener) },
      set srcdoc(value) {
        if (value === null || !loads.size || !listeners.has('message')) throw new Error('Source assigned before relay admission');
        this.assigned = value; for (const load of loads) load();
      } };
    const document = { getElementById() { return child } };
    globalThis.crypto = { getRandomValues(bytes) { bytes.fill(7); return bytes } };
  `
  const script = [...wrapper.querySelectorAll('script')].find((node) =>
    node.textContent.includes('createPluginRelayBridge')
  )
  runInNewContext(
    `${setup}\n${script.textContent}\nglobalThis.observed={source:child.assigned,messages};`,
    context
  )
  return context.observed
}
describe('public portable HTML export contract', () => {
  it('preserves mixed closing-tag and Unicode script payloads without creating injected nodes', async () => {
    const payload =
      '</ScRiPt><img id="injected" src="https://attack.example/x"> </SCRIPT > & 中文 \\ "'
    const source = `window.value=${serializeEducationConfig(payload)};`
    const input = `<iframe data-html-dependencies="${attribute(JSON.stringify(local))}" srcdoc="${attribute(`<script>${source}</script>`)}"></iframe>`
    const output = parse(await generateOfflineHTML(input, options))
    const embedded = parse(output.querySelector('iframe').srcdoc)
    const context = { window: {} }
    runInNewContext(embedded.querySelector('script').textContent, context)
    expect(context.window.value).toBe(payload)
    expect(output.querySelector('#injected')).toBeNull()
    expect(embedded.querySelector('#injected')).toBeNull()
    expect(output.querySelector('iframe').getAttribute('sandbox')).toBe('allow-scripts')
  })
  it('closes data HTML and PDF blob-initialization documents without leaving stale initialization attributes', async () => {
    const source = '<button>Preserved lesson</button><script>window.count=0;</script>'
    for (const frame of [
      `<iframe data-html-dependencies="${attribute(JSON.stringify(local))}" src="data:text/html;charset=utf-8,${encodeURIComponent(source)}"></iframe>`,
      `<iframe data-html-dependencies="${attribute(JSON.stringify(local))}" data-pdf-iframe="${encodeURIComponent(source)}"></iframe>`,
    ]) {
      const doc = parse(await generateOfflineHTML(frame, options))
      const iframe = doc.querySelector('iframe'),
        nested = parse(iframe.srcdoc)
      expect(nested.querySelector('button').textContent).toBe('Preserved lesson')
      expect(iframe.hasAttribute('src')).toBe(false)
      expect(iframe.hasAttribute('data-pdf-iframe')).toBe(false)
    }
  })
  it('does not execute author scripts during closure and does not silently recover missing resources', async () => {
    globalThis.portableExecutionSentinel = 0
    try {
      await generateOfflineHTML(
        '<script>globalThis.portableExecutionSentinel=42;</script>',
        options
      )
      expect(globalThis.portableExecutionSentinel).toBe(0)
      await expect(
        generateOfflineHTML('<img src="missing.png">', {
          ...options,
          fetch: async () => new Response('Not found', { status: 404 }),
        })
      ).rejects.toMatchObject({ code: 'fetch', url: 'https://lesson.example/missing.png' })
    } finally {
      delete globalThis.portableExecutionSentinel
    }
  })
  it('never gives nested user code generator marker authority and rejects root code without declarations', async () => {
    const child =
      '<script data-navslides-runtime="local">fetch("https://attack.example/");</script>'
    await expect(
      generateOfflineHTML(`<iframe srcdoc="${attribute(child)}"></iframe>`, {
        baseUrl: options.baseUrl,
        generatedDocument: true,
      })
    ).rejects.toMatchObject({ code: 'manifest' })
    await expect(
      generateOfflineHTML('<script>window.counter=1;</script>', { baseUrl: options.baseUrl })
    ).rejects.toMatchObject({ code: 'manifest' })
  })
  it.each(['srcdoc', 'data-ns-srcdoc'])(
    'admits only generated-root compiler frames and executes closed local content: %s',
    async (sourceAttribute) => {
      const content =
        '<button onclick="window.counter += 1">Count</button><script>window.counter=2;</script>'
      const input = `<iframe data-ns-generated-frame="true" ${sourceAttribute}="${attribute(content)}"></iframe>`
      const exported = parse(
        await generateOfflineHTML(input, { baseUrl: options.baseUrl, generatedDocument: true })
      )
      const closed = parse(exported.querySelector('iframe').getAttribute(sourceAttribute))
      const context = { window: {} }
      for (const script of closed.querySelectorAll('script'))
        runInNewContext(script.textContent, context)
      runInNewContext(closed.querySelector('button').getAttribute('onclick'), context)
      expect(context.window.counter).toBe(3)
      await expect(generateOfflineHTML(input, { baseUrl: options.baseUrl })).rejects.toMatchObject({
        code: 'manifest',
      })
    }
  )
  it.each(['', 'data-ns-generated-frame="true"'])(
    'does not inherit compiler authority into a nested forged frame: %s',
    (parentMarker) => {
      const child = `<iframe data-ns-generated-frame="true" srcdoc="${attribute('<script data-navslides-runtime="local">window.counter=1;</script>')}"></iframe>`
      const input = `<section data-slide-id="lesson"><iframe data-element-id="authored" ${parentMarker} srcdoc="${attribute(child)}"></iframe></section>`
      return expect(
        generateOfflineHTML(input, { baseUrl: options.baseUrl, generatedDocument: true })
      ).rejects.toMatchObject({ code: 'manifest', slideId: 'lesson', elementId: 'authored' })
    }
  )
  it('keeps root runtime bypass unavailable in marked compiler frames and declared authored descendants', async () => {
    const content =
      '<script data-navslides-runtime="local">fetch("https://attack.example/");</script>'
    const forged = `<iframe data-ns-generated-frame="true" srcdoc="${attribute(content)}"></iframe>`
    for (const input of [
      forged,
      `<iframe data-html-dependencies="${attribute(JSON.stringify(local))}" srcdoc="${attribute(forged)}"></iframe>`,
    ]) {
      await expect(
        generateOfflineHTML(input, { baseUrl: options.baseUrl, generatedDocument: true })
      ).rejects.toMatchObject({ code: 'undeclared', url: 'https://attack.example/' })
    }
  })
  it.each(['object', 'url', 'pdf', 'plugin'])(
    'does not grant compiler authority to a marked %s document',
    async (kind) => {
      const content = '<script>window.counter=1;</script>'
      const frames = {
        object: `<object data-ns-generated-frame="true" srcdoc="${attribute(content)}"></object>`,
        url: `<iframe data-ns-generated-frame="true" src="data:text/html;charset=utf-8,${encodeURIComponent(content)}"></iframe>`,
        pdf: `<iframe data-ns-generated-frame="true" data-pdf-iframe="${encodeURIComponent(content)}"></iframe>`,
        plugin: `<iframe data-ns-generated-frame="true" data-plugin-src="data:text/html;charset=utf-8,${encodeURIComponent(content)}"></iframe>`,
      }
      await expect(
        generateOfflineHTML(frames[kind], { baseUrl: options.baseUrl, generatedDocument: true })
      ).rejects.toMatchObject({ code: 'manifest' })
    }
  )
  it.each(['/vendor/qrcode/unregistered.js', 'https://attack.example/vendor/qrcode/qrcode.min.js'])(
    'does not treat an unknown or cross-origin runtime as a packaged adapter: %s',
    async (runtime) => {
      const content = `<script src="${runtime}"></script>`
      const input = `<iframe data-ns-generated-frame="true" srcdoc="${attribute(content)}"></iframe>`
      await expect(
        generateOfflineHTML(input, {
          baseUrl: options.baseUrl,
          generatedDocument: true,
          strictRequiredAssets: true,
          fetch: async () =>
            new Response('fetch("https://attack.example/unbounded");', {
              headers: { 'content-type': 'text/javascript' },
            }),
        })
      ).rejects.toMatchObject({ code: 'undeclared', url: 'https://attack.example/unbounded' })
    }
  )
  it('does not remove an author stricter CSP or add network origins to the certified policy', async () => {
    const doc = parse(
      await generateOfflineHTML(
        '<meta http-equiv="Content-Security-Policy" content="script-src \'none\'"><p>Static lesson</p>',
        options
      )
    )
    const policies = [...doc.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')].map(
      (meta) => meta.content
    )
    expect(policies).toContain("script-src 'none'")
    expect(policies[0]).toContain("connect-src 'none'")
    expect(policies[0]).not.toContain('https:')
  })
  it('keeps the plugin relay child deferred until listeners are installed and sends the first init on its load', async () => {
    const source = buildSandboxFrameDocument('<button>Counter</button>', local, {
      plugin: true,
      portable: true,
    })
    const outer = parse(
      await generateOfflineHTML(
        `<iframe data-html-dependencies="${attribute(JSON.stringify(local))}" srcdoc="${attribute(source)}"></iframe>`,
        options
      )
    )
    const wrapper = parse(outer.querySelector('iframe').srcdoc)
    const child = wrapper.querySelector('#ns-sandbox-child')
    expect(child.hasAttribute('srcdoc')).toBe(false)
    const observed = exerciseRelay(wrapper)
    expect(parse(observed.source).querySelector('button').textContent).toBe('Counter')
    expect(observed.messages.map((message) => message.type)).toEqual(['init'])
    expect(observed.messages[0].source).toBe('navslides-host')
    expect(observed.messages[0].size).toEqual({ width: 1, height: 1 })
  })
  it('closes generated plugin source bytes into a deferred opaque relay and preserves executable local content', async () => {
    const raw = '<button>Counter</button><script>window.counter=3;</script>'
    const url = `data:text/html;charset=utf-8,${encodeURIComponent(raw)}`
    const generated = `<iframe data-plugin-src="${attribute(url)}" data-plugin-data="{}" data-plugin-width="300" data-plugin-height="200" data-html-dependencies="${attribute(JSON.stringify(local))}"></iframe>`
    const doc = parse(
      await generateOfflineHTML(generated, { baseUrl: options.baseUrl, generatedDocument: true })
    )
    const outer = doc.querySelector('iframe')
    expect(outer.hasAttribute('data-plugin-src')).toBe(false)
    expect(outer.hasAttribute('srcdoc')).toBe(false)
    const observed = exerciseRelay(parse(outer.getAttribute('data-ns-srcdoc')))
    expect(observed.messages.map((message) => message.type)).toEqual(['init'])
    const localContext = { window: {} }
    const closed = parse(observed.source)
    for (const script of closed.querySelectorAll('script'))
      runInNewContext(script.textContent, localContext)
    expect(localContext.window.counter).toBe(3)
    expect(closed.querySelector('button').textContent).toBe('Counter')
  })
  it('rejects generated plugin source lacking an explicit offline manifest instead of treating markers as authority', async () => {
    const raw = 'data:text/html,<script>window.count=1;</script>'
    await expect(
      generateOfflineHTML(
        `<iframe data-plugin-src="${attribute(raw)}" data-plugin-data="{}"></iframe>`,
        { baseUrl: options.baseUrl, generatedDocument: true }
      )
    ).rejects.toMatchObject({ code: 'manifest' })
  })
})

describe('generateOfflineHTML canonical closure compatibility', () => {
  const legacyOptions = { baseUrl: 'http://localhost:4173/editor/deck-1', htmlDependencies: local }
  const response = (body, type) => new Response(body, { headers: { 'content-type': type } })
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const path = String(url)
      if (path.includes('fonts.googleapis.com')) return response('.offline-font{}', 'text/css')
      if (path.includes('theme/black.css'))
        return response('@import "https://fonts.googleapis.com/css?family=Lato";.reveal{background:#000}', 'text/css')
      if (path.includes('reveal-overrides.css'))
        return response('.reveal section{line-height:normal!important}', 'text/css')
      if (path.includes('reveal.js'))
        return response('window.Reveal={initialize(){}};// </script safe', 'text/javascript')
      if (path.includes('mermaid/mermaid.min.js'))
        return response('window.mermaid={initialize(){},run(){}};', 'text/javascript')
      if (path.includes('/uploads/image.png')) return response('png-bytes', 'image/png')
      return new Response('Missing', { status: 404 })
    }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('inlines vendor CSS/JS, escapes script endings, removes base tags, and embeds uploads', async () => {
    const html = `<!doctype html><html><head>
<base href="http://localhost:4173/">
<link rel="stylesheet" href="/vendor/reveal.js/dist/theme/black.css">
<link rel="stylesheet" href="/reveal-overrides.css">
</head><body><img src="/uploads/image.png">
<script src="/vendor/reveal.js/dist/reveal.js"></script>
<script>Reveal.initialize({});</script></body></html>`
    const offline = await generateOfflineHTML(html, legacyOptions)
    const document = parse(offline)
    expect(document.querySelector('base')).toBeNull()
    expect(document.querySelector('link[rel="stylesheet"]')).toBeNull()
    expect(document.querySelector('script[src]')).toBeNull()
    expect([...document.querySelectorAll('style')].map((style) => style.textContent).join(' '))
      .toContain('.reveal section{line-height:normal!important}')
    expect(offline).toContain('<\\/script safe')
    expect(document.querySelector('img').getAttribute('src')).toContain('data:image/png;base64,')
    expect(offline).not.toContain('fonts.googleapis.com')
  })

  it('embeds local caption track sources for offline playback', async () => {
    fetch.mockImplementation(async (url) => String(url).includes('/uploads/captions.vtt')
      ? response('WEBVTT', 'text/vtt') : new Response('Missing', { status: 404 }))
    const document = parse(await generateOfflineHTML(
      '<video><track src="/uploads/captions.vtt" kind="captions"></video>', legacyOptions))
    expect(document.querySelector('track').getAttribute('src')).toContain('data:text/vtt;base64,')
  })

  it.each(['/uploads/poster-only.png', 'https://media.example/poster-only.png'])(
    'embeds a video poster without a matching image source: %s', async (poster) => {
      const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII='
      fetch.mockImplementation(async () => response(Buffer.from(png, 'base64'), 'image/png'))
      const document = parse(await generateOfflineHTML(`<video poster="${poster}"></video>`, legacyOptions))
      expect(document.querySelector('video').getAttribute('poster')).toBe(`data:image/png;base64,${png}`)
    }
  )

  it('embeds local assets referenced by required Reveal theme CSS', async () => {
    fetch.mockImplementation(async (url) => {
      const path = String(url)
      if (path.endsWith('/vendor/reveal.js/dist/theme/black.css'))
        return response('@import "https://fonts.googleapis.com/css?family=Lato";@font-face{font-family:Local;src:url(../fonts/theme.woff2)}', 'text/css')
      if (path.includes('fonts.googleapis.com')) return response('.offline-font{}', 'text/css')
      if (path.endsWith('/vendor/reveal.js/dist/fonts/theme.woff2')) return response('font-bytes', 'font/woff2')
      return new Response('Missing', { status: 404 })
    })
    const offline = await generateOfflineHTML('<link rel="stylesheet" href="/vendor/reveal.js/dist/theme/black.css">',
      { ...legacyOptions, strictRequiredAssets: true })
    expect(offline).not.toContain('fonts.googleapis.com')
    expect(offline).toContain('data:font/woff2;base64,')
    expect(offline).not.toContain('../fonts/theme.woff2')
  })

  it('inlines Mermaid runtime inside declared data-url html embed iframes', async () => {
    const iframeHtml = encodeURIComponent('<!doctype html><html><head><script src="/vendor/mermaid/mermaid.min.js"></script></head><body><pre class="mermaid">flowchart TD\nA-->B</pre></body></html>')
    const document = parse(await generateOfflineHTML(`<iframe src="data:text/html;charset=utf-8,${iframeHtml}"></iframe>`, legacyOptions))
    const child = parse(document.querySelector('iframe').srcdoc)
    expect(child.querySelector('script[src]')).toBeNull()
    expect([...child.querySelectorAll('script')].some((script) => script.textContent.includes('window.mermaid'))).toBe(true)
    expect(fetch).toHaveBeenCalledWith('http://localhost:4173/vendor/mermaid/mermaid.min.js', expect.any(Object))
  })

  it('rejects when strict mode cannot inline a required Reveal asset', async () => {
    await expect(generateOfflineHTML('<link rel="stylesheet" href="/vendor/katex/dist/strict-missing.css">',
      { ...legacyOptions, strictRequiredAssets: true })).rejects.toMatchObject({ code: 'fetch' })
  })

  it('[cap:runtime.reveal6-assets] treats Reveal 6 dist plugin scripts as required offline assets', async () => {
    fetch.mockImplementationOnce(async () => new Response('Missing', { status: 404 }))
    await expect(generateOfflineHTML('<script src="/vendor/reveal.js/dist/plugin/notes.js"></script>',
      { ...legacyOptions, strictRequiredAssets: true })).rejects.toMatchObject({ code: 'fetch' })
  })

  it('fails closed when a required Reveal asset is missing inside iframe HTML', async () => {
    fetch.mockImplementationOnce(async () => new Response('Missing', { status: 404 }))
    await expect(generateOfflineHTML('<iframe srcdoc="&lt;script src=&quot;/vendor/reveal.js/dist/plugin/notes.js&quot;&gt;&lt;/script&gt;"></iframe>',
      { ...legacyOptions, strictRequiredAssets: true })).rejects.toMatchObject({ code: 'fetch' })
  })

  it('does not cache failed required assets and retries after recovery', async () => {
    const html = '<link rel="stylesheet" href="/vendor/reveal.js/dist/theme/strict-recovery.css">'
    fetch.mockImplementationOnce(async () => new Response('Missing', { status: 404 }))
      .mockImplementationOnce(async () => response('.reveal{}', 'text/css'))
    await expect(generateOfflineHTML(html, { ...legacyOptions, strictRequiredAssets: true }))
      .rejects.toMatchObject({ code: 'fetch' })
    const offline = await generateOfflineHTML(html, { ...legacyOptions, strictRequiredAssets: true })
    expect(offline).toContain('.reveal{}')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
