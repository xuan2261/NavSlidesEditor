// The owner supplies isolation at spawn, before loading production modules.
import { createRequire } from 'node:module'
import path from 'node:path'
const require = createRequire(import.meta.url)
let server, stopServer, stopping, diagnostic, disconnected = false
const send = (message) => new Promise((resolve, reject) => {
  if (!process.connected) return reject(new Error('Owner IPC disconnected'))
  process.send(message, (error) => error ? reject(error) : resolve())
})
function shutdown() {
  if (stopping) return stopping
  stopping = (async () => {
    try {
      await diagnostic?.stop()
      await stopServer?.(server)
      await send({ type: 'stopped', pid: process.pid })
      process.exit(0)
    } catch (error) {
      console.error('Owned server shutdown failed', error)
      await send({ type: 'shutdown-error', error: error.stack || String(error) }).catch(() => {})
      process.exit(1)
    }
  })()
  return stopping
}
process.on('disconnect', () => { disconnected = true; if (server) void shutdown() })
try {
  if (process.env.NATIVE_SAVE_CPU_PROFILE === '1') {
    const { installSaveCpuDiagnostic } = await import('./save-cpu-diagnostic.mjs')
    diagnostic = installSaveCpuDiagnostic(process.env.NATIVE_SAVE_REPORT_DIR)
  }
  const runtime = require(path.resolve('server/index.js'))
  stopServer = runtime.stopServer
  server = await runtime.startServer(0, { host: '127.0.0.1' })
  if (disconnected) await shutdown()
  process.on('message', (message) => {
    if (message?.type === 'stop') void shutdown()
    else if (diagnostic) void diagnostic.handle(message, send)
  })
  const port = server.address().port
  const response = await fetch(`http://127.0.0.1:${port}/health/ready`, { signal: AbortSignal.timeout(30000) })
  if (response.status !== 200) throw new Error(`Production readiness failed: ${response.status} ${await response.text()}`)
  await response.arrayBuffer()
  await send({ type: 'ready', pid: process.pid, port })
} catch (error) {
  console.error('Owned server startup failed', error)
  await send({ type: 'startup-error', error: error.stack || String(error) }).catch(() => {})
  await shutdown()
}
