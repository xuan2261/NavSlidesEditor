const crypto = require('node:crypto')
const path = require('node:path')

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) =>
      `${JSON.stringify(key)}:${canonical(value[key])}`
    ).join(',')}}`
  }
  return JSON.stringify(value)
}

function createSyncJobManifest({ jobId, workspaceRoot, destination, heads }) {
  if (!/^[a-zA-Z0-9_-]+$/.test(jobId)) throw new TypeError('Invalid sync job id')
  if (!path.isAbsolute(workspaceRoot)) throw new TypeError('Workspace root must be absolute')
  const workspace = path.join(workspaceRoot, jobId)
  const pinnedHeads = (heads || []).map((head) => ({
    presentationId: head.presentationId,
    packageRevisionId: head.packageRevisionId,
    generation: head.generation,
  })).sort((a, b) => a.presentationId.localeCompare(b.presentationId))
  const immutable = {
    schemaVersion: 1,
    jobId,
    workspace,
    destination,
    pinnedHeads,
  }
  return Object.freeze({
    ...immutable,
    manifestHash: crypto.createHash('sha256').update(canonical(immutable)).digest('hex'),
  })
}

module.exports = { createSyncJobManifest }
