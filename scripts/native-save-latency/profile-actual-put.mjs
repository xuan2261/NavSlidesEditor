import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import inspector from 'node:inspector'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const reports = path.resolve('plans/261009-0901-navslides-full-reliability-deep-tdd/reports')
const source = path.resolve('PPTX/Bai_2_2.pptx')
const importProfile = process.argv.includes('--import-profile')
const output = path.join(
  reports,
  `${importProfile ? 'actual-import-profile' : 'actual-put-fresh-streaming'}-${Date.now()}-${process.pid}`
)
await fs.mkdir(output)
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-actual-put-'))
for (const dir of ['data', 'uploads']) await fs.mkdir(path.join(root, dir))
Object.assign(process.env, {
  NODE_ENV: 'production',
  HOST: '127.0.0.1',
  DATA_DIR: path.join(root, 'data'),
  SLIDES_DATA_DIR: path.join(root, 'data'),
  SLIDES_UPLOADS_DIR: path.join(root, 'uploads'),
})
const phases = []
let active = false
function wrap(mod, names) {
  for (const name of names) {
    const original = mod[name]
    mod[name] = function (...args) {
      if (!active) return original.apply(this, args)
      const start = performance.now(),
        cpu = process.cpuUsage()
      const finish = () =>
        phases.push({ name, ms: performance.now() - start, cpu: process.cpuUsage(cpu) })
      try {
        const value = original.apply(this, args)
        if (value?.then) return value.finally(finish)
        finish()
        return value
      } catch (e) {
        finish()
        throw e
      }
    }
  }
}
// Wrap owned operations before prepared-publication/StateStore capture exports.
wrap(require('../../server/services/pptx-import/package-store/owned-projection-save'), [
  'captureProjectionSave',
  'commitOwnedProjectionSave',
])
wrap(require('../../server/services/pptx-import/package-store/owned-outbox-ack'), [
  'captureCompatibilityWrites',
  'acknowledgeOwnedOutbox',
])
wrap(require('../../server/services/pptx-import/package-store/prepared-publication'), [
  'preparePublication',
  'prepareStreamingPublication',
])
wrap(require('../../server/services/pptx-import/package-store/durable-fs'), [
  'writeHashedCandidate',
  'validateExistingCandidate',
  'writeDurable',
  'replaceDurable',
  'syncDirectory',
])
for (const [file, names] of [
  ['../../server/services/pptx-import/canonical-snapshot', ['canonicalSaveSnapshot']],
  ['../../server/services/pptx-import/authority-sanitizer', ['sanitizeClientEditableData']],
  ['../../server/services/pptx-import/semantic-baseline', ['assertSemanticBaseline']],
  ['../../server/services/pptx-import/mutation-journal', ['deriveMutationJournal']],
  ['../../server/services/pptx-import/package-authority-snapshot', ['recordVerifiedJournal']],
  ['../../server/services/pptx-import/package-store-runtime', ['drainPackageCompatibilityOutbox']],
  ['../../server/services/generation-safe-save', ['savePackageProjection']],
])
  wrap(require(file), names)
