import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import {
  WINDOWS_SIGNING_ENV_KEYS,
  resolveWindowsSigningMode,
  verifyAuthenticodeEvidence,
  verifyUnsignedWindowsEvidence,
} from './authenticode-policy.mjs'

const policy = createRequire(import.meta.url)('../../config/release-target-policy.json')
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
  it('resolves signed vs authenticode-unsigned and fails closed on partial env subsets', () => {
    const full = {
      WINDOWS_SIGNING_SCRIPT: '/ext/sign.ps1',
      WINDOWS_SIGNING_SUBJECT: expected.publisherSubject,
      WINDOWS_SIGNING_THUMBPRINT: thumbprint,
      RFC3161_TIMESTAMP_URL: 'https://timestamp.digicert.com',
    }
    expect(resolveWindowsSigningMode(full, policy)).toMatchObject({ mode: 'signed', signed: true })
    expect(resolveWindowsSigningMode({}, policy)).toEqual({
      mode: 'authenticode-unsigned',
      signed: false,
      unsignedReleaseDisclosure: policy.authenticode.unsignedReleaseDisclosure,
    })
    for (let mask = 1; mask < 15; mask++) {
      const partial = {}
      WINDOWS_SIGNING_ENV_KEYS.forEach((key, idx) => {
        if (mask & (1 << idx)) partial[key] = full[key]
      })
      expect(() => resolveWindowsSigningMode(partial, policy)).toThrow(/partial WINDOWS_SIGNING/i)
    }
    expect(() =>
      resolveWindowsSigningMode({ ...full, WINDOWS_SIGNING_SCRIPT: '   ' }, policy)
    ).toThrow(/partial WINDOWS_SIGNING/i)
  })

  it('validates unsigned Windows evidence and rejects hash or disclosure drift', () => {
    const valid = {
      path: 'NavSlides Editor Setup 1.17.0.exe',
      mode: 'authenticode-unsigned',
      signed: false,
      sha256: digest,
      expectedSha256: digest,
      postDownloadSha256: digest,
      unsignedReleaseDisclosure: policy.authenticode.unsignedReleaseDisclosure,
    }
    expect(verifyUnsignedWindowsEvidence({ evidence: valid, expectedSha256: digest, policy })).toMatchObject({
      mode: 'authenticode-unsigned',
      verified: true,
    })
    expect(() =>
      verifyUnsignedWindowsEvidence({
        evidence: { ...valid, unsignedReleaseDisclosure: 'tampered' },
        expectedSha256: digest,
        policy,
      })
    ).toThrow(/disclosure/i)
  })

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
