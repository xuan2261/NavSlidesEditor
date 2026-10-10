import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import { generateOfflineHTML } from './offlineExport.js'
import { generatePortableDocument } from './portable-document-rewriter.js'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderElement } from 'revealjs-shared/src/element-renderers.js'
const local = { network: false, offlineCapable: true, resources: [], dynamicResources: [] }
const attr = (value) => JSON.stringify(value).replace(/"/g, '&quot;')
const fixtures = {
  '/lesson/frame.html': [
    'text/html',
    '<base href="./assets/"><link rel="stylesheet" href="sheet.css"><iframe src="nested.html"></iframe><img src="same.png">',
  ],
  '/lesson/assets/nested.html': [
    'text/html',
    '<img src="same.png"><video poster="same.png"><source src="clip.mp4"><track src="captions.vtt"></video>',
  ],
  '/lesson/assets/sheet.css': [
    'text/css',
    '@import "more.css" screen; .x{background:url(same.png)}',
  ],
  '/lesson/assets/more.css': ['text/css', '@font-face{font-family:lesson;src:url(font.woff2)}'],
  '/lesson/assets/same.png': ['image/png', 'QUESTION-BYTES'],
  '/lesson/assets/clip.mp4': ['video/mp4', 'VIDEO-BYTES'],
  '/lesson/assets/captions.vtt': ['text/vtt', 'WEBVTT\n\n00:00.000 --> 00:01.000\nHello'],
  '/lesson/assets/font.woff2': ['font/woff2', 'FONT-BYTES'],
  '/cycle.css': ['text/css', '@import "cycle.css";'],
  '/wrong.js': ['text/html', '<html>Not Javascript</html>'],
  '/bad.js': ['text/javascript', 'fetch("./missing.json")'],
  '/module.js': [
    'text/javascript',
    'import { label } from "./dep.js"; document.body.dataset.result=label;',
  ],
  '/dep.js': ['text/javascript', 'export const label="lesson";'],
  '/worker.js': ['text/javascript', 'self.onmessage=function(e){self.postMessage("worker-ok");};'],
  '/data.json': ['application/json', '{"status":"ready"}'],
  '/cycle-a.js': ['text/javascript', 'import "./cycle-b.js";'],
  '/cycle-b.js': ['text/javascript', 'import "./cycle-a.js";'],
}
const pluginPath = '/api/plugins/animated-counter/assets/sandbox.html'
const emittedPlugin = (dependencies) =>
  renderElement(
    {
      id: 'actual-counter',
      type: 'plugin:counter',
      pluginSlug: 'animated-counter',
      pluginRuntime: {
        label: 'Animated Counter',
        sandbox: 'sandbox.html',
        htmlDependencies: dependencies,
      },
      pluginData: { value: 12, label: 'Class score' },
      x: 0,
      y: 0,
      width: 360,
      height: 180,
    },
    {},
    {}
  )
let server, base, requests
beforeAll(async () => {
  requests = new Map()
  server = createServer((req, res) => {
    requests.set(req.url, (requests.get(req.url) || 0) + 1)
    const fixture = fixtures[req.url]
    res.writeHead(fixture ? 200 : 404, { 'content-type': fixture?.[0] || 'text/plain' })
    res.end(fixture?.[1] || 'Missing resource')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}/`
})
afterAll(
  () =>
    new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
)
describe('portable recursive resource closure', () => {
  it.each([
    [
      'chart',
      '/vendor/chart.js/dist/chart.umd.js',
      { chartData: { labels: ['Monday'], datasets: [{ label: 'Authored series', data: [7] }] } },
    ],
    ['qrcode', '/vendor/qrcode/qrcode.min.js', { qrData: 'https://lesson.example/authored' }],
  ])(
    'closes actual compiled %s frames with their canonical packaged runtime bytes',
    async (type, runtimePath, fields) => {
      const input = renderElement(
        { id: `compiled-${type}`, type, x: 0, y: 0, width: 360, height: 180, ...fields },
        {},
        {}
      )
      const compiler = new DOMParser().parseFromString(input, 'text/html')
      const source = new DOMParser().parseFromString(
        compiler.querySelector('iframe').srcdoc,
        'text/html'
      )
      const runtimeUrl = new URL(source.querySelector('script[src]').getAttribute('src'), base).href
      const runtime = readFileSync(path.resolve(`server${runtimePath}`), 'utf8')
      const exportOptions = {
        baseUrl: new URL('/', runtimeUrl).href,
        generatedDocument: true,
        strictRequiredAssets: true,
        fetch: async (url) =>
          url === runtimeUrl
            ? new Response(runtime, { headers: { 'content-type': 'text/javascript' } })
            : new Response('Missing resource', { status: 404 }),
      }
      const { html, receipt } = await generatePortableDocument(input, exportOptions)
      const exported = new DOMParser().parseFromString(html, 'text/html').querySelector('iframe')
      const closed = new DOMParser().parseFromString(exported.srcdoc, 'text/html')
      expect(exported.getAttribute('sandbox')).toBe('allow-scripts')
      expect(closed.querySelector('script[src]')).toBeNull()
      expect(closed.querySelector('canvas')).not.toBeNull()
      expect(receipt.resources).toEqual([
        expect.objectContaining({
          url: runtimeUrl,
          mime: 'text/javascript',
          bytes: Buffer.byteLength(runtime),
        }),
      ])
      expect(receipt.offlineCapable).toBe(true)
      await expect(
        generateOfflineHTML(input, {
          ...exportOptions,
          fetch: async () => new Response('Missing resource', { status: 404 }),
        })
      ).rejects.toMatchObject({ code: 'fetch', url: runtimeUrl })
    }
  )
  it('closes actual production Animated Counter output using its declared bounded dependency graph', async () => {
    fixtures[pluginPath] = [
      'text/html',
      readFileSync(path.resolve('plugins/animated-counter/dist/sandbox.html'), 'utf8'),
    ]
    const { html, receipt } = await generatePortableDocument(
      `<section data-slide-id="counter-slide">${emittedPlugin(local)}</section>`,
      { baseUrl: base, generatedDocument: true }
    )
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const outer = doc.querySelector('iframe')
    const wrapper = new DOMParser().parseFromString(
      outer.getAttribute('data-ns-srcdoc'),
      'text/html'
    )
    const child = wrapper.querySelector('#ns-sandbox-child')
    const peer = new DOMParser().parseFromString(child.getAttribute('data-ns-srcdoc'), 'text/html')
    expect(peer.querySelector('#value').textContent).toBe('0')
    expect(peer.querySelector('#label').textContent).toBe('')
    expect(outer.getAttribute('sandbox')).toBe('allow-scripts')
    expect(child.getAttribute('sandbox')).toBe('allow-scripts')
    expect(
      receipt.resources.find((resource) => resource.url === `${base.slice(0, -1)}${pluginPath}`)
    ).toMatchObject({ mime: 'text/html' })
    expect(receipt.offlineCapable).toBe(true)
  })
  it('reports actual generated plugin declaration and dependency failures before certifying a download', async () => {
    fixtures[pluginPath] = ['text/html', '<script>document.body.textContent="Counter";</script>']
    await expect(
      generateOfflineHTML(emittedPlugin(undefined), { baseUrl: base, generatedDocument: true })
    ).rejects.toMatchObject({ code: 'manifest' })
    fixtures[pluginPath] = [
      'text/html',
      '<img src="missing-counter.png"><script>document.body.dataset.counter="ready";</script>',
    ]
    await expect(
      generateOfflineHTML(
        `<section data-slide-id="counter-slide">${emittedPlugin(local)}</section>`,
        { baseUrl: base, generatedDocument: true }
      )
    ).rejects.toMatchObject({
      code: 'fetch',
      url: `${base.slice(0, -1)}/api/plugins/animated-counter/assets/missing-counter.png`,
      slideId: 'counter-slide',
      elementId: 'actual-counter',
    })
  })
  it.each(['%2B%2F%2F%2BAAE%3D', '%2B%2F%0A%20%2F%2BAAE%3D'])(
    'preserves percent-encoded base64 stylesheet resource bytes: %s',
    async (payload) => {
      const { html, receipt } = await generatePortableDocument(
        `<style>.spinner{background:url("data:image/gif;base64,${payload}")}</style>`,
        { baseUrl: base }
      )
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const closed = doc
        .querySelector('style')
        .textContent.match(/data:image\/gif;base64,([^"\)]+)/)[1]
      expect(Array.from(atob(closed), (char) => char.charCodeAt(0))).toEqual([251, 255, 254, 0, 1])
      expect(
        receipt.resources.find((resource) => resource.url.startsWith('data:image/gif;'))
      ).toMatchObject({ mime: 'image/gif', bytes: 5 })
    }
  )
  it('closes nested HTML, CSS imports, fonts and AV without discarding content; deduplicates bytes', async () => {
    const before = requests.get('/lesson/assets/same.png') || 0
    const { html, receipt } = await generatePortableDocument(
      '<iframe src="lesson/frame.html"></iframe>',
      { baseUrl: base }
    )
    const document = new DOMParser().parseFromString(html, 'text/html')
    const frame = new DOMParser().parseFromString(
      document.querySelector('iframe').srcdoc,
      'text/html'
    )
    const nested = new DOMParser().parseFromString(
      frame.querySelector('iframe').srcdoc,
      'text/html'
    )
    expect(frame.querySelector('style').textContent).toContain('@media screen')
    expect(frame.querySelector('style').textContent).toContain('data:font/woff2;base64,')
    expect(nested.querySelector('source').src).toMatch(/^data:video\/mp4;base64,/)
    expect(nested.querySelector('track').src).toMatch(/^data:text\/vtt;base64,/)
    expect(atob(frame.querySelector('img').src.split(',')[1])).toBe('QUESTION-BYTES')
    expect(requests.get('/lesson/assets/same.png') - before).toBe(1)
    expect(receipt.resources.find((resource) => resource.url.endsWith('/same.png'))).toMatchObject({
      mime: 'image/png',
      bytes: 14,
    })
    expect(frame.querySelector('base')).toBeNull()
    expect(document.querySelector('iframe').getAttribute('sandbox')).toBe('allow-scripts')
  })
  it('closes schema native question bytes without copying live authority', async () => {
    const config = {
      title: 'Quiz',
      attemptLimit: 1,
      shuffleQuestions: false,
      feedbackMode: 'immediate',
      showScore: true,
      questions: [
        {
          id: 'q',
          kind: 'single-choice',
          prompt: '</ScRiPt> & 中文',
          points: 10,
          timeLimit: null,
          media: { src: `${base}lesson/assets/same.png`, alt: 'Question' },
          options: [
            { id: 'a', text: 'One' },
            { id: 'b', text: 'Two' },
          ],
          answerKey: { optionId: 'a' },
          feedback: { correct: '', incorrect: '', explanation: '' },
        },
      ],
    }
    const input = `<div data-ns-game data-ns-game-type="quiz"><script type="application/json" data-ns-game-config>${JSON.stringify(config).replace(/</g, '\\u003c')}</script></div>`
    const html = await generateOfflineHTML(input, { baseUrl: base })
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const restored = JSON.parse(doc.querySelector('[data-ns-game-config]').textContent)
    expect(atob(restored.questions[0].media.src.split(',')[1])).toBe('QUESTION-BYTES')
    expect(restored.questions[0].prompt).toBe('</ScRiPt> & 中文')
    await expect(
      generateOfflineHTML(
        '<script type="application/json" data-ns-live-bootstrap>{"hostCapability":"private"}</script>',
        { baseUrl: base }
      )
    ).rejects.toMatchObject({ code: 'authority' })
  })
  it('rejects CSS/document cycles with a reference chain instead of hanging', async () => {
    await expect(
      generateOfflineHTML('<link rel="stylesheet" href="cycle.css">', { baseUrl: base })
    ).rejects.toMatchObject({ code: 'cycle', url: `${base}cycle.css` })
  })
  it('rejects missing assets with owning slide, element and remedy', async () => {
    await expect(
      generateOfflineHTML(
        '<section data-slide-id="s"><img data-element-id="e" src="absent.png"></section>',
        { baseUrl: base }
      )
    ).rejects.toMatchObject({
      code: 'fetch',
      url: `${base}absent.png`,
      slideId: 's',
      elementId: 'e',
      remedy: expect.stringContaining('Upload'),
    })
  })
  it('rejects wrong MIME, oversized bytes and inaccessible resources', async () => {
    await expect(
      generateOfflineHTML('<script src="wrong.js"></script>', {
        baseUrl: base,
        htmlDependencies: { ...local, resources: [{ url: `${base}wrong.js`, kind: 'script' }] },
      })
    ).rejects.toMatchObject({ code: 'mime' })
    await expect(
      generateOfflineHTML('<img src="lesson/assets/same.png">', {
        baseUrl: base,
        limits: { maxResourceBytes: 4 },
      })
    ).rejects.toMatchObject({ code: 'size' })
    await expect(
      generateOfflineHTML('<img src="cross.png">', {
        baseUrl: base,
        fetch: async () => {
          throw new TypeError('Failed to fetch')
        },
      })
    ).rejects.toMatchObject({ code: 'fetch', remedy: expect.stringContaining('CORS') })
  })
  it('does not certify arbitrary scripted frames without manifests; rejects undeclared dynamic fetch', async () => {
    await expect(
      generateOfflineHTML(
        '<iframe srcdoc="&lt;script&gt;window.counter=1&lt;/script&gt;"></iframe>',
        { baseUrl: base }
      )
    ).rejects.toMatchObject({ code: 'manifest' })
    await expect(
      generateOfflineHTML(
        `<iframe data-html-dependencies="${attr(local)}" srcdoc="&lt;script src=&quot;${base}bad.js&quot;&gt;&lt;/script&gt;"></iframe>`,
        { baseUrl: base }
      )
    ).rejects.toMatchObject({ code: 'undeclared' })
  })
  it('keeps compiler toolbar actions usable while authored frames still require manifests', async () => {
    const toolbar =
      "<button onclick=\"this.dataset.theme = this.dataset.theme === 'dark' ? 'light' : 'dark'\">Theme</button>"
    const { html } = await generatePortableDocument(toolbar, {
      baseUrl: base,
      generatedDocument: true,
    })
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const button = doc.querySelector('button')
    const action = new Function('event', button.getAttribute('onclick'))
    action.call(button, new Event('click'))
    expect(button.dataset.theme).toBe('dark')
    action.call(button, new Event('click'))
    expect(button.dataset.theme).toBe('light')
    await expect(generatePortableDocument(toolbar, { baseUrl: base })).rejects.toMatchObject({
      code: 'manifest',
    })
    await expect(
      generatePortableDocument(
        `<iframe srcdoc="${toolbar.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe>`,
        { baseUrl: base, generatedDocument: true }
      )
    ).rejects.toMatchObject({ code: 'manifest' })
    await expect(
      generatePortableDocument(
        '<button onclick="fetch(\'https://undeclared.invalid/\')">Bad</button>',
        { baseUrl: base, generatedDocument: true }
      )
    ).rejects.toMatchObject({ code: 'undeclared' })
  })
  it('replaces declared finite GET fetch with synthetic Response; rejects POST or RPC', async () => {
    const fetchDeps = {
      network: false,
      offlineCapable: true,
      resources: [],
      dynamicResources: [{ url: `${base}data.json`, kind: 'connect' }],
    }
    const good = `<iframe data-html-dependencies="${attr(fetchDeps)}" srcdoc="&lt;script&gt;fetch(&quot;${base}data.json&quot;).then(async r =&gt; { document.body.dataset.response = JSON.stringify({ status: r.status, url: r.url, contentType: r.headers.get('content-type'), body: await r.json() }); });&lt;/script&gt;"></iframe>`
    const output = await generateOfflineHTML(good, { baseUrl: base })
    const doc = new DOMParser().parseFromString(output, 'text/html')
    const frame = new DOMParser().parseFromString(doc.querySelector('iframe').srcdoc, 'text/html')
    const run = new Function(
      'Response',
      'fetch',
      'document',
      frame.querySelector('script').textContent
    )
    run(
      Response,
      () => {
        throw new Error('Closed resource must not access the network')
      },
      frame
    )
    await expect
      .poll(() => frame.body.dataset.response)
      .toBe(
        JSON.stringify({
          status: 200,
          url: `${base}data.json`,
          contentType: 'application/json',
          body: { status: 'ready' },
        })
      )
    const bad = `<iframe data-html-dependencies="${attr(fetchDeps)}" srcdoc="&lt;script&gt;fetch(&quot;${base}data.json&quot;, { method: &quot;POST&quot; });&lt;/script&gt;"></iframe>`
    await expect(generateOfflineHTML(bad, { baseUrl: base })).rejects.toMatchObject({
      code: 'undeclared',
    })
  })
  it('rejects cyclic ESM modules with an explicit cycle error chain', async () => {
    await expect(
      generateOfflineHTML('<script type="module" src="cycle-a.js"></script>', {
        baseUrl: base,
        htmlDependencies: { ...local, resources: [{ url: `${base}cycle-a.js`, kind: 'script' }] },
      })
    ).rejects.toMatchObject({
      code: 'cycle',
      url: `${base}cycle-a.js`,
    })
  })
})
