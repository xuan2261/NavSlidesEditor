import { afterEach } from 'vitest'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { JSDOM, ResourceLoader } from 'jsdom'
import { generateRevealHTML } from '../../src/htmlGenerator.js'
const require = createRequire(import.meta.url)
const { buildEducationRuntime } = require('../../../scripts/build-education-runtime.js')
const documents = [],
  directories = []
afterEach(() => {
  for (const dom of documents.splice(0)) dom.window.close()
  for (const dir of directories.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})
export async function actualEducationDocument(
  presentation,
  { options, url = 'http://localhost/present', beforeParse, socketFactory } = {}
) {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'ns-education-bundle-'))
  directories.push(output)
  await buildEducationRuntime(output)
  class LocalAssets extends ResourceLoader {
    fetch(resource) {
      const pathname = new URL(resource).pathname
      if (socketFactory && pathname === '/vendor/socket.io/socket.io.min.js')
        return Promise.resolve(Buffer.from('window.io = window.__fixtureIo;'))
      const file = pathname.startsWith('/vendor/navslides-education/')
        ? path.join(output, path.basename(pathname))
        : pathname.startsWith('/vendor/')
          ? path.resolve('server/vendor', pathname.slice('/vendor/'.length))
          : pathname === '/reveal-overrides.css'
            ? path.resolve('client/public/reveal-overrides.css')
            : null
      if (!file || !fs.existsSync(file))
        throw new Error(`Unexpected or missing generated resource: ${pathname}`)
      return Promise.resolve(fs.readFileSync(file))
    }
  }
  const dom = new JSDOM(generateRevealHTML(presentation, options), {
    url,
    runScripts: 'dangerously',
    resources: new LocalAssets(),
    pretendToBeVisual: true,
    beforeParse(window) {
      window.structuredClone = structuredClone
      window.crypto.randomUUID = randomUUID
      if (socketFactory) window.__fixtureIo = socketFactory
      beforeParse?.(window)
    },
  })
  documents.push(dom)
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Actual Reveal did not become ready')), 5000)
    dom.window.addEventListener(
      'load',
      () => {
        const done = () =>
          queueMicrotask(() => {
            clearTimeout(timeout)
            resolve()
          })
        if (dom.window.Reveal.isReady()) done()
        else dom.window.Reveal.on('ready', done)
      },
      { once: true }
    )
  })
  return dom
}
