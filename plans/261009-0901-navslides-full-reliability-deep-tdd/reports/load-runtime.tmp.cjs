const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
async function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('k6', args, { stdio: 'inherit', windowsHide: true })
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve({ code, signal }))
  })
}
async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-final-load-'))
  process.env.SLIDES_DATA_DIR = path.join(root, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
  process.env.NODE_ENV = 'production'
  const service = require(path.resolve('server/index.js'))
  const receipt = { status: 'running', kind: 'actual-production-loopback-k6-smoke', profile: 'smoke', observations: [], userDataTouched: false, limits: ['Working-tree application; not packaged/container or release qualification'] }
  let server
  try {
    server = await service.startServer(0, { host: '127.0.0.1' })
    const base = `http://127.0.0.1:${server.address().port}`
    for (const [label, script] of [['api', 'tests/load/k6-load-test-api-presentations-post-endpoint-with-profiles.js'], ['websocket', 'tests/load/k6-load-test-socketio-websocket-room-join-and-slide-change-broadcast.js']]) {
      const summary = `plans/261009-0901-navslides-full-reliability-deep-tdd/reports/load-${label}-final-summary.json`
      const args = ['run', '-e', 'PROFILE=smoke', '-e', `API_BASE_URL=${base}/api`, '-e', `WS_URL=${base.replace('http:', 'ws:')}/ws/?EIO=4&transport=websocket`, '--summary-export', summary, script]
      const result = await run(args)
      receipt.observations.push({ label, command: ['k6', ...args], ...result, summary })
      if (result.code !== 0) throw new Error(`${label} k6 exited ${result.code}/${result.signal}`)
    }
    receipt.status = 'passed'
  } catch (error) { receipt.status = 'failed'; receipt.error = error.stack; process.exitCode = 1 }
  finally {
    if (server) await service.stopServer(server)
    await fs.rm(root, { recursive: true, force: true })
    receipt.ownedRootRemoved = true
    await fs.writeFile('plans/261009-0901-navslides-full-reliability-deep-tdd/reports/load-runtime-final.json', JSON.stringify(receipt, null, 2))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
