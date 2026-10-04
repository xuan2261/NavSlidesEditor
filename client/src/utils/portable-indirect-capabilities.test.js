import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer } from 'node:http'
import { generateOfflineHTML } from './offlineExport.js'

let server, base
const attribute = (value) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
beforeAll(async () => {
  server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end('{"answer":"Earth"}')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}/`
})
afterAll(
  () =>
    new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
)
const sourceFrame = (source) => {
  const dependencies = {
    network: false,
    offlineCapable: true,
    resources: [],
    dynamicResources: [{ url: `${base}answer.json`, kind: 'connect' }],
  }
  return `<section data-slide-id="lesson"><iframe data-element-id="question" data-html-dependencies="${attribute(JSON.stringify(dependencies))}" srcdoc="${attribute(`<script>${source}</script>`)}"></iframe></section>`
}

describe('portable indirect capability admission', () => {
  it.each([
    'const { fetch: request } = window; request(URL);',
    'const request = window.fetch.bind(window); request(URL);',
    'const request = fetch; request(URL);',
    'const key = "fetch"; window[key](URL);',
    'Promise.resolve(fetch).then(request => request(URL));',
    'const { WebSocket: Channel } = window; new Channel(URL);',
    'const scope = window; scope["fetch"](URL);',
  ])(
    'rejects unsupported capability escapes before certifying a declared frame: %s',
    async (source) => {
      await expect(
        generateOfflineHTML(
          sourceFrame(source.replaceAll('URL', JSON.stringify(`${base}answer.json`))),
          { baseUrl: base }
        )
      ).rejects.toMatchObject({ code: 'undeclared', slideId: 'lesson', elementId: 'question' })
    }
  )
  it('embeds a declared direct finite request and executes its response without network access', async () => {
    const html = await generateOfflineHTML(
      sourceFrame(
        `window.fetch(${JSON.stringify(`${base}answer.json`)}).then(response => response.json()).then(value => document.body.dataset.answer = value.answer);`
      ),
      { baseUrl: base }
    )
    const document = new DOMParser().parseFromString(html, 'text/html')
    const frame = new DOMParser().parseFromString(
      document.querySelector('iframe').srcdoc,
      'text/html'
    )
    const run = new Function(
      'window',
      'document',
      'Response',
      frame.querySelector('script').textContent
    )
    run(
      {
        fetch() {
          throw new Error('Closed response attempted a network call')
        },
      },
      frame,
      Response
    )
    await expect.poll(() => frame.body.dataset.answer).toBe('Earth')
  })
})
