import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { verifyReleaseSubject } from './release-subject.mjs'

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')
const imageId = /^sha256:[0-9a-f]{64}$/

export function verifyReleasePromotion(input) {
  const { root, manifest, scanReceipt, policy } = input
  verifyReleaseSubject({
    tag: input.tag,
    packageVersion: input.packageVersion,
    subjectSha: input.subjectSha,
    tagCommitSha: input.subjectSha,
    checkoutSha: input.checkoutSha,
    successfulCiHeadSha: input.ciHeadSha,
    artifactSubjects: [manifest.subject?.sha],
    receiptSubjects: [root.subjectSha],
  })
  if (root.status !== 'passed' || root.policyVersion !== policy.policyVersion) {
    throw new Error('green root is not qualified under the release policy')
  }
  if (root.releaseTag !== input.tag) throw new Error('green root release tag mismatch')
  if (root.clientDigest !== digest(input.manifestBytes)) {
    throw new Error('client manifest byte digest mismatch')
  }
  if (root.children?.['linux-ci']?.status !== 'passed') {
    throw new Error('Linux receipt did not pass')
  }
  if (root.children?.windows?.status !== 'passed') {
    throw new Error('Windows receipt did not pass physical qualification')
  }
  for (const host of ['linux-desktop', 'macos-desktop']) {
    if (root.children?.[host]?.status !== 'not-selected') {
      throw new Error(`${host} receipt is not explicitly unselected`)
    }
  }
  if (!imageId.test(input.imageDigest) || scanReceipt.subject?.imageDigest !== input.imageDigest) {
    throw new Error('scan image digest does not match the promoted image')
  }
  const accepted = policy.containerSecurityAdvisory
  const advisory = root.containerSecurityAdvisory
  if (
    accepted?.mode !== 'user-risk-accepted' ||
    accepted.securityPassClaim !== false ||
    advisory?.mode !== accepted.mode ||
    advisory.securityPassClaim !== false
  ) {
    throw new Error('security pass claim is forbidden for accepted advisory risk')
  }
  if (scanReceipt.scan?.status !== 'completed') throw new Error('Trivy scan did not complete')
  const findings = scanReceipt.unapprovedFindings
  if (
    !Number.isSafeInteger(findings?.count) ||
    findings.count < 0 ||
    scanReceipt.status !== (findings.count ? 'risk-accepted' : 'passed') ||
    findings.status !== (findings.count ? 'risk-accepted' : 'none') ||
    scanReceipt.securityStatus !== (findings.count ? 'advisory' : 'passed') ||
    advisory.status !== scanReceipt.status
  ) {
    throw new Error('container scan risk disposition mismatch')
  }
  if (advisory.receiptHash !== digest(input.scanReceiptBytes)) {
    throw new Error('container scan receipt hash mismatch')
  }
  if (scanReceipt.scan.trivyReportSha256 !== `sha256:${digest(input.report)}`) {
    throw new Error('Trivy report digest mismatch')
  }
  if (scanReceipt.subject.sbomSha256 !== `sha256:${digest(input.sbom)}`) {
    throw new Error('container SBOM digest mismatch')
  }
  const report = JSON.parse(input.report.toString('utf8'))
  const vulnerabilityPolicy = input.vulnerabilityPolicy
  if (
    !Array.isArray(report.Results) ||
    !Array.isArray(vulnerabilityPolicy?.failSeverities) ||
    !Array.isArray(vulnerabilityPolicy?.exceptions)
  ) {
    throw new Error('Trivy finding policy or report is incomplete')
  }
  let total = 0
  let unapproved = 0
  for (const result of report.Results) {
    if (result.Vulnerabilities != null && !Array.isArray(result.Vulnerabilities)) {
      throw new Error('Trivy finding inventory is invalid')
    }
    for (const vulnerability of result.Vulnerabilities ?? []) {
      total++
      if (
        vulnerabilityPolicy.failSeverities.includes(vulnerability.Severity) &&
        !vulnerabilityPolicy.exceptions.some(
          (entry) =>
            entry.id === vulnerability.VulnerabilityID &&
            (!entry.package || entry.package === vulnerability.PkgName)
        )
      ) {
        unapproved++
      }
    }
  }
  if (scanReceipt.scan.vulnerabilityCount !== total || findings.count !== unapproved) {
    throw new Error('Trivy finding count does not match the raw report')
  }
  if (
    unapproved > 0 &&
    (vulnerabilityPolicy.unapprovedFindingDisposition?.status !== 'risk-accepted' ||
      vulnerabilityPolicy.unapprovedFindingDisposition.expectedCount !== unapproved)
  ) {
    throw new Error('risk acceptance count changed since approved policy')
  }
  return {
    subjectSha: input.subjectSha,
    imageDigest: input.imageDigest,
    securityStatus: findings.count ? 'advisory' : 'no-unapproved-findings',
    unapprovedFindingCount: findings.count,
  }
}

async function main() {
  const [
    subjectSha,
    ciHeadSha,
    tag,
    rootPath,
    manifestPath,
    imageDigestPath,
    scanPath,
    reportPath,
    sbomPath,
  ] = process.argv.slice(2)
  if (
    [
      subjectSha,
      ciHeadSha,
      tag,
      rootPath,
      manifestPath,
      imageDigestPath,
      scanPath,
      reportPath,
      sbomPath,
    ].some((value) => !value)
  ) {
    throw new Error(
      'usage: <subject> <ci-head> <tag> <root> <manifest> <image-digest> <scan-receipt> <trivy-report> <sbom>'
    )
  }
  const [
    rootBytes,
    manifestBytes,
    imageDigestBytes,
    scanReceiptBytes,
    report,
    sbom,
    policyBytes,
    vulnerabilityPolicyBytes,
    packageBytes,
  ] = await Promise.all(
    [
      rootPath,
      manifestPath,
      imageDigestPath,
      scanPath,
      reportPath,
      sbomPath,
      'config/release-target-policy.json',
      'config/container-vulnerability-policy.json',
      'package.json',
    ].map((path) => readFile(path))
  )
  const result = verifyReleasePromotion({
    subjectSha,
    ciHeadSha,
    tag,
    checkoutSha: process.env.GITHUB_SHA_CHECKOUT,
    root: JSON.parse(rootBytes),
    manifest: JSON.parse(manifestBytes),
    manifestBytes,
    imageDigest: imageDigestBytes.toString('utf8').trim(),
    scanReceipt: JSON.parse(scanReceiptBytes),
    scanReceiptBytes,
    report,
    sbom,
    policy: JSON.parse(policyBytes),
    vulnerabilityPolicy: JSON.parse(vulnerabilityPolicyBytes),
    packageVersion: JSON.parse(packageBytes).version,
  })
  console.log(JSON.stringify(result))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
