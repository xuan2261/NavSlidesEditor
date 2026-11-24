// Test-only persisted-transition observers. Every intercepted IO call is passed through.
const fs = require('fs-extra')
const path = require('node:path')
if (process.env.NAVSLIDES_CRASH_TEST_HARNESS !== '1') throw new Error('Owned crash harness only')
const mode = process.argv[2]
let armed
async function pause() {
  process.send({ type: 'checkpoint', boundary: mode, sessionId: armed })
  await new Promise(() => {})
}
async function main() {
  const storage = require('./services/storage')
  const sessions = require('./services/project-import-media-session-store')
  const owners = require('./services/media-placement-ownership')
  const update = sessions.updateSession
  sessions.updateSession = async (...args) => {
    const result = await update(...args)
    if (armed && args[0] === armed && mode === 'prepublication') {
      const record = await sessions.readSession(armed)
      if (record.packageOutcome) await pause()
    }
    return result
  }
  const apply = storage.withPresentations
  storage.withPresentations = async (...args) => {
    const result = await apply(...args)
    if (armed && mode === 'raw-applied') {
      const record = await sessions.readSession(armed)
      if ((await storage.readPresentations()).some((row) => row.id === record.intendedPresentationId)) await pause()
    }
    return result
  }
  const commit = owners.commitOwner
  owners.commitOwner = async (...args) => {
    const result = await commit(...args)
    if (armed && args[0] === armed && mode === 'owner-committed') await pause()
    return result
  }
  const unlink = fs.unlink
  fs.unlink = async (...args) => {
    const result = await unlink(...args)
    if (armed && mode === 'cleanup-partial') {
      const record = await sessions.readSession(armed)
      if (record.media.some((item) => path.resolve(item.stagingPath) === path.resolve(args[0]))) await pause()
    }
    return result
  }
  const runtime = require('./index')
  const server = await runtime.startServer(0, { host: '127.0.0.1' })
  const packageRuntime = require('./services/pptx-import/package-store-runtime')
  const metadata = packageRuntime.getPackageStore().metadata
  const publish = metadata.publish.bind(metadata)
  metadata.publish = async (...args) => {
    const result = await publish(...args)
    if (armed && mode === 'root-committed') {
      const record = await sessions.readSession(armed)
      if (args[0].heads.some((head) => head.presentationId === record.intendedPresentationId)) await pause()
    }
    return result
  }
  if (mode !== 'restart') {
    const { png } = require('./portable-process-fixture.cjs')
    const unrelated = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><rect width="1" height="1" fill="blue"/></svg>')
    for (const [id, bytes, name, mimeType] of [['retained-winner', png, 'winner.png', 'image/png'],
      ['unrelated', unrelated, 'unrelated.svg', 'image/svg+xml']]) {
      const placed = await owners.placeMedia({ ownerId: id, bytes, originalName: name, mimeType, sourceKey: id })
      await owners.commitOwner(id, id)
      await storage.withPresentations((rows) => rows.push({ id, title: id,
        slides: [{ id: `${id}-slide`, elements: [{ id: `${id}-image`, type: 'image', src: `/uploads/${placed.filename}` }] }] }))
    }
  }
  process.on('message', (message) => {
    if (message?.type === 'arm' && mode !== 'restart' && !armed) {
      armed = message.sessionId
      process.send({ type: 'armed' })
    }
  })
  process.send({ type: 'ready', url: `http://127.0.0.1:${server.address().port}` })
}
main().catch((error) => {
  process.send?.({ type: 'failure', code: error.code || error.name })
  process.exit(1)
})
