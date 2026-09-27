import crypto from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const IMAGE_DIGEST = /^sha256:[a-f0-9]{64}$/
const SEVERITIES = ['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const MAX_ACCEPTED_FINDINGS = 100
const sha256 = (value) =>
  `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`
const hashJson = (value) => sha256(JSON.stringify(value))
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0
const compareText = (left, right) => (left < right ? -1 : left > right ? 1 : 0)
const isRevision = (value) =>
  (typeof value === 'string' && isNonEmptyString(value)) ||
  (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)

function assertPolicy(policy, now) {
  if (!isRecord(policy) || policy.schemaVersion !== 1) {
    throw new Error('unsupported container policy schema')
  }
  if (
    !Array.isArray(policy.failSeverities) ||
    policy.failSeverities.length === 0 ||
    policy.failSeverities.some((severity) => !SEVERITIES.includes(severity)) ||
    new Set(policy.failSeverities).size !== policy.failSeverities.length ||
    !Array.isArray(policy.exceptions)
  ) {
    throw new Error('container policy is invalid')
  }
  for (const entry of policy.exceptions) {
    if (
      !isRecord(entry) ||
      !isNonEmptyString(entry.id) ||
      !isNonEmptyString(entry.reason) ||
      !isNonEmptyString(entry.expires) ||
      (entry.package !== undefined && !isNonEmptyString(entry.package)) ||
      !Number.isFinite(Date.parse(entry.expires))
    ) {
      throw new Error(`invalid exception for ${entry?.id ?? 'unknown'}`)
    }
    if (Date.parse(entry.expires) <= now) throw new Error(`expired exception for ${entry.id}`)
  }
  if (policy.unapprovedFindingDisposition !== undefined) {
    const disposition = policy.unapprovedFindingDisposition
    if (
      !isRecord(disposition) ||
      disposition.status !== 'risk-accepted' ||
      !Number.isSafeInteger(disposition.expectedCount) ||
      disposition.expectedCount < 1 ||
      disposition.expectedCount > MAX_ACCEPTED_FINDINGS ||
      !isNonEmptyString(disposition.reason)
    ) {
      throw new Error('container risk-acceptance policy is invalid')
    }
  }
}

function assertSbom(sbom) {
  if (!isRecord(sbom)) throw new Error('SPDX or CycloneDX SBOM is required')
  const spdx = typeof sbom.spdxVersion === 'string' && sbom.spdxVersion.startsWith('SPDX-')
  const cyclonedx = sbom.bomFormat === 'CycloneDX'
  if (!spdx && !cyclonedx) throw new Error('SPDX or CycloneDX SBOM is required')
  const packages = sbom.packages ?? sbom.components
  if (
    !Array.isArray(packages) ||
    packages.length === 0 ||
    packages.some((entry) => !isRecord(entry) || !isNonEmptyString(entry.name))
  ) {
    throw new Error('SBOM package inventory is empty or malformed')
  }
}

function assertScanReport(report) {
  if (
    !isRecord(report) ||
    report.SchemaVersion !== 2 ||
    !Array.isArray(report.Results) ||
    report.Results.length === 0
  ) {
    throw new Error('Trivy vulnerability report is missing or malformed')
  }
  const vulnerabilities = []
  for (const result of report.Results) {
    if (
      !isRecord(result) ||
      !isNonEmptyString(result.Target) ||
      !isNonEmptyString(result.Class) ||
      !isNonEmptyString(result.Type) ||
      (result.Vulnerabilities != null && !Array.isArray(result.Vulnerabilities))
    ) {
      throw new Error('Trivy vulnerability report contains a malformed result')
    }
    for (const entry of result.Vulnerabilities ?? []) {
      if (
        !isRecord(entry) ||
        !isNonEmptyString(entry.VulnerabilityID) ||
        !isNonEmptyString(entry.PkgName) ||
        !SEVERITIES.includes(entry.Severity)
      ) {
        throw new Error('Trivy vulnerability report contains a malformed finding')
      }
      vulnerabilities.push({ ...entry, target: result.Target })
    }
  }
  return vulnerabilities
}

function approvedException(vulnerability, policy) {
  return policy.exceptions.some(
    (entry) =>
      entry.id === vulnerability.VulnerabilityID &&
      (!entry.package || entry.package === vulnerability.PkgName)
  )
}

function findingSummary(findings) {
  const entries = findings
    .map((entry) => ({
      id: entry.VulnerabilityID,
      package: entry.PkgName,
      severity: entry.Severity,
      target: entry.target,
    }))
    .sort(
      (left, right) =>
        compareText(left.id, right.id) ||
        compareText(left.package, right.package) ||
        compareText(left.severity, right.severity) ||
        compareText(left.target, right.target)
    )
  const severityCounts = Object.fromEntries(SEVERITIES.map((severity) => [severity, 0]))
  for (const entry of entries) severityCounts[entry.severity]++
  return {
    count: entries.length,
    severityCounts,
    ids: [...new Set(entries.map((entry) => entry.id))].slice(0, MAX_ACCEPTED_FINDINGS),
    findings: entries.slice(0, MAX_ACCEPTED_FINDINGS),
    truncated: entries.length > MAX_ACCEPTED_FINDINGS,
    omittedCount: Math.max(0, entries.length - MAX_ACCEPTED_FINDINGS),
  }
}

export function verifyContainerSupplyChain(input, now = Date.now()) {
  if (!isRecord(input)) throw new Error('container supply-chain evidence is missing')
  const { policy, report, sbom, browser, expected, actualImageDigest, evidenceDigests } = input
  assertPolicy(policy, now)
  if (
    !isRecord(expected) ||
    typeof actualImageDigest !== 'string' ||
    !IMAGE_DIGEST.test(actualImageDigest) ||
    typeof expected.imageDigest !== 'string' ||
    !IMAGE_DIGEST.test(expected.imageDigest) ||
    actualImageDigest !== expected.imageDigest
  ) {
    throw new Error('container image digest mismatch')
  }
  assertSbom(sbom)
  if (
    !isRecord(browser) ||
    !isNonEmptyString(browser.playwrightVersion) ||
    !isNonEmptyString(expected.playwrightVersion) ||
    browser.playwrightVersion !== expected.playwrightVersion
  ) {
    throw new Error('Playwright version drift or incomplete inventory')
  }
  if (
    !isRecord(browser.chromium) ||
    !isRevision(browser.chromium.revision) ||
    !isNonEmptyString(browser.chromium.executablePath) ||
    !isRevision(expected.chromiumRevision)
  ) {
    throw new Error('Chromium inventory is incomplete')
  }
  const chromiumRevision = String(browser.chromium.revision)
  if (chromiumRevision !== String(expected.chromiumRevision)) {
    throw new Error('Chromium revision drift')
  }

  const vulnerabilities = assertScanReport(report)
  const failures = vulnerabilities.filter(
    (entry) =>
      policy.failSeverities.includes(entry.Severity) &&
      !approvedException(entry, policy)
  )
  const summary = findingSummary(failures)
  const disposition = policy.unapprovedFindingDisposition
  if (failures.length > 0 && !disposition) {
    const sample = summary.findings.slice(0, 10).map((entry) => `${entry.id}:${entry.package}`)
    const suffix = failures.length > sample.length ? `,+${failures.length - sample.length} more` : ''
    throw new Error(`unapproved vulnerabilities (${failures.length}): ${sample.join(',')}${suffix}`)
  }
  if (failures.length > 0 && failures.length !== disposition.expectedCount) {
    throw new Error(
      `risk acceptance expected exactly ${disposition.expectedCount} unapproved findings; found ${failures.length}`
    )
  }

  const riskAccepted = failures.length > 0
  const digestFor = (key, value) => {
    const supplied = evidenceDigests?.[key]
    if (supplied === undefined) return hashJson(value)
    if (typeof supplied !== 'string' || !IMAGE_DIGEST.test(supplied)) {
      throw new Error(`invalid ${key} evidence digest`)
    }
    return supplied
  }
  return {
    schemaVersion: 1,
    status: riskAccepted ? 'risk-accepted' : 'passed',
    securityStatus: riskAccepted ? 'advisory' : 'passed',
    subject: {
      imageDigest: actualImageDigest,
      sbomSha256: digestFor('sbom', sbom),
      browserInventorySha256: digestFor('browser', browser),
      playwrightVersion: browser.playwrightVersion,
      chromiumRevision,
      chromiumExecutablePath: browser.chromium.executablePath,
    },
    scan: {
      status: 'completed',
      trivyReportSha256: digestFor('report', report),
      policySha256: digestFor('policy', policy),
      vulnerabilityCount: vulnerabilities.length,
      resultCount: report.Results.length,
    },
    unapprovedFindings: {
      status: riskAccepted ? 'risk-accepted' : 'none',
      reason: riskAccepted ? disposition.reason : null,
      ...summary,
    },
  }
}

function parseArgs(args) {
  const values = {}
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    const value = args[index + 1]
    if (!key?.startsWith('--') || !value) throw new Error(`invalid argument ${key ?? ''}`)
    values[key.slice(2).replace(/-([a-z])/g, (_, character) => character.toUpperCase())] = value
  }
  return values
}

export async function runCli(args) {
  const values = parseArgs(args)
  const loadEvidence = async (name) => {
    const contents = await readFile(values[name])
    return {
      value: JSON.parse(contents.toString('utf8')),
      digest: sha256(contents),
    }
  }
  const [policy, report, sbom, browser] = await Promise.all(
    ['policy', 'report', 'sbom', 'browser'].map(loadEvidence)
  )
  const actualImageDigest = (await readFile(values.imageDigest, 'utf8')).trim()
  const receipt = verifyContainerSupplyChain({
    policy: policy.value,
    report: report.value,
    sbom: sbom.value,
    browser: browser.value,
    expected: {
      imageDigest: values.expectedImageDigest,
      playwrightVersion: values.playwrightVersion,
      chromiumRevision: values.chromiumRevision,
    },
    actualImageDigest,
    evidenceDigests: {
      policy: policy.digest,
      report: report.digest,
      sbom: sbom.digest,
      browser: browser.digest,
    },
  })
  await writeFile(values.out, `${JSON.stringify(receipt, null, 2)}\n`)
  return receipt
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli(process.argv.slice(2)).catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
