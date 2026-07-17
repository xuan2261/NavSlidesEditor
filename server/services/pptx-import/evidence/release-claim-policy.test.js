import { describe, expect, it } from 'vitest'
import policy from './release-claim-policy.js'

const { claimForWording, requiredLanes, protectedReleaseAvailability } = policy

describe('Phase 13 release claim policy', () => {
  it('selects claim and target lanes cumulatively', () => {
    expect(requiredLanes('original-recovery', ['server'])).toContain('native-import')
    expect(requiredLanes('valid-edited-package', ['electron'])).toEqual(expect.arrayContaining([
      'exact-original', 'opc-graph', 'resource', 'electron-package-no-officecli',
    ]))
    expect(requiredLanes('feature-editability', ['docker'])).toContain('docker-package-no-officecli')
  })

  it('maps product wording to the maximum claim it implies', () => {
    expect(claimForWording('Recover the exact original PPTX')).toBe('original-recovery')
    expect(claimForWording('Covered chart features remain editable')).toBe('feature-editability')
    expect(claimForWording('PowerPoint compatible with 1:1 visual fidelity'))
      .toBe('powerpoint-compatibility-visual-fidelity')
  })

  it('keeps level 5 unavailable without protected provider configuration', () => {
    expect(protectedReleaseAvailability({})).toMatchObject({
      available: false, authoritative: false, reason: 'protected-provider-unavailable',
    })
    expect(protectedReleaseAvailability({
      protected: true, runner: 'local', trustRoot: 'configured',
    }).available).toBe(false)
    expect(protectedReleaseAvailability({
      evaluation: {
        outcome: 'verified',
        passed: true,
        claimLevel: 'powerpoint-compatibility-visual-fidelity',
        evidence: {
          protectedProvider: true,
          independentExternalSigner: true,
          immutableArtifact: true,
          teardownAttestation: true,
        },
      },
    })).toMatchObject({ available: true, authoritative: true, reason: null })
  })
})
