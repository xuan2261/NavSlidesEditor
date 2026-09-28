import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyReleasePromotion } from './verify-release-promotion.mjs'

const sha = (character) => character.repeat(64)
const subjectSha = 'a'.repeat(40)
const digest = (value) => createHash('sha256').update(value).digest('hex')

function evidence() {
  const report = Buffer.from('{"Results":[{"Vulnerabilities":[{"Severity":"HIGH"}]}]}\n')
  const sbom = Buffer.from('{"spdxVersion":"SPDX-2.3"}\n')
  const imageDigest = `sha256:${sha('b')}`
  const scanReceipt = {
    status: 'risk-accepted',
    securityStatus: 'advisory',
    subject: { imageDigest, sbomSha256: `sha256:${digest(sbom)}` },
    scan: {
      status: 'completed',
      trivyReportSha256: `sha256:${digest(report)}`,
      vulnerabilityCount: 1,
    },
    unapprovedFindings: { status: 'risk-accepted', count: 1 },
  }
  const scanReceiptBytes = Buffer.from(JSON.stringify(scanReceipt))
  const manifest = { subject: { sha: subjectSha }, artifact: { identity: sha('c') } }
  const manifestBytes = Buffer.from(JSON.stringify(manifest))
  return {
    subjectSha,
    ciHeadSha: subjectSha,
    checkoutSha: subjectSha,
    tag: 'v1.17.0-rc.1',
    packageVersion: '1.17.0',
    policy: {
      policyVersion: 'release-target-policy-v2',
      containerSecurityAdvisory: { mode: 'user-risk-accepted', securityPassClaim: false },
    },
    vulnerabilityPolicy: {
      failSeverities: ['HIGH', 'CRITICAL'],
      exceptions: [],
      unapprovedFindingDisposition: { status: 'risk-accepted', expectedCount: 1 },
    },
    root: {
      status: 'passed',
      subjectSha,
      clientDigest: digest(manifestBytes),
      policyVersion: 'release-target-policy-v2',
      releaseTag: 'v1.17.0-rc.1',
      children: {
        'linux-ci': { status: 'passed' },
        windows: { status: 'passed' },
        'linux-desktop': { status: 'not-selected' },
        'macos-desktop': { status: 'not-selected' },
      },
      containerSecurityAdvisory: {
        mode: 'user-risk-accepted',
        status: 'risk-accepted',
        receiptHash: digest(scanReceiptBytes),
        securityPassClaim: false,
      },
    },
    manifest,
    manifestBytes,
    imageDigest,
    scanReceipt,
    scanReceiptBytes,
    report,
    sbom,
  }
}

describe('release Docker promotion', () => {
  it('accepts exact-subject image and candid risk-accepted scan evidence', () => {
    expect(verifyReleasePromotion(evidence())).toMatchObject({
      subjectSha,
      imageDigest: `sha256:${sha('b')}`,
      securityStatus: 'advisory',
    })
  })

  it('rejects a scan detached from the published image', () => {
    const input = evidence()
    input.scanReceipt.subject.imageDigest = `sha256:${sha('d')}`
    expect(() => verifyReleasePromotion(input)).toThrow(/scan image digest/i)
  })

  it('rejects a risk-accepted root pretending to have security pass', () => {
    const input = evidence()
    input.root.containerSecurityAdvisory.securityPassClaim = true
    expect(() => verifyReleasePromotion(input)).toThrow(/security pass/i)
  })

  it('rejects a clean scan receipt when its raw report still has critical findings', () => {
    const input = evidence()
    input.scanReceipt.status = 'passed'
    input.scanReceipt.securityStatus = 'passed'
    input.scanReceipt.unapprovedFindings = { status: 'none', count: 0 }
    input.scanReceiptBytes = Buffer.from(JSON.stringify(input.scanReceipt))
    input.root.containerSecurityAdvisory.status = 'passed'
    input.root.containerSecurityAdvisory.receiptHash = digest(input.scanReceiptBytes)
    expect(() => verifyReleasePromotion(input)).toThrow(/Trivy finding count/i)
  })

  it('rejects changed raw Trivy bytes even when the scan receipt is unchanged', () => {
    const input = evidence()
    input.report = Buffer.from('{"Results":[]}\n')
    expect(() => verifyReleasePromotion(input)).toThrow(/Trivy report digest/i)
  })

  it('rejects green roots missing the Windows physical evidence gate', () => {
    const input = evidence()
    input.root.children.windows.status = 'not-selected'
    expect(() => verifyReleasePromotion(input)).toThrow(/Windows receipt/i)
  })

  it('rejects findings outside the operator-approved count', () => {
    const input = evidence()
    input.vulnerabilityPolicy.unapprovedFindingDisposition.expectedCount = 2
    expect(() => verifyReleasePromotion(input)).toThrow(/risk acceptance count/i)
  })
})
