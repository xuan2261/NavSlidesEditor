import { describe, expect, it } from 'vitest'
import { verifyAuthenticodeEvidence } from './authenticode-policy.mjs'

const digest = 'a'.repeat(64)
const thumbprint = 'B'.repeat(40)
const expected = {
  publisherSubject: 'CN=NavSlides Editor Release',
  publisherThumbprint: thumbprint,
}
const verification = {
  status: 'Valid',
  signerSubject: expected.publisherSubject,
  signerThumbprint: thumbprint,
  timestamp: {
    type: 'RFC3161',
    trusted: true,
    value: '2026-09-25T06:31:00.000Z',
  },
  certificate: {
    notBefore: '2026-01-01T00:00:00.000Z',
    notAfter: '2027-01-01T00:00:00.000Z',
  },
}

describe('Authenticode release policy', () => {
  it('requires approved identity, trusted timestamp, hash, and post-download verification', () => {
    expect(
      verifyAuthenticodeEvidence({
        expected,
        evidence: {
          path: 'NavSlides-Editor-Setup.exe',
          sha256: digest,
          expectedSha256: digest,
          preUpload: verification,
          postDownload: verification,
        },
      })
    ).toMatchObject({ verified: true, sha256: digest })
  })

  it.each([
    ['unsigned', { preUpload: { ...verification, status: 'NotSigned' } }],
    ['publisher', { preUpload: { ...verification, signerSubject: 'CN=Other' } }],
    ['thumbprint', { preUpload: { ...verification, signerThumbprint: 'C'.repeat(40) } }],
    ['timestamp', { preUpload: { ...verification, timestamp: null } }],
    ['post-download', { postDownload: null }],
    ['hash', { sha256: 'c'.repeat(64) }],
  ])('fails closed on invalid %s evidence', (_label, patch) => {
    expect(() =>
      verifyAuthenticodeEvidence({
        expected,
        evidence: {
          path: 'NavSlides-Editor-Setup.exe',
          sha256: digest,
          expectedSha256: digest,
          preUpload: verification,
          postDownload: verification,
          ...patch,
        },
      })
    ).toThrow()
  })
})
