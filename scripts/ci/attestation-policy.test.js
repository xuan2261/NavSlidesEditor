import { describe, expect, it } from 'vitest'
import { verifyArtifactAttestations } from './attestation-policy.mjs'

const subjectSha = 'a'.repeat(40)
const clientDigest = 'b'.repeat(64)
const workflowIdentity =
  'https://github.com/xuan2261/NavSlidesEditor/.github/workflows/reusable-green-sha-verification.yml@refs/heads/master'
const artifact = (id, digest) => ({
  id,
  digest,
  subjectSha,
  clientDigest,
  workflowIdentity,
  issuer: 'https://token.actions.githubusercontent.com',
  verified: true,
  bundleHash: 'c'.repeat(64),
})

describe('artifact attestation policy', () => {
  it('requires workflow-bound verification for every selected artifact', () => {
    expect(
      verifyArtifactAttestations({
        requiredArtifactIds: ['client-dist', 'docker-image', 'electron-windows'],
        subjectSha,
        clientDigest,
        workflowIdentity,
        attestations: [
          artifact('client-dist', '1'.repeat(64)),
          artifact('docker-image', '2'.repeat(64)),
          artifact('electron-windows', '3'.repeat(64)),
        ],
      })
    ).toHaveLength(3)
  })

  it.each([
    ['missing artifact', []],
    ['wrong subject', [{ ...artifact('client-dist', '1'.repeat(64)), subjectSha: 'd'.repeat(40) }]],
    ['wrong workflow', [{ ...artifact('client-dist', '1'.repeat(64)), workflowIdentity: 'other' }]],
    ['wrong issuer', [{ ...artifact('client-dist', '1'.repeat(64)), issuer: 'other' }]],
    ['unverified bundle', [{ ...artifact('client-dist', '1'.repeat(64)), verified: false }]],
  ])('fails closed for %s', (_label, attestations) => {
    expect(() =>
      verifyArtifactAttestations({
        requiredArtifactIds: ['client-dist'],
        subjectSha,
        clientDigest,
        workflowIdentity,
        attestations,
      })
    ).toThrow()
  })
})
