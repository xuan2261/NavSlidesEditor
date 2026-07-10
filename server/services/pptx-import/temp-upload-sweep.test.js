import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import sweep from './temp-upload-sweep.js'

describe('PPTX stale temp upload sweep', () => {
  it('removes only stale UUID PPTX uploads and preserves fresh, active, and unrelated files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-sweep-'))
    const stale = path.join(dir, '11111111-1111-4111-8111-111111111111.pptx')
    const active = path.join(dir, '22222222-2222-4222-8222-222222222222.pptx')
    const fresh = path.join(dir, '33333333-3333-4333-8333-333333333333.pptx')
    const unrelated = path.join(dir, 'notes.pptx')
    try {
      await Promise.all([stale, active, fresh, unrelated].map((file) => fs.writeFile(file, 'x')))
      const old = new Date(Date.now() - 10_000)
      await fs.utimes(stale, old, old)
      await fs.utimes(active, old, old)

      const removed = await sweep.sweepStaleTempUploads(dir, {
        maxAgeMs: 5_000,
        activePaths: new Set([active]),
      })

      expect(removed).toEqual([stale])
      expect((await fs.readdir(dir)).sort()).toEqual([
        path.basename(active), path.basename(fresh), path.basename(unrelated),
      ].sort())
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
