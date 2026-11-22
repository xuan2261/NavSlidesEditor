// Diagnostic-only instrumentation in the owned server, never the observer or production source.
import { Session } from 'node:inspector'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import { writeFile, appendFile } from 'node:fs/promises'
import path from 'node:path'

export function installSaveCpuDiagnostic(output) {
  const require = createRequire(import.meta.url)
  const Module = require('node:module')
  const root = path.resolve('server/services/pptx-import')
  const targets = new Map([
    ['canonical-snapshot.js', ['canonicalSaveSnapshot']],
    ['semantic-baseline.js', ['assertSemanticBaseline']],
    ['mutation-journal.js', ['deriveMutationJournal']],
    ['package-store/index.js', ['commitProjectionSave', 'acknowledgeCompatibilityWrites']],
    ['package-store/prepared-publication.js', ['prepareStreamingPublication']],
    ['package-store/durable-fs.js', ['writeHashedCandidate']],
  ].map(([file, names]) => [path.join(root, file), names]))
  const files = { cpu: path.join(output, 'server-save.cpuprofile'),
    phases: path.join(output, 'server-save-phases.json'), errors: path.join(output, 'server-save-diagnostic-errors.jsonl') }
  const counts = {}, wrapped = new WeakSet()
  let active = false, session, started, stopped, stopping
  const post = (method) => new Promise((resolve, reject) => session.post(method,
    (error, result) => error ? reject(error) : resolve(result)))
  const originalLoad = Module._load
  // Patch on module return, before any consumer can destructure an export.
  Module._load = function (request, parent, isMain) {
    const filename = Module._resolveFilename(request, parent, isMain)
    const exports = originalLoad.apply(this, arguments)
    const names = targets.get(filename)
    if (names) {
      const owner = filename === path.join(root, 'package-store/index.js') ? exports.PackageStore.prototype : exports
      for (const name of names) {
        const original = owner[name]
        if (wrapped.has(original)) continue
        if (typeof original !== 'function') throw new Error(`Missing diagnostic phase: ${name}`)
        counts[name] = { calls: 0, completed: 0, failed: 0, elapsedMs: 0 }
        const wrapper = function (...args) {
          if (!active) return Reflect.apply(original, this, args)
          const row = counts[name], start = performance.now()
          row.calls++
          const finish = (failed) => { row.completed++; row.failed += Number(failed); row.elapsedMs += performance.now() - start }
          let result
          try { result = Reflect.apply(original, this, args) }
          catch (error) { finish(true); throw error }
          if (result && typeof result.then === 'function') {
            return result.then((value) => { finish(false); return value }, (error) => { finish(true); throw error })
          }
          finish(false)
          return result
        }
        wrapped.add(wrapper)
        owner[name] = wrapper
      }
    }
    return exports
  }
  async function failure(error) {
    console.error('Save CPU diagnostic failed', error)
    await appendFile(files.errors, `${JSON.stringify({ at: Date.now(), error: error.stack || String(error) })}\n`)
  }
  async function stop() {
    if (stopping) return stopping
    stopping = (async () => {
      active = false
      const errors = []
      try {
        if (started) {
          const { profile } = await post('Profiler.stop')
          stopped = Date.now()
          await writeFile(files.cpu, JSON.stringify(profile), { flag: 'wx' })
        }
      } catch (error) { errors.push(error); await failure(error) }
      finally { session?.disconnect() }
      try {
        await writeFile(files.phases, JSON.stringify({ pid: process.pid, diagnosticOnly: true,
          qualificationEligible: false, started, stopped, counts,
          timing: 'inclusive wall time; nested phases overlap', errors: errors.map(String) }, null, 2), { flag: 'wx' })
      } catch (error) { errors.push(error); await failure(error) }
      if (errors.length) throw new AggregateError(errors, 'Save diagnostic stop failed')
      return files
    })()
    return stopping
  }
  return { files, stop, async handle(message, send) {
    if (!['save-profile-start', 'save-profile-stop'].includes(message?.type)) return
    try {
      if (message.type === 'save-profile-start') {
        if (session || stopping) throw new Error('Save profiler already requested')
        if (Object.keys(counts).length !== 7) throw new Error('Save phase wrappers incomplete')
        session = new Session(); session.connect()
        await post('Profiler.enable'); await post('Profiler.start')
        started = Date.now(); active = true
      } else await stop()
      await send({ type: 'save-profile-result', id: message.id, pid: process.pid, files })
    } catch (error) {
      await failure(error)
      await send({ type: 'save-profile-result', id: message.id, pid: process.pid, error: error.stack || String(error), files })
    }
  } }
}
