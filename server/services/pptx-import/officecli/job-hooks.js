const crypto = require('node:crypto')
const { createJobCapability } = require('./security')

function randomJobId() {
  return `officecli-${crypto.randomBytes(16).toString('hex')}`
}

function createPackageStoreJobHooks(packageStore) {
  if (!packageStore || typeof packageStore.putJob !== 'function') {
    throw new TypeError('Package store job persistence is required')
  }
  return {
    async create({ kind = 'export' } = {}) {
      const id = randomJobId()
      const capability = createJobCapability()
      await packageStore.putJob({
        id,
        kind,
        status: 'queued',
        capabilityHash: capability.capabilityHash,
        provisionalOwner: { ownerType: 'job', ownerId: id },
      })
      return Object.freeze({ id, capability: capability.capability })
    },
    async update(job, status) {
      const existing = packageStore.getJob(job.id)
      if (!existing) throw new Error('Unknown durable OfficeCLI job')
      await packageStore.putJob({ ...existing, status })
      return packageStore.getJob(job.id)
    },
  }
}

module.exports = { createPackageStoreJobHooks }