wrap(require('../../server/services/pptx-import/package-store').PackageStore.prototype, [
  'getState',
  'getOwnedAuthorityState',
  'getAuthoritativeSaveSnapshot',
  'mutate',
  'commitProjectionSave',
  'acknowledgeCompatibilityWrites',
])
const session = new inspector.Session()
session.connect()
const post = promisify(session.post.bind(session))
const { startServer, stopServer } = require('../../server/index.js')
let server
let importProfilerRunning = false
let importStart, importCpu
const receipt = {
  source,
  root,
  output,
  diagnosticOnly: true,
  importProfile,
  phases,
  node: process.execPath,
}
const importProfileComplete = new Error('Import-only diagnostic complete')
function returnFromImportProfile() {
  throw importProfileComplete
}
let stage = 'admission'
try {
  server = await startServer(0, { host: '127.0.0.1' })
  const baseURL = `http://127.0.0.1:${server.address().port}`
  const deadline = Date.now() + 120000
  let readyResponse, readyBody
  do {
    readyResponse = await fetch(`${baseURL}/health/ready`)
    readyBody = await readyResponse.text()
    if (readyResponse.status === 200 && JSON.parse(readyBody).status === 'ready') break
    if (Date.now() >= deadline) throw Error(`Normal readiness timed out: ${readyBody}`)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    // eslint-disable-next-line no-constant-condition
  } while (true)
  receipt.ready = { status: readyResponse.status, body: readyBody }
  if (importProfile) {
    stage = 'import'
    await post('Profiler.enable')
    await post('Profiler.start')
    importProfilerRunning = true
    importStart = performance.now()
    importCpu = process.cpuUsage()
  }
  // APIRequestContext needs no browser; use the official fixture import helper unchanged.
  const { request } = await import('@playwright/test')
  const { importPptxWhenAvailable } =
    await import('../../tests/e2e/helpers/pptx-import-api-helper.js')
  const api = await request.newContext({ baseURL, timeout: 120000 })
  let imported
  try {
    imported = await importPptxWhenAvailable(
      api,
      {
        file: {
          name: path.basename(source),
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          buffer: await fs.readFile(source),
        },
      },
      importProfile ? { timeout: 120000, maxAttempts: 1 } : { timeout: 300000 }
    )
  } finally {
    await api.dispose()
  }
  receipt.presentationId = imported.presentationId
  const url = `${baseURL}/api/presentations/${imported.presentationId}`
  const initialResponse = await fetch(url)
  const initialBody = await initialResponse.text()
  receipt.initialGet = { status: initialResponse.status, bodyFile: 'initial-get-body.txt' }
  await fs.writeFile(path.join(output, 'initial-get-body.txt'), initialBody)
  if (readyResponse.status !== 200 || JSON.parse(readyBody).status !== 'ready')
    throw Error('Startup readiness admission failed')
  if (initialResponse.status !== 200) throw Error('Initial GET admission failed')
  const initial = JSON.parse(initialBody)
  if (!Array.isArray(initial.slides))
    throw Error('Initial GET admission failed: slides is not an array')
  receipt.initialGet.slides = initial.slides.length
  if (initial.slides.length !== 39) throw Error('Official fixture must retain all 39 slides')
  if (importProfile) {
    receipt.status = 'import-captured'
    returnFromImportProfile()
  }
  stage = 'prepare'
  const {
    semanticInstance,
    semanticDefinition,
    replaceSemanticRecords,
  } = require('revealjs-shared/src/pptx-semantic-records.js')
  const { normalizePptxSemanticDocument } = require('revealjs-shared/src/pptx-semantic-document.js')
  const { assertCanonicalTextEdit } = require('revealjs-shared/src/pptx-text-operations.js')
  let target
  for (const slide of initial.slides)
    for (const element of slide.elements || []) {
      const instance = semanticInstance(initial.pptxSemantic, element.pptxInstanceId)
      const sourceDoc = semanticDefinition(initial.pptxSemantic, instance?.definitionId)?.content
        ?.textDocument
      if (target || !sourceDoc) continue
      const document = structuredClone(
        instance.overrides?.components?.[sourceDoc.componentId]?.textDocument ?? sourceDoc
      )
      const run = document.paragraphs.flatMap((p) => p.runs).find((r) => r.kind === 'text')
      if (run) target = { slide, element, instance, document, run }
    }
  if (!target) throw Error('No canonical text target')
  const marker = ` NAV13:actual-put-${Date.now()}`
  target.run.text += marker
  const document = assertCanonicalTextEdit(
    initial.pptxSemantic,
    target.slide,
    target.element,
    target.document
  )
  const { instance, element } = target
  initial.pptxSemantic = normalizePptxSemanticDocument(
    replaceSemanticRecords(initial.pptxSemantic, {
      instances: {
        [element.pptxInstanceId]: {
          ...instance,
          overrides: {
            ...instance.overrides,
            components: {
              ...instance.overrides?.components,
              [document.componentId]: {
                ...instance.overrides?.components?.[document.componentId],
                textDocument: document,
              },
            },
          },
        },
      },
    })
  )
  element.content = (element.content || '') + marker
  const body = JSON.stringify(initial)
  stage = 'put'
  await post('Profiler.enable')
  await post('Profiler.start')
  active = true
  const start = performance.now(),
    cpu = process.cpuUsage()
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `actual-put-${Date.now()}` },
    body,
  })
  const text = await response.text()
  receipt.put = {
    status: response.status,
    ms: performance.now() - start,
    cpu: process.cpuUsage(cpu),
    requestBytes: Buffer.byteLength(body),
    responseBytes: Buffer.byteLength(text),
  }
  active = false
  const { profile } = await post('Profiler.stop')
  await fs.writeFile(path.join(output, 'put.cpuprofile'), JSON.stringify(profile), { flag: 'wx' })
  const self = new Map()
  for (let i = 0; i < (profile.samples || []).length; i++) {
    const id = profile.samples[i]
    self.set(id, (self.get(id) || 0) + (profile.timeDeltas[i] || 0))
  }
  receipt.topSelf = profile.nodes
    .map((node) => ({
      function: node.callFrame.functionName || '(anonymous)',
      source: node.callFrame.url,
      line: node.callFrame.lineNumber + 1,
      selfMs: (self.get(node.id) || 0) / 1000,
    }))
    .sort((a, b) => b.selfMs - a.selfMs)
    .slice(0, 25)
  await fs.writeFile(
    path.join(output, 'current-streaming-findings.md'),
    [
      '# Fresh official 39-slide import / current streaming PUT diagnostic',
      'Diagnostic only; not browser/native acceptance. Inclusive phase durations overlap.',
      `Source: ${source}; root: ${root}; HTTP ${response.status}; PUT ${receipt.put.ms.toFixed(3)} ms.`,
      '## Top self samples (sample time, not wall phase duration)',
      ...receipt.topSelf.map(
        (row) => `${row.selfMs.toFixed(3)} ms — ${row.function} — ${row.source}:${row.line}`
      ),
      '## Current instrumented phases (inclusive wall ms)',
      ...phases.map(
        (row) =>
          `${row.name}: ${row.ms.toFixed(3)} ms; CPU user ${row.cpu.user} µs, system ${row.cpu.system} µs`
      ),
    ].join('\n'),
    { flag: 'wx' }
  )
  if (response.status !== 200) throw Error(text)
  const saved = JSON.parse(text)
  receipt.generation = saved.aggregateGeneration
  if (saved.aggregateGeneration !== initial.aggregateGeneration + 1 || !text.includes(marker))
    throw Error('Save oracle failed')
  const get = await (await fetch(url)).json()
  receipt.authoritative = {
    generation: get.aggregateGeneration,
    marker: JSON.stringify(get).includes(marker),
  }
  if (get.aggregateGeneration !== saved.aggregateGeneration || !receipt.authoritative.marker)
    throw Error('Authority oracle failed')
  receipt.status = 'captured'
} catch (e) {
  if (e !== importProfileComplete) {
    receipt.status = stage === 'admission' ? 'admission-failed' : 'failed'
    receipt.error = e.stack
    process.exitCode = 1
  }
} finally {
  active = false
  if (importProfilerRunning) {
    receipt.import = {
      ms: performance.now() - importStart,
      cpu: process.cpuUsage(importCpu),
      timeoutMs: 120000,
    }
    try {
      const { profile } = await post('Profiler.stop')
      await fs.writeFile(path.join(output, 'import.cpuprofile'), JSON.stringify(profile), {
        flag: 'wx',
      })
      const nodes = new Map(profile.nodes.map((node) => [node.id, node]))
      const parents = new Map()
      for (const node of profile.nodes)
        for (const child of node.children || []) parents.set(child, node.id)
      const self = new Map(),
        inclusive = new Map()
      for (let i = 0; i < (profile.samples || []).length; i++) {
        const id = profile.samples[i],
          delta = profile.timeDeltas[i] || 0
        self.set(id, (self.get(id) || 0) + delta)
        for (let ancestor = id; ancestor !== undefined; ancestor = parents.get(ancestor))
          inclusive.set(ancestor, (inclusive.get(ancestor) || 0) + delta)
      }
      const frame = (id) => {
        const node = nodes.get(id)
        return `${node.callFrame.functionName || '(anonymous)'} — ${node.callFrame.url}:${node.callFrame.lineNumber + 1}`
      }
      const rows = profile.nodes.map((node) => {
        const callers = []
        for (let id = parents.get(node.id); id !== undefined; id = parents.get(id))
          callers.push(frame(id))
        return {
          frame: frame(node.id),
          selfMs: (self.get(node.id) || 0) / 1000,
          inclusiveMs: (inclusive.get(node.id) || 0) / 1000,
          callers,
        }
      })
      receipt.topSelf = [...rows].sort((a, b) => b.selfMs - a.selfMs).slice(0, 40)
      receipt.topInclusive = [...rows].sort((a, b) => b.inclusiveMs - a.inclusiveMs).slice(0, 40)
      await fs.writeFile(
        path.join(output, 'import-findings.md'),
        [
          '# Fresh full-fixture import CPU diagnostic (not save)',
          `Source: ${source}; isolated data root: ${root}; Node: ${process.execPath}`,
          `Status: ${receipt.status}; elapsed: ${receipt.import.ms.toFixed(3)} ms; poll deadline: 120000 ms.`,
          receipt.error || '',
          '## Top self samples and ancestors (nearest caller first)',
          ...receipt.topSelf.map(
            (row) =>
              `${row.selfMs.toFixed(3)} ms self; ${row.inclusiveMs.toFixed(3)} ms inclusive — ${row.frame}\n  callers: ${row.callers.join(' <- ')}`
          ),
          '## Top inclusive samples',
          ...receipt.topInclusive.map((row) => `${row.inclusiveMs.toFixed(3)} ms — ${row.frame}`),
        ].join('\n'),
        { flag: 'wx' }
      )
    } catch (error) {
      receipt.profileError = error.stack
      process.exitCode = 1
    }
  }
  session.disconnect()
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt, null, 2))
  if (server) await stopServer(server)
}
