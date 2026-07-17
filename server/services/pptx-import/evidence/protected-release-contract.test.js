import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import policy from './release-claim-policy.js'

describe('protected release infrastructure contract', () => {
  it('remains explicitly unavailable until a dedicated protected workflow exists', () => {
    const workflow = path.resolve('.github/workflows/pptx-protected-claim.yml')
    expect(fs.existsSync(workflow)).toBe(false)
    expect(policy.protectedReleaseAvailability({
      protected: false,
      runner: 'github-hosted',
      artifactOnly: false,
    })).toMatchObject({
      available: false,
      authoritative: false,
      reason: 'protected-provider-unavailable',
    })
  })
})
