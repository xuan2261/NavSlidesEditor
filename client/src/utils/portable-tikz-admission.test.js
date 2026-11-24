import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderElement } from 'revealjs-shared/src/element-renderers.js'
import { generatePortableDocument } from './portable-document-rewriter.js'

const tex = '\\begin{tikzpicture}\\draw[blue] (0,0)--(3,0)--(0,2)--cycle;\\end{tikzpicture}'
const input = renderElement(
  { id: 'compiler', type: 'latex', content: tex, x: 0, y: 0, width: 360, height: 240 },
  {},
  {}
)
const frame = new DOMParser().parseFromString(input, 'text/html').querySelector('iframe')
const source = new DOMParser().parseFromString(frame.srcdoc, 'text/html')
const entryUrl = new URL(
  source.querySelector('script[src$="/vendor/tikzjax/tikzjax.js"]').getAttribute('src'),
  'http://lesson.invalid/'
).href
const baseUrl = new URL('/', entryUrl).href
const declaration = {
  network: false,
  offlineCapable: true,
  resources: [{ url: entryUrl, kind: 'script' }],
  dynamicResources: [],
}
const attribute = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

function resources(change) {
  return async (url) => {
    const pathname = new URL(url).pathname
    const bytes = readFileSync(path.resolve(`server${pathname}`))
    const body = change?.(pathname, bytes) ?? bytes
    const type = pathname.endsWith('.js')
      ? 'text/javascript'
      : pathname.endsWith('.css')
        ? 'text/css'
        : pathname.endsWith('.json')
          ? 'application/json'
          : pathname.endsWith('.woff2')
            ? 'font/woff2'
            : pathname.endsWith('.woff')
              ? 'font/woff'
              : pathname.endsWith('.ttf')
                ? 'font/ttf'
                : pathname.endsWith('.otf')
                  ? 'font/otf'
                  : 'application/gzip'
    return new Response(body, { headers: { 'content-type': type } })
  }
}
function changedManifest(bytes, change) {
  const manifest = JSON.parse(bytes.toString('utf8'))
  change(manifest)
  return JSON.stringify(manifest)
}

beforeAll(async () => {
  vi.stubGlobal('crypto', webcrypto)
  await generatePortableDocument(input, { baseUrl, generatedDocument: true, fetch: resources() })
})
afterAll(() => vi.unstubAllGlobals())

describe('portable real compiler fail-closed admission', () => {
  it.each([
    [
      'changed entry',
      '/vendor/tikzjax/tikzjax.js',
      (bytes) => Buffer.concat([bytes, Buffer.from('\n')]),
    ],
    [
      'unsupported manifest version',
      '/vendor/tikzjax/runtime-manifest.json',
      (bytes) =>
        changedManifest(bytes, (manifest) => {
          manifest.version = 'unsupported'
        }),
    ],
    [
      'changed worker',
      '/vendor/tikzjax/run-tex.js',
      (bytes) => Buffer.concat([bytes, Buffer.from('\n')]),
    ],
    [
      'changed inventory',
      '/vendor/tikzjax/runtime-manifest.json',
      (bytes) =>
        changedManifest(bytes, (manifest) => {
          manifest.resources[0].sha256 = '0'.repeat(64)
        }),
    ],
    [
      'changed Wasm asset',
      '/vendor/tikzjax/tex.wasm.gz',
      (bytes) => {
        const changed = Buffer.from(bytes)
        changed[100] ^= 1
        return changed
      },
    ],
  ])(
    'refuses %s rather than exporting a partially privileged compiler',
    async (_name, target, change) => {
      await expect(
        generatePortableDocument(input, {
          baseUrl,
          generatedDocument: true,
          fetch: resources((pathname, bytes) => (pathname === target ? change(bytes) : bytes)),
        })
      ).rejects.toMatchObject({ code: 'undeclared', elementId: 'compiler' })
    }
  )

  it('refuses packaged compiler authority inside authored frames even with a declared script', async () => {
    const authored = `<iframe data-ns-element-id="authored" data-html-dependencies="${attribute(JSON.stringify(declaration))}" srcdoc="${attribute(`<script src="${entryUrl}"></script><script type="text/tikz">${tex}</script>`)}"></iframe>`
    await expect(
      generatePortableDocument(authored, { baseUrl, generatedDocument: true, fetch: resources() })
    ).rejects.toMatchObject({ code: 'undeclared', elementId: 'authored' })
  })
})
