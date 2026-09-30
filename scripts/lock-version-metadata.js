const fs = require('node:fs')

const releaseVersionPattern = /^\d+\.\d+\.\d+$/

function syncLockVersionMetadata(lock, { version, identities }) {
  if (!releaseVersionPattern.test(version)) {
    throw new Error(`Invalid product version: ${version}`)
  }
  if (lock?.lockfileVersion !== 3 || !lock.packages) {
    throw new Error('Lock metadata synchronization requires package-lock v3')
  }

  const clone = JSON.parse(JSON.stringify(lock))
  const changedFields = []
  const rootIdentity = identities['']
  if (rootIdentity && clone.name !== rootIdentity) {
    throw new Error(`Lock identity mismatch: expected ${rootIdentity}, got ${clone.name}`)
  }

  if (clone.version !== version) {
    clone.version = version
    changedFields.push('version')
  }

  for (const [packagePath, expectedName] of Object.entries(identities)) {
    const entry = clone.packages[packagePath]
    if (!entry) {
      throw new Error(`Missing package entry: ${packagePath || '<root>'}`)
    }
    if (entry.name !== expectedName) {
      throw new Error(
        `Lock identity mismatch at ${packagePath || '<root>'}: expected ${expectedName}, got ${entry.name}`
      )
    }
    if (entry.version !== version) {
      entry.version = version
      changedFields.push(`packages[${JSON.stringify(packagePath)}].version`)
    }
  }

  return { lock: clone, changedFields }
}

function writeLockVersionMetadata({ lockPath, version, identities, validate }) {
  const originalText = fs.readFileSync(lockPath, 'utf8')
  const originalLock = JSON.parse(originalText)
  const result = syncLockVersionMetadata(originalLock, { version, identities })
  validate?.(result.lock)
  if (result.changedFields.length > 0) {
    fs.writeFileSync(lockPath, `${JSON.stringify(result.lock, null, 2)}\n`)
  }
  return result
}

module.exports = { syncLockVersionMetadata, writeLockVersionMetadata }
