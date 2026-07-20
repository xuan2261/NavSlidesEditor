const path = require('node:path')
const { createSyncJobManifest } = require('./sync-job-manifest')

describe('sync job manifest', () => {
  it('pins heads and isolates immutable per-job workspaces', () => {
    const input = {
      jobId: 'job_1',
      workspaceRoot: path.resolve('sync-jobs'),
      destination: 'remote:/deck',
      heads: [{ presentationId: 'deck', packageRevisionId: 'r1', generation: 4 }],
    }
    const first = createSyncJobManifest(input)
    input.heads[0].generation = 5
    const second = createSyncJobManifest({ ...input, jobId: 'job_2' })

    expect(first.workspace).not.toBe(second.workspace)
    expect(first.pinnedHeads[0].generation).toBe(4)
    expect(first.manifestHash).toMatch(/^[a-f0-9]{64}$/)
    expect(Object.isFrozen(first)).toBe(true)
  })
})
