// Operator proof only: native importer and production HTTP routes, with an IPC drain barrier.
const runtime = require('./services/pptx-import/package-store-runtime')
if (process.env.NAVSLIDES_CRASH_TEST_HARNESS !== '1') throw new Error('Isolated harness only')
const drain = runtime.drainPackageCompatibilityOutbox
let armed = false
let release
const released = new Promise((resolve) => { release = resolve })
const timer = setTimeout(() => {
  process.send?.({ type: 'failure', code: 'PUBLICATION_BARRIER_DEADLINE' })
  process.exit(1)
}, 90000)
process.on('message', (message) => {
  if (message?.type === 'release') release()
  if (message?.type === 'authority') {
    const state = runtime.getPackageStore().getState()
    const head = state.heads.find((entry) => entry.presentationId === message.presentationId)
    const authority = [...state.mutationResults].reverse().find((entry) =>
      entry.presentationId === message.presentationId && entry.state === 'committed')
    process.send({ type: 'authority', head, sourceMap: authority?.sourceMap,
      owners: state.owners.filter((entry) => entry.ownerType === 'presentation' && entry.ownerId === message.presentationId) })
  }
})
runtime.drainPackageCompatibilityOutbox = async (...args) => {
  const state = runtime.getPackageStore().getState()
  if (armed && state.compatibilityOutbox.length) {
    armed = false
    const write = state.compatibilityOutbox[0]
    process.send({ type: 'paused', presentationId: write.presentationId })
    await released
  }
  return drain(...args)
}
const jobs = require('./services/pptx-import-job-manager')
const complete = jobs.completeJob
jobs.completeJob = (...args) => {
  const result = complete(...args)
  process.send({ type: 'completed', jobId: args[0] })
  clearTimeout(timer)
  return result
}
require('./index').startServer(0, { host: '127.0.0.1' }).then((server) => {
  armed = true
  process.send({ type: 'ready', url: `http://127.0.0.1:${server.address().port}` })
}).catch((error) => {
  process.send?.({ type: 'failure', code: error.code || error.name })
  process.exit(1)
})
