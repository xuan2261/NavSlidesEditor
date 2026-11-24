import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import inspector from 'node:inspector'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { chromium } from '@playwright/test'
import { exposedTarget } from './helpers.mjs'
const require = createRequire(import.meta.url)
const reports = path.resolve('plans/261009-0901-navslides-full-reliability-deep-tdd/reports')
const source = process.argv[2] || path.join(reports, 'native-save-20261116-eee17aad-d524-4c60-a321-72f767a4ac23/result.json')
const prior = JSON.parse(await fs.readFile(source, 'utf8'))
const output = path.join(reports, `live-cache-${Date.now()}`)
await fs.mkdir(output)
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-live-cache-'))
const receipt = { source, root, output, events: [], status: 'running', diagnosticOnly: true }
const save = () => fs.writeFile(path.join(output, 'result.json'), JSON.stringify(receipt, null, 2))
await save()
for (const dir of ['data', 'uploads']) await fs.cp(path.join(prior.retainedDataRoot, dir), path.join(root, dir), { recursive: true })
Object.assign(process.env, { NODE_ENV: 'production', HOST: '127.0.0.1', DATA_DIR: path.join(root, 'data'), SLIDES_DATA_DIR: path.join(root, 'data'), SLIDES_UPLOADS_DIR: path.join(root, 'uploads') })
// Compile only this process's authority module with observation hooks. No disk or production logging changes.
const Module = require('node:module')
const filename = require.resolve('../../server/services/pptx-import/package-authority-snapshot')
const originalLoader = Module._extensions['.js']
let phase = 'startup'
const hash = value => require('node:crypto').createHash('sha256').update(JSON.stringify(value) ?? 'undefined').digest('hex')
function differences(a, b, prefix = '', result = []) {
 if (result.length >= 20 || Object.is(a, b)) return result
 if (!a || !b || typeof a !== 'object' || typeof b !== 'object') { result.push({ path: prefix, left: a, right: b }); return result }
 for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
  differences(a[key], b[key], `${prefix}.${key}`, result)
  if (result.length >= 20) break
 }
 return result
}
globalThis.__liveCache = (kind, data) => {
 const event = { phase, kind, at: performance.now() }
 if (kind === 'journal') {
  const { key, dependencies, entries } = data
  const exact = entries.get(key)
  event.key = key; event.hit = exact === dependencies
  event.reason = event.hit ? 'exact-key-and-full-dependency-equality' : exact === undefined ? 'key-absent' : 'dependency-equality-mismatch'
  event.candidates = [...entries].filter(([k]) => k.split(':').slice(0, 4).join(':') === key.split(':').slice(0, 4).join(':')).map(([k, v]) => {
   const left = JSON.parse(v), right = JSON.parse(dependencies)
   return { key: k, changedKeyComponents: k.split(':').map((v, i) => v === key.split(':')[i] ? null : i).filter(v => v !== null), dependencies: Object.keys(right).map(name => ({ name, savedHash: hash(left[name]), readHash: hash(right[name]) })), differences: differences(left, right) }
  })
 } else Object.assign(event, data)
 receipt.events.push(event)
}
Module._extensions['.js'] = function (mod, file) {
 if (file !== filename) return originalLoader(mod, file)
 let text = require('node:fs').readFileSync(file, 'utf8')
 const replace = (before, after) => { if (!text.includes(before)) throw Error(`Instrumentation anchor missing: ${before}`); text = text.replace(before, after) }
 replace('verifiedJournalCache.set(verifiedKey, dependencies)', 'globalThis.__liveCache("record", {key: verifiedKey}); verifiedJournalCache.set(verifiedKey, dependencies)')
 replace('if (cache?.has(presentationId)) return cache.get(presentationId)', 'globalThis.__liveCache("ownedContexts", {presentationId, ownedState: !!cache, hit: !!cache?.has(presentationId), reason: !cache ? "state-not-owned" : cache.has(presentationId) ? "validated-context-retained" : "context-not-yet-validated"}); if (cache?.has(presentationId)) return cache.get(presentationId)')
 replace('if (verifiedJournalCache.get(verifiedKey) !== canonicalJson(dependencies)) {', 'globalThis.__liveCache("journal", {key: verifiedKey, dependencies: canonicalJson(dependencies), entries: verifiedJournalCache}); if (verifiedJournalCache.get(verifiedKey) !== canonicalJson(dependencies)) {')
 replace('const copy = structuredClone(state)', 'globalThis.__liveCache("ownedState", {hit:false, previousVersion:previous?.version, version}); const copy = structuredClone(state)')
 mod._compile(text, file)
}
const authority = require(filename)
Module._extensions['.js'] = originalLoader
for (const [file, names] of [
 ['../../server/services/pptx-import/package-authority-snapshot', ['createEditorPackageRead', 'resolveEditorProjectionContext']],
 ['../../server/services/pptx-import/canonical-snapshot', ['canonicalSaveSnapshot']],
 ['../../server/services/package-backed-presentation-read', ['resolvePackageBackedReadFromState', 'readAuthoritativePresentation']],
]) {
 const mod = require(file)
 for (const name of names) {
  const original = mod[name]
  mod[name] = function (...args) {
   const start = performance.now(); const finish = () => receipt.events.push({phase, kind:'timing', name, ms:performance.now()-start})
   try { const result = original.apply(this, args); if (result?.then) return result.finally(finish); finish(); return result } catch(e) { finish(); throw e }
  }
 }
}
const session = new inspector.Session(); session.connect()
const post = promisify(session.post.bind(session))
let server, browser
const { startServer, stopServer } = require('../../server/index.js')
try {
 server = await startServer(0, {host:'127.0.0.1'})
 const baseURL = `http://127.0.0.1:${server.address().port}`
 receipt.baseURL = baseURL; receipt.presentationId = prior.presentationId
 browser = await chromium.launch({headless:true})
 const context = await browser.newContext({baseURL, viewport:{width:1440,height:1000}, storageState:{cookies:[],origins:[{origin:baseURL,localStorage:[{name:'navSlidesTutorialSeen',value:'true'}]}]}})
 const page = await context.newPage()
 phase = 'initial-read'
 const initial = await (await context.request.get(`/api/presentations/${prior.presentationId}`)).json()
 await page.goto(`/editor/${prior.presentationId}`, {waitUntil:'domcontentloaded'})
 await page.waitForSelector('.ProseMirror-preview, [data-element-content]', {timeout:120000})
 const target = await exposedTarget(page, initial); receipt.target = target
 await page.mouse.dblclick(target.hitpoint.x, target.hitpoint.y)
 await page.getByTestId(`slide-element-${target.id}`).locator('.ProseMirror').waitFor({timeout:30000})
 await page.keyboard.press('ControlOrMeta+End')
 phase = 'native-save'
 const responsePromise = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith(`/api/presentations/${prior.presentationId}`), {timeout:120000})
 receipt.inputStart = performance.now()
 await page.keyboard.type('x'); receipt.inputEnd = performance.now()
 await page.keyboard.press('Escape')
 const response = await responsePromise
 await response.finished(); receipt.putStatus = response.status(); receipt.putFinished = performance.now()
 // Large save DTOs may be evicted from Chromium's response cache; status/finished are sufficient for this diagnostic.
 receipt.saveRequestBytes = response.request().postDataBuffer()?.length
 await save()
 phase = 'same-process-first-get'
 await post('Profiler.enable'); await post('Profiler.start')
 const start = performance.now()
 const get = await context.request.get(`/api/presentations/${prior.presentationId}`, {timeout:120000})
 const body = await get.body(); receipt.getMs = performance.now()-start; receipt.getStatus = get.status()
 await fs.writeFile(path.join(output, 'get.json'), body)
 const {profile} = await post('Profiler.stop')
 await fs.writeFile(path.join(output, 'get.cpuprofile'), JSON.stringify(profile))
 receipt.status = 'captured'
} catch(e) { receipt.status='failed'; receipt.error=e.stack; process.exitCode=1 }
finally {
 await save(); session.disconnect()
 if (browser) await browser.close()
 if (server) await stopServer(server)
 delete globalThis.__liveCache
 console.log(output, receipt.status, receipt.getMs)
}
