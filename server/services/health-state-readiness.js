const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

async function assertWritableRoot(rootDir) {
  const probe = path.join(rootDir, `.navslides-write-probe-${process.pid}-${crypto.randomUUID()}`)
  try {
    await fs.writeFile(probe, '', { flag: 'wx', mode: 0o600 })
  } finally {
    await fs.rm(probe, { force: true }).catch(() => {})
  }
}

function durableRecoveryReason(state) {
  if (Array.isArray(state?.compatibilityDeadLetter) && state.compatibilityDeadLetter.length) {
    return 'DURABLE_RECOVERY_REQUIRED'
  }
  if (Array.isArray(state?.jobs) && state.jobs.some((job) => job?.reconcileRequired === true)) {
    return 'DURABLE_RECOVERY_REQUIRED'
  }
  return null
}

module.exports = {
  assertWritableRoot,
  durableRecoveryReason,
}
