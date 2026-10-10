const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const { fork } = require('node:child_process')
const { sha } = require('./portable-process-fixture.cjs')
function launch(root, mode) {
  const child = fork(path.join(__dirname, 'portable-process-child.cjs'), [mode], {
    execArgv: [], silent: true, windowsHide: true,
    env: { ...process.env, NODE_ENV: 'test', NAVSLIDES_CRASH_TEST_HARNESS: '1',
      SLIDES_DATA_DIR: path.join(root, 'data'), SLIDES_UPLOADS_DIR: path.join(root, 'uploads') },
  })
  const messages = [], waiters = new Set()
  let exit, failure
  child.stdout.resume(); child.stderr.resume()
  const closed = new Promise((resolve) => child.once('close', (code, signal) => {
    exit = { code, signal }; resolve(exit)
    for (const waiter of waiters) waiter.reject(new Error(`Owned child exited: ${code}/${signal}`))
  }))
  child.on('error', (error) => { failure = error; for (const waiter of waiters) waiter.reject(error) })
  child.on('message', (message) => {
    if (message?.type === 'failure') {
      failure = new Error(`Owned child failure: ${message.code}`)
      for (const waiter of waiters) waiter.reject(failure)
    } else { messages.push(message); for (const waiter of waiters) waiter.deliver() }
  })
  return {
    arm(sessionId) { child.send({ type: 'arm', sessionId }) },
    next(type) {
      return new Promise((resolve, reject) => {
        const waiter = {
          reject(error) { clearTimeout(timer); waiters.delete(waiter); reject(error) },
          deliver() {
            const index = messages.findIndex((message) => message?.type === type)
            if (index < 0) return
            clearTimeout(timer); waiters.delete(waiter); resolve(messages.splice(index, 1)[0])
          },
        }
        const timer = setTimeout(() => waiter.reject(new Error(`IPC deadline: ${type}`)), 30000)
        waiters.add(waiter)
        if (failure) waiter.reject(failure)
        else if (exit) waiter.reject(new Error('Owned child already exited'))
        else waiter.deliver()
      })
    },
    async kill() {
      if (!exit && !child.kill('SIGKILL')) throw new Error('Owned SIGKILL rejected')
      return Promise.race([closed, new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error('Owned process kill deadline')), 10000)
        closed.finally(() => clearTimeout(timer))
      })])
    },
  }
}
async function request(url, target, observations, options = {}) {
  const response = await fetch(url + target, { ...options, signal: options.signal || AbortSignal.timeout(15000) })
  const bytes = Buffer.from(await response.arrayBuffer())
  observations.push({ method: options.method || 'GET', target, status: response.status, sha256: sha(bytes), byteLength: bytes.length })
  return { status: response.status, bytes, json: () => JSON.parse(bytes.toString()) }
}
function editor(url, capability) {
  return { Origin: url, Referer: `${url}/`, 'Sec-Fetch-Site': 'same-origin',
    ...(capability ? { 'X-NavSlides-Import-Capability': capability } : {}) }
}
async function json(root, name) { return JSON.parse(await fs.readFile(path.join(root, 'data', name), 'utf8')) }
async function snapshot(root, sessionId) {
  const store = await require('./services/pptx-import/package-store').openPackageStore({ rootDir: path.join(root, 'data') })
  const pointer = store.metadata.root
  const state = store.getState()
  const rows = await json(root, 'presentations.json')
  const sessions = await json(root, 'project-import-sessions.json')
  const hashes = await json(root, 'upload-hashes.json')
  const session = sessions[sessionId]
  assert.ok(session)
  const id = session.intendedPresentationId
  const files = []
  for (const name of (await fs.readdir(path.join(root, 'uploads'))).sort()) {
    const bytes = await fs.readFile(path.join(root, 'uploads', name))
    files.push({ name, sha256: sha(bytes), byteLength: bytes.length })
  }
  return { pointer, state, rows, sessions, hashes, session, id, files }
}
function safeSnapshot(value) {
  const { pointer, state, rows, hashes, files, session, sessions } = value
  // Never serialize capabilities, salts, capability hashes or replay hashes.
  return { rootSha256: sha(JSON.stringify(pointer)), stateSha256: sha(JSON.stringify(state)),
    rowsSha256: sha(JSON.stringify(rows)), ownershipSha256: sha(JSON.stringify(hashes)),
    sessionLedgerSha256: sha(JSON.stringify(sessions)),
    session: { sessionId: session.sessionId, state: session.state, intendedPresentationId: session.intendedPresentationId,
      archiveDigest: session.archiveDigest, payloadDigest: session.payloadDigest,
      packageOutcome: session.packageOutcome, placements: session.placements },
    files }
}
module.exports = { launch, request, editor, snapshot, safeSnapshot, json }
