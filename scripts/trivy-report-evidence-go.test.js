import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assertTrivyReport } from './trivy-report-evidence.js'
import { base, cliInputs, evidenceFor, finding, now, runCli, verifyContainerSupplyChain } from './verify-container-supply-chain-test-inputs.js'

// Representation fixtures model pinned Syft 1.52.0 and Trivy 0.74.0, not image qualification.
function goInput(format = 'spdx') {
  const input = base()
  input.expected.requiredLanguageTypes.push('gobinary')
  input.report.Results.push({
    Target: '/usr/bin/rclone', Class: 'lang-pkgs', Type: 'gobinary',
    Packages: [{ Name: 'stdlib', Version: 'v1.26.1' }, { Name: 'github.com/rclone/rclone', Version: 'v1.73.0' }],
  })
  const packages = [
    { name: 'stdlib', versionInfo: 'go1.26.1', externalRefs: [{ referenceType: 'purl', referenceLocator: 'pkg:golang/stdlib@go1.26.1' }] },
    { name: 'github.com/rclone/rclone', versionInfo: 'v1.73.0', externalRefs: [{ referenceType: 'purl', referenceLocator: 'pkg:golang/github.com/rclone/rclone@v1.73.0' }] },
  ]
  input.sbom.packages.push(...packages)
  if (format === 'cyclonedx') {
    input.sbom = { bomFormat: 'CycloneDX', components: input.sbom.packages.map((pkg) => ({
      name: pkg.name, version: pkg.versionInfo, purl: pkg.externalRefs[0].referenceLocator,
    })) }
  }
  return input
}

function reportFindings(input) {
  return assertTrivyReport(input.report, input.expected, input.actualImageID, input.sbom)
}

describe('Go stdlib scanner identity across pinned inventory formats', () => {
  it.each(['spdx', 'cyclonedx'])('admits equivalent Syft go and Trivy v stdlib identities in %s without rewriting inputs', (format) => {
    const input = goInput(format)
    const before = structuredClone(input)
    expect(reportFindings(input)).toEqual([])
    expect(verifyContainerSupplyChain(input)).toMatchObject({ status: 'passed', vulnerabilityCount: 0 })
    expect(input).toEqual(before)
  })

  it.each(['go1.26.1', 'v1.26.1'])('retains exact raw Go stdlib identity %s', (version) => {
    const input = goInput()
    input.report.Results[2].Packages[0].Version = version
    input.sbom.packages[2].versionInfo = version
    input.sbom.packages[2].externalRefs[0].referenceLocator = `pkg:golang/stdlib@${version}`
    expect(reportFindings(input)).toEqual([])
    expect(verifyContainerSupplyChain(input).status).toBe('passed')
  })

  it('writes a CLI receipt bound to the original equivalent Go inventories', async () => {
    const input = goInput()
    const { out, args } = cliInputs(input)
    const receipt = await runCli(args, now)
    expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual(receipt)
    expect(receipt).toMatchObject({ status: 'passed', scannerVersion: '0.74.0', imageID: input.actualImageID })
    expect(receipt.reportHash).toBe(input.scanEvidence.inputHashes.report)
    expect(receipt.sbomHash).toBe(input.scanEvidence.inputHashes.sbom)
  })

  it('retains Go findings and still rejects severe findings with equivalent stdlib coverage', () => {
    const input = goInput()
    const low = { ...finding('LOW'), PkgName: 'stdlib', InstalledVersion: 'v1.26.1' }
    input.report.Results[2].Vulnerabilities = [low]
    expect(reportFindings(input)).toEqual([{ ...low, target: '/usr/bin/rclone' }])
    expect(verifyContainerSupplyChain(input).vulnerabilityCount).toBe(1)
    input.report.Results[2].Vulnerabilities[0].Severity = 'HIGH'
    expect(() => verifyContainerSupplyChain(input)).toThrow(/unapproved vulnerabilities/)
  })

  it.each([
    ['different stdlib version', (input) => { input.report.Results[2].Packages[0].Version = 'v1.26.2' }],
    ['different stdlib ecosystem', (input) => { input.report.Results[2].Type = 'node-pkg' }],
    ['missing Go coverage', (input) => { input.report.Results.pop() }],
    ['non-stdlib Go alias', (input) => { input.report.Results[2].Packages[1].Version = 'go1.73.0' }],
    ['non-Go stdlib alias', (input) => {
      input.sbom.packages[2].externalRefs[0].referenceLocator = 'pkg:npm/stdlib@go1.26.1'
      input.report.Results[1].Packages.push({ Name: 'stdlib', Version: 'v1.26.1' })
    }],
    ['different Node version', (input) => { input.report.Results[1].Packages[0].Version = 'v1.63.0' }],
  ])('rejects %s rather than broadening version or ecosystem equivalence', async (_label, mutate) => {
    const input = goInput()
    mutate(input)
    expect(() => reportFindings(input)).toThrow(/coverage/)
    const { out, args } = cliInputs(input)
    await expect(runCli(args, now)).rejects.toThrow(/coverage/)
    expect(existsSync(out)).toBe(false)
  })

  it.each([
    ['scanner pin', (evidence) => { evidence.scanner.Version = '0.73.0' }],
    ['severity configuration', (evidence) => { evidence.invocation.severities = ['CRITICAL'] }],
    ['package configuration', (evidence) => { evidence.invocation.pkgTypes = ['os'] }],
    ['raw input binding', (evidence) => { evidence.inputHashes.sbom = 'different' }],
  ])('still enforces %s after admitting equivalent stdlib identity', (_label, mutate) => {
    const input = goInput()
    input.scanEvidence = evidenceFor(input)
    mutate(input.scanEvidence)
    expect(() => verifyContainerSupplyChain(input)).toThrow(/invocation|evidence/)
  })
})
