import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { verifyContainerSupplyChain } from './verify-container-supply-chain.js'

const sha = 'a'.repeat(64)
const base = () => ({
  policy: {
    schemaVersion: 1,
    failSeverities: ['HIGH', 'CRITICAL'],
    exceptions: [],
  },
  report: {
    SchemaVersion: 2,
    Results: [{ Target: 'node', Class: 'lang-pkgs', Type: 'npm', Vulnerabilities: [] }],
  },
  sbom: {
    spdxVersion: 'SPDX-2.3',
    packages: [{ name: 'navslides-editor', versionInfo: '1.17.0' }],
  },
  browser: {
    playwrightVersion: '1.63.0',
    chromium: { revision: '1243', executablePath: '/ms-playwright/chromium-1243/chrome' },
  },
  expected: {
    imageDigest: `sha256:${sha}`,
    playwrightVersion: '1.63.0',
    chromiumRevision: '1243',
  },
  actualImageDigest: `sha256:${sha}`,
})

const approvedRclonePolicy = () =>
  JSON.parse(
    readFileSync(new URL('../config/container-vulnerability-policy.json', import.meta.url), 'utf8')
  )

describe('container supply-chain policy', () => {
  it('accepts a pinned image with SPDX and matching Chromium inventory', () => {
    expect(verifyContainerSupplyChain(base()).status).toBe('passed')
  })

  it('keeps all checked-in container policy exceptions unexpired under the live clock', () => {
    const policy = approvedRclonePolicy()
    for (const entry of policy.exceptions) {
      expect(Date.parse(entry.expires)).toBeGreaterThan(Date.now())
    }
    expect(policy.unapprovedFindingDisposition?.expectedCount).toBeUndefined()
    expect(Array.isArray(policy.unapprovedFindingDisposition?.baselineIds)).toBe(true)
    expect(policy.unapprovedFindingDisposition.baselineIds.length).toBeGreaterThan(0)
  })

  it('fails on unapproved high or critical vulnerabilities', () => {
    const input = base()
    input.report.Results = [
      {
        Target: 'node',
        Class: 'lang-pkgs',
        Type: 'npm',
        Vulnerabilities: [{ VulnerabilityID: 'CVE-1', PkgName: 'node', Severity: 'HIGH' }],
      },
    ]
    expect(() => verifyContainerSupplyChain(input)).toThrow(/CVE-1/)
  })

  it('records baselineIds subset up to maxCount as advisory and fails on unknown IDs or overflow', () => {
    const input = base()
    const baselineIds = Array.from(
      { length: 71 },
      (_, index) => `CVE-TEST-${String(index + 1).padStart(3, '0')}`
    )
    const vulnerabilities = baselineIds.map((id, index) => ({
      VulnerabilityID: id,
      PkgName: `package-${index + 1}`,
      Severity: index < 50 ? 'HIGH' : 'CRITICAL',
    }))
    input.policy.unapprovedFindingDisposition = {
      status: 'risk-accepted',
      maxCount: 71,
      baselineIds,
      reason: "User decision ('bỏ qua'): existing findings remain advisory, not remediated.",
    }
    input.report.Results[0].Vulnerabilities = vulnerabilities

    const receipt = verifyContainerSupplyChain(input)
    expect(receipt.status).toBe('risk-accepted')
    expect(receipt.securityStatus).toBe('advisory')
    expect(receipt.scan.vulnerabilityCount).toBe(71)
    expect(receipt.unapprovedFindings).toMatchObject({
      status: 'risk-accepted',
      reason: input.policy.unapprovedFindingDisposition.reason,
      count: 71,
      severityCounts: { HIGH: 50, CRITICAL: 21 },
      ids: baselineIds,
      truncated: false,
    })

    input.report.Results[0].Vulnerabilities = vulnerabilities.slice(0, 10)
    expect(verifyContainerSupplyChain(input).unapprovedFindings.count).toBe(10)

    input.report.Results[0].Vulnerabilities = [
      ...vulnerabilities,
      { VulnerabilityID: baselineIds[0], PkgName: 'package-72', Severity: 'HIGH' },
    ]
    expect(() => verifyContainerSupplyChain(input)).toThrow(/maxCount exceeded/)

    input.report.Results[0].Vulnerabilities = [
      { VulnerabilityID: 'CVE-UNKNOWN-999', PkgName: 'package-1', Severity: 'CRITICAL' },
    ]
    expect(() => verifyContainerSupplyChain(input)).toThrow(/outside baselineIds.*CVE-UNKNOWN-999/)
  })

  it('fails closed for a missing or malformed Trivy report', () => {
    for (const report of [
      undefined,
      {},
      { SchemaVersion: 2 },
      { SchemaVersion: 2, Results: [] },
      {
        SchemaVersion: 2,
        Results: [{ Target: 'node', Class: 'lang-pkgs', Type: 'npm', Vulnerabilities: [{}] }],
      },
    ]) {
      const input = base()
      input.report = report
      expect(() => verifyContainerSupplyChain(input)).toThrow(/Trivy vulnerability report/)
    }
  })

  it('accepts only unexpired exact exceptions', () => {
    const input = base()
    input.report.Results = [
      {
        Target: 'node',
        Class: 'lang-pkgs',
        Type: 'npm',
        Vulnerabilities: [{ VulnerabilityID: 'CVE-1', PkgName: 'node', Severity: 'CRITICAL' }],
      },
    ]
    input.policy.exceptions = [
      { id: 'CVE-1', package: 'node', expires: '2999-01-01T00:00:00.000Z', reason: 'reviewed' },
    ]
    expect(verifyContainerSupplyChain(input).status).toBe('passed')
    input.policy.exceptions[0].expires = '2000-01-01T00:00:00.000Z'
    expect(() => verifyContainerSupplyChain(input)).toThrow(/expired/i)
    input.report.Results[0].Vulnerabilities = []
    expect(() => verifyContainerSupplyChain(input)).toThrow(/expired/i)
  })

  it.each([
    ['1.75.1', 'rclone', 'CVE-2026-88016', true],
    ['1.75.0', 'rclone', 'CVE-2026-88016', false],
    ['1.75.2', 'rclone', 'CVE-2026-88016', false],
    ['1.75.1+dfsg-1', 'rclone', 'CVE-2026-88016', false],
    [undefined, 'rclone', 'CVE-2026-88016', false],
    ['1.75.1', 'other-package', 'CVE-2026-88016', false],
    ['1.75.1', 'rclone', 'CVE-OTHER', false],
  ])(
    'limits the approved exception to version %s, package %s, and ID %s',
    (installedVersion, packageName, id, exempt) => {
      const input = base()
      input.policy = approvedRclonePolicy()
      delete input.policy.unapprovedFindingDisposition
      input.report.Results = [
        {
          Target: 'debian',
          Class: 'os-pkgs',
          Type: 'debian',
          Vulnerabilities: [
            {
              VulnerabilityID: id,
              PkgName: packageName,
              InstalledVersion: installedVersion,
              Severity: 'HIGH',
            },
          ],
        },
      ]
      if (exempt) {
        expect(verifyContainerSupplyChain(input)).toMatchObject({
          status: 'passed',
          scan: { vulnerabilityCount: 1 },
          unapprovedFindings: { status: 'none', count: 0 },
        })
      } else {
        expect(() => verifyContainerSupplyChain(input)).toThrow(
          `unapproved vulnerabilities (1): ${id}:${packageName}`
        )
      }
    }
  )

  it.each(['', '   ', null, 1751, {}])(
    'rejects an invalid supplied exception installedVersion %j',
    (installedVersion) => {
      const input = base()
      input.policy = approvedRclonePolicy()
      input.policy.exceptions[0].installedVersion = installedVersion
      expect(() => verifyContainerSupplyChain(input)).toThrow(
        'invalid exception for CVE-2026-88016'
      )
    }
  )

  it('exempts the patched rclone finding without consuming maxCount budget', () => {
    const input = base()
    input.policy = approvedRclonePolicy()
    const { maxCount, baselineIds } = input.policy.unapprovedFindingDisposition
    input.report.Results[0].Vulnerabilities = Array.from({ length: maxCount }, (_, index) => ({
      VulnerabilityID: baselineIds[index % baselineIds.length],
      PkgName: `package-${index}`,
      Severity: 'HIGH',
    }))
    const rclone = {
      VulnerabilityID: 'CVE-2026-88016',
      PkgName: 'rclone',
      InstalledVersion: '1.75.1',
      Severity: 'HIGH',
    }
    input.report.Results.push({
      Target: 'debian',
      Class: 'os-pkgs',
      Type: 'debian',
      Vulnerabilities: [rclone],
    })
    expect(verifyContainerSupplyChain(input)).toMatchObject({
      status: 'risk-accepted',
      securityStatus: 'advisory',
      scan: { vulnerabilityCount: maxCount + 1 },
      unapprovedFindings: { count: maxCount },
    })
    rclone.InstalledVersion = '1.75.0'
    expect(() => verifyContainerSupplyChain(input)).toThrow(/outside baselineIds|maxCount/i)
  })

  it('fails on image, Playwright, Chromium, or SBOM drift', () => {
    for (const mutate of [
      (input) => {
        input.actualImageDigest = `sha256:${'b'.repeat(64)}`
      },
      (input) => {
        input.browser.playwrightVersion = '1.62.0'
      },
      (input) => {
        input.browser.chromium.revision = ''
      },
      (input) => {
        input.sbom.packages = []
      },
    ]) {
      const input = base()
      mutate(input)
      expect(() => verifyContainerSupplyChain(input)).toThrow()
    }
  })

  it('loads file inputs and writes a bounded verification receipt', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'navslides-supply-chain-'))
    const input = base()
    for (const [name, value] of Object.entries({
      policy: input.policy,
      report: input.report,
      sbom: input.sbom,
      browser: input.browser,
    })) {
      writeFileSync(join(dir, `${name}.json`), JSON.stringify(value))
    }
    writeFileSync(join(dir, 'digest.txt'), `${input.actualImageDigest}\n`)
    const { runCli } = await import('./verify-container-supply-chain.js')
    const out = join(dir, 'receipt.json')
    await runCli([
      '--policy', join(dir, 'policy.json'),
      '--report', join(dir, 'report.json'),
      '--sbom', join(dir, 'sbom.json'),
      '--browser', join(dir, 'browser.json'),
      '--image-digest', join(dir, 'digest.txt'),
      '--expected-image-digest', input.expected.imageDigest,
      '--playwright-version', input.expected.playwrightVersion,
      '--chromium-revision', input.expected.chromiumRevision,
      '--out', out,
    ])
    const receipt = JSON.parse(readFileSync(out, 'utf8'))
    const digest = (value) =>
      `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
    expect(receipt).toMatchObject({
      status: 'passed',
      securityStatus: 'passed',
      subject: { imageDigest: input.expected.imageDigest },
      unapprovedFindings: { status: 'none', count: 0 },
    })
    expect(receipt.subject.sbomSha256).toBe(digest(input.sbom))
  })
})
