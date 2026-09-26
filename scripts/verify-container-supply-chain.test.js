import { mkdtempSync, writeFileSync } from 'node:fs'
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
  report: { SchemaVersion: 2, Results: [] },
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

describe('container supply-chain policy', () => {
  it('accepts a pinned image with SPDX and matching Chromium inventory', () => {
    expect(verifyContainerSupplyChain(base()).status).toBe('passed')
  })

  it('fails on unapproved high or critical vulnerabilities', () => {
    const input = base()
    input.report.Results = [
      {
        Target: 'node',
        Vulnerabilities: [{ VulnerabilityID: 'CVE-1', PkgName: 'node', Severity: 'HIGH' }],
      },
    ]
    expect(() => verifyContainerSupplyChain(input)).toThrow(/CVE-1/)
  })

  it('accepts only unexpired exact exceptions', () => {
    const input = base()
    input.report.Results = [
      {
        Target: 'node',
        Vulnerabilities: [{ VulnerabilityID: 'CVE-1', PkgName: 'node', Severity: 'CRITICAL' }],
      },
    ]
    input.policy.exceptions = [
      { id: 'CVE-1', package: 'node', expires: '2999-01-01T00:00:00.000Z', reason: 'reviewed' },
    ]
    expect(verifyContainerSupplyChain(input).status).toBe('passed')
    input.policy.exceptions[0].expires = '2000-01-01T00:00:00.000Z'
    expect(() => verifyContainerSupplyChain(input)).toThrow(/expired/i)
    input.report.Results = []
    expect(() => verifyContainerSupplyChain(input)).toThrow(/expired/i)
  })

  it('fails on image, Playwright, Chromium, or SBOM drift', () => {
    for (const mutate of [
      (input) => { input.actualImageDigest = `sha256:${'b'.repeat(64)}` },
      (input) => { input.browser.playwrightVersion = '1.62.0' },
      (input) => { input.browser.chromium.revision = '' },
      (input) => { input.sbom.packages = [] },
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
    expect(JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(out, 'utf8'))))
      .toMatchObject({ status: 'passed', imageDigest: input.expected.imageDigest })
  })
})
