import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import inspector from 'node:inspector'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
const reports = path.resolve('plans/261009-0901-navslides-full-reliability-deep-tdd/reports')
const source = path.join(reports, 'native-save-20261116-ae48c0a6-25a0-4ea3-aaf3-eac2d21e0930')
const isolation = JSON.parse(await fs.readFile(path.join(source, 'isolation.json')))
const prior = JSON.parse(await fs.readFile(path.join(source, 'result.json')))
const output = path.join(reports, `authority-get-${Date.now()}`)
await fs.mkdir(output)
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-authority-get-'))
for (const dir of ['data', 'uploads']) await fs.cp(path.join(isolation.root, dir), path.join(root, dir), { recursive: true })
Object.assign(process.env, { NODE_ENV: 'production', DATA_DIR: path.join(root, 'data'), SLIDES_DATA_DIR: path.join(root, 'data'), SLIDES_UPLOADS_DIR: path.join(root, 'uploads') })
const require = createRequire(import.meta.url)
const phases = []
// Instrument exports before loading their consumers; no production source patches.
for (const [file, names] of [
 ['../../server/services/pptx-import/package-authority-snapshot', ['createEditorPackageRead', 'resolveEditorProjectionContext']],
 ['../../server/services/pptx-import/canonical-snapshot', ['canonicalSaveSnapshot']],
 ['../../server/services/package-backed-presentation-read', ['resolvePackageBackedReadFromState', 'readAuthoritativePresentation']],
]) {
 const mod = require(file)
 for (const name of names) {
  const original = mod[name]
  mod[name] = function (...args) {
   const start = performance.now()
   const finish = () => phases.push({ name, ms: performance.now() - start })
   try { const result = original.apply(this, args); if (result?.then) return result.finally(finish); finish(); return result } catch (e) { finish(); throw e }
  }
 }
}
const session = new inspector.Session(); session.connect()
const post = promisify(session.post.bind(session))
const { startServer, stopServer } = require('../../server/index.js')
let server
try {
 server = await startServer(0, { host: '127.0.0.1' })
 await post('Profiler.enable'); await post('Profiler.start')
 const start = performance.now()
 const response = await fetch(`http://127.0.0.1:${server.address().port}/api/presentations/${prior.presentationId}`)
 const headersMs = performance.now() - start
 const text = await response.text()
 const totalMs = performance.now() - start
 const { profile } = await post('Profiler.stop')
 await fs.writeFile(path.join(output, 'get.cpuprofile'), JSON.stringify(profile))
 await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ source, root, presentationId: prior.presentationId, status: response.status, headersMs, totalMs, responseBytes: Buffer.byteLength(text), markerPresent: text.includes(prior.marker), phases }, null, 2))
 console.log(output, response.status, totalMs, phases)
} finally { session.disconnect(); if (server) await stopServer(server) }
