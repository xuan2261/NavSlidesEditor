// Test-only deterministic startup candidate barrier; no production import.
const path = require('node:path')
const fs = require('fs-extra')
const promises = require('node:fs/promises')
module.exports = function installStartupBarrier(mode, data) {
  const runtime = require('./services/pptx-import/package-store-runtime')
  let release
  const released = new Promise((resolve) => { release = resolve })
  let entered = false
  async function pause(file) {
    if (entered) return
    entered = true
    process.send({ type: 'checkpoint', boundary: mode, candidate: path.basename(file) })
    await released
  }
  process.on('message', (message) => { if (message?.type === 'release-recovery') release() })
  if (mode === 'restart-pptx-apply-timeout') {
    const write = fs.writeJson
    fs.writeJson = async (file, ...args) => {
      const result = await write(file, ...args)
      if (String(file).startsWith(path.join(data, 'presentations.json.tmp.'))) await pause(file)
      return result
    }
  } else {
    const write = promises.writeFile
    promises.writeFile = async (file, ...args) => {
      const result = await write(file, ...args)
      if (String(file).startsWith(path.join(data, 'state-root.json.')) && String(file).endsWith('.tmp')) await pause(file)
      return result
    }
  }
  const drain = runtime.drainPackageCompatibilityOutbox
  runtime.drainPackageCompatibilityOutbox = async (...args) => {
    try { return await drain(...args) }
    finally { if (entered) process.send({ type: 'recovery-settled' }) }
  }
}
