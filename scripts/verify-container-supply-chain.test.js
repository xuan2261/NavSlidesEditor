import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { reduceTrivyCapture } from './capture-trivy-fixtures.js'
import { base, cliInputs, evidenceFor, finding, genuineInput, loadFixture, now, runCli, verifyContainerSupplyChain, withFinding } from './verify-container-supply-chain-test-inputs.js'

describe('container supply-chain fail-closed boundary', () => {
  it('accepts the actual policy-filtered clean Alpine capture with omitted Vulnerabilities', () => {
    const input = genuineInput('clean')
    expect(input.report.Results[0]).not.toHaveProperty('Vulnerabilities')
    expect(verifyContainerSupplyChain(input)).toMatchObject({ status: 'passed', vulnerabilityCount: 0 })
  })
  it('rejects genuine severe findings without pruning OS or language targets', () => {
    const input = genuineInput('findings')
    expect(input.report.Results.map((result) => result.Class)).toEqual(['os-pkgs', 'lang-pkgs'])
    expect(() => verifyContainerSupplyChain(input)).toThrow(/unapproved vulnerabilities/)
  })
  it('keeps every genuine captured package and finding through fixture reduction', () => {
    const report = loadFixture('all-severities')
    expect(reduceTrivyCapture(report)).toEqual(report)
    expect(report.Results.flatMap((result) => result.Vulnerabilities ?? []).some((entry) => entry.Severity === 'MEDIUM')).toBe(true)
  })
  it('rejects missing, failed, unpinned or unbound invocation evidence', () => {
    for (const scanEvidence of [undefined, {}, { exitCode: 1 }, { scanner: { Version: '0.73.0' } }, { imageID: `sha256:${'b'.repeat(64)}` }]) {
      expect(() => verifyContainerSupplyChain({ ...base(), scanEvidence })).toThrow(/scan|invocation|evidence|image/i)
    }
  })
  it.each([{}, null, [], { SchemaVersion: 2 }, { SchemaVersion: 2, Results: [] }])('rejects missing or incomplete report %j', (report) => {
    expect(() => verifyContainerSupplyChain({ ...base(), report })).toThrow()
  })
  it.each([null, {}, 'clean', [null], [{}]])('rejects malformed Results %j', (results) => {
    const input = base()
    input.report.Results = results
    expect(() => verifyContainerSupplyChain(input)).toThrow(/report|Results|result/i)
  })
  it.each([{}, 'clean', null])('rejects malformed vulnerability collections %j', (value) => {
    const input = base()
    input.report.Results[0].Vulnerabilities = value
    expect(() => verifyContainerSupplyChain(input)).toThrow(/vulnerabilit/i)
  })
  it.each([undefined, 'high', 'URGENT', null])('rejects unsupported finding severity %j', (severity) => {
    const input = withFinding()
    input.report.Results[0].Vulnerabilities[0].Severity = severity
    expect(() => verifyContainerSupplyChain(input)).toThrow(/severity/i)
  })
  it.each(['VulnerabilityID', 'PkgName', 'InstalledVersion'])('rejects missing finding identity %s', (field) => {
    const input = withFinding()
    delete input.report.Results[0].Vulnerabilities[0][field]
    expect(() => verifyContainerSupplyChain(input)).toThrow(/finding|identity|vulnerabilit/i)
  })
  it.each([
    (input) => { input.report.SchemaVersion = 3 },
    (input) => { input.report.Trivy.Version = '0.73.0' },
    (input) => { input.report.ArtifactType = 'filesystem' },
    (input) => { input.report.ArtifactName = 'different:tag' },
    (input) => { input.report.Metadata.ImageID = `sha256:${'b'.repeat(64)}` },
    (input) => { input.report.Metadata.ImageConfig.os = 'windows' },
    (input) => { delete input.report.Metadata.OS },
    (input) => { input.report.Results.splice(0, 1) },
    (input) => { input.report.Results.splice(1, 1) },
    (input) => { delete input.report.Results[0].Packages },
    (input) => { input.report.Results[1].Packages = [] },
    (input) => { input.report.Results[0].Packages[0].Version = 'different' },
    (input) => { input.sbom.packages[1].externalRefs[0].referenceLocator = 'pkg:pypi/playwright@1.63.0' },
    (input) => { input.report.Results[0].ExperimentalModifiedFindings = [{ Type: 'vulnerability' }] },
    (input) => { input.report.Metadata.RepoDigests = ['sha256:wrong'] },
    (input) => { input.report.Results[0].Packages = [null] },
    (input) => { input.report.Results[0].Vulnerabilities = [null] },
    (input) => { delete input.report.Results[0].Class },
    (input) => { input.report.Results[0].Type = 'unknown' },
  ])('rejects schema, target, image or package coverage mismatch %#', (mutate) => {
    const input = base()
    mutate(input)
    expect(() => verifyContainerSupplyChain(input)).toThrow(/schema|scanner|image|artifact|target|coverage|package|OS/i)
  })
  it('does not confuse registry manifest digest with Docker configID', () => {
    const input = base()
    input.report.Metadata.RepoDigests = [`registry.example/navslides@sha256:${'b'.repeat(64)}`]
    expect(verifyContainerSupplyChain(input).status).toBe('passed')
    input.report.Metadata.ImageID = `sha256:${'b'.repeat(64)}`
    expect(() => verifyContainerSupplyChain(input)).toThrow(/image/i)
  })
  it.each(['HIGH', 'CRITICAL'])('rejects unapproved %s even without a fix', (severity) => {
    const input = withFinding()
    input.report.Results[0].Vulnerabilities[0].Severity = severity
    expect(() => verifyContainerSupplyChain(input)).toThrow(/CVE-2026-12345/)
  })
  it('requires owner, reason, exact CVE/package and unexpired exception', () => {
    const input = withFinding()
    const exception = { id: 'CVE-2026-12345', package: 'libc6', owner: 'test-security', reason: 'test-only reviewed risk', expires: '2999-01-01T00:00:00.000Z' }
    input.policy.exceptions = [exception]
    expect(verifyContainerSupplyChain(input).status).toBe('passed')
    for (const field of ['id', 'package', 'owner', 'reason']) {
      input.policy.exceptions = [{ ...exception, [field]: '' }]
      expect(() => verifyContainerSupplyChain(input)).toThrow(/exception/i)
    }
    for (const mismatch of [{ package: 'other' }, { id: 'CVE-2026-99999' }, { expires: '2000-01-01T00:00:00.000Z' }]) {
      input.policy.exceptions = [{ ...exception, ...mismatch }]
      expect(() => verifyContainerSupplyChain(input)).toThrow(/CVE|exception|expired/i)
    }
  })
  it('preserves policy and browser/SBOM invariants', () => {
    for (const mutate of [
      (input) => { input.actualImageID = `sha256:${'b'.repeat(64)}` },
      (input) => { input.browser.playwrightVersion = '1.62.0' },
      (input) => { input.browser.chromium.revision = '' },
      (input) => { input.sbom.packages = [] },
      (input) => { input.policy.failSeverities = ['CRITICAL'] },
    ]) {
      const input = base()
      mutate(input)
      expect(() => verifyContainerSupplyChain(input)).toThrow()
    }
  })
  it('retains LOW/MEDIUM findings and deterministic duplicate counts', () => {
    const input = base()
    input.report.Results[0].Vulnerabilities = [finding('LOW'), finding('MEDIUM'), finding('MEDIUM')]
    expect(verifyContainerSupplyChain(input).vulnerabilityCount).toBe(3)
  })
  it('writes a bounded receipt from the genuine clean fixture and explicit workflow evidence', async () => {
    const input = genuineInput('clean')
    const { out, args } = cliInputs(input)
    await runCli(args, now)
    expect(JSON.parse(readFileSync(out, 'utf8'))).toMatchObject({ schemaVersion: 2, status: 'passed', imageID: input.actualImageID, scannerVersion: '0.74.0' })
  })
  it('rejects real invocation evidence mutations and mismatched hashes', () => {
    for (const mutate of [
      (evidence) => { evidence.invocation.exitCode = 1 },
      (evidence) => { evidence.invocation.listAllPkgs = false },
      (evidence) => { evidence.invocation.pkgTypes = ['os'] },
      (evidence) => { evidence.scanner.VulnerabilityDB.NextUpdate = '2026-10-09T10:00:00Z' },
      (evidence) => { evidence.inputHashes.report = 'bad' },
      (evidence) => { evidence.browserImageID = `sha256:${'b'.repeat(64)}` },
      (evidence) => { evidence.invocation.ignoreUnfixed = true },
      (evidence) => { evidence.invocation.severities = ['CRITICAL'] },
      (evidence) => { evidence.scanner.Version = '0.73.0' },
      (evidence) => { evidence.scanner.VulnerabilityDB.UpdatedAt = 'invalid' },
    ]) {
      const input = base()
      input.scanEvidence = evidenceFor(input)
      mutate(input.scanEvidence)
      expect(() => verifyContainerSupplyChain(input)).toThrow(/scan|evidence|image|database/i)
    }
  })
  it.each(['{}', '{', 'null'])('does not write a passed CLI receipt for %s', async (report) => {
    const { dir, out, args } = cliInputs(base())
    writeFileSync(join(dir, 'report.json'), report)
    await expect(runCli(args)).rejects.toThrow()
    expect(existsSync(out)).toBe(false)
  })
  it('preserves raw invalid input and does not overwrite an existing receipt', async () => {
    const { dir, out, args } = cliInputs(base())
    writeFileSync(join(dir, 'report.json'), '{}')
    writeFileSync(out, 'prior receipt')
    await expect(runCli(args)).rejects.toThrow()
    expect(readFileSync(out, 'utf8')).toBe('prior receipt')
    expect(readFileSync(join(dir, 'report.json'), 'utf8')).toBe('{}')
  })
  it('rejects missing report files without a receipt', async () => {
    const { dir, out, args } = cliInputs(base())
    rmSync(join(dir, 'report.json'))
    await expect(runCli(args)).rejects.toThrow()
    expect(existsSync(out)).toBe(false)
  })
})
