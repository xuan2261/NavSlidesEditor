import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach } from 'vitest'
import { verifyContainerSupplyChain as verify, runCli } from './verify-container-supply-chain.js'
import { scanEvidence } from './trivy-report-evidence.js'

export { runCli }
export const now = Date.parse('2026-10-09T10:05:00Z')
export const loadFixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/trivy-v0.74.0-${name}.json`, import.meta.url), 'utf8'))
const imageID = `sha256:${'a'.repeat(64)}`
// Synthetic boundary inputs/inventories are not actual scanner or candidate evidence.
export const base = () => ({
  policy: { schemaVersion: 1, failSeverities: ['HIGH', 'CRITICAL'], exceptions: [] },
  report: {
    SchemaVersion: 2, Trivy: { Version: '0.74.0' }, ArtifactName: 'navslides-editor:ci', ArtifactType: 'container_image',
    Metadata: { ImageID: imageID, OS: { Family: 'debian', Name: '12' }, ImageConfig: { os: 'linux' } },
    Results: [
      { Target: 'navslides-editor:ci (debian 12)', Class: 'os-pkgs', Type: 'debian', Packages: [{ Name: 'libc6', Version: '2.36' }] },
      { Target: 'Node.js', Class: 'lang-pkgs', Type: 'node-pkg', Packages: [{ Name: 'playwright', Version: '1.63.0' }] },
    ],
  },
  sbom: { spdxVersion: 'SPDX-2.3', packages: [
    { name: 'libc6', versionInfo: '2.36', externalRefs: [{ referenceType: 'purl', referenceLocator: 'pkg:deb/debian/libc6@2.36' }] },
    { name: 'playwright', versionInfo: '1.63.0', externalRefs: [{ referenceType: 'purl', referenceLocator: 'pkg:npm/playwright@1.63.0' }] },
  ] },
  browser: { playwrightVersion: '1.63.0', chromium: { revision: '1243', executablePath: '/ms-playwright/chromium-1243/chrome' } },
  expected: { imageID, playwrightVersion: '1.63.0', chromiumRevision: '1243', artifactName: 'navslides-editor:ci', osFamily: 'debian', requiredLanguageTypes: ['node-pkg'] },
  actualImageID: imageID,
})
export const evidenceFor = (input) => scanEvidence(input, {
  Version: '0.74.0', VulnerabilityDB: { Version: 2, UpdatedAt: '2026-10-09T07:05:00Z', NextUpdate: '2026-10-10T07:05:00Z', DownloadedAt: '2026-10-09T10:01:11Z' },
}, { target: input.expected.artifactName, exitCode: 0, listAllPkgs: true, ignoreUnfixed: false, scanners: ['vuln'], pkgTypes: ['os', 'library'], severities: ['HIGH', 'CRITICAL'] })
export const verifyContainerSupplyChain = (input) => verify({ ...input, scanEvidence: Object.hasOwn(input, 'scanEvidence') ? input.scanEvidence : evidenceFor(input) }, now)
export const genuineInput = (name) => {
  const input = base()
  input.report = loadFixture(name)
  input.actualImageID = input.report.Metadata.ImageID
  input.expected.imageID = input.actualImageID
  input.expected.artifactName = input.report.ArtifactName
  input.expected.osFamily = input.report.Metadata.OS.Family
  input.expected.requiredLanguageTypes = name === 'clean' ? [] : ['node-pkg']
  input.sbom.packages = input.report.Results.flatMap((result) => result.Packages.map((pkg) => ({
    name: pkg.Name, versionInfo: pkg.Version, externalRefs: [{ referenceType: 'purl', referenceLocator: pkg.Identifier.PURL }],
  })))
  return input
}
export const finding = (severity = 'HIGH') => ({ VulnerabilityID: 'CVE-2026-12345', PkgName: 'libc6', InstalledVersion: '2.36', Severity: severity })
export const withFinding = () => {
  const input = base()
  input.report.Results[0].Vulnerabilities = [finding()]
  return input
}
const dirs = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }) })
export const cliInputs = (input) => {
  const dir = mkdtempSync(join(tmpdir(), 'navslides-supply-chain-'))
  dirs.push(dir)
  input.scanEvidence = evidenceFor(input)
  for (const key of ['policy', 'report', 'sbom', 'browser', 'scanEvidence']) writeFileSync(join(dir, `${key}.json`), JSON.stringify(input[key]))
  writeFileSync(join(dir, 'image-id.txt'), `${input.actualImageID}\n`)
  const out = join(dir, 'receipt.json')
  return { dir, out, args: [
    '--policy', join(dir, 'policy.json'), '--report', join(dir, 'report.json'), '--sbom', join(dir, 'sbom.json'),
    '--browser', join(dir, 'browser.json'), '--scan-evidence', join(dir, 'scanEvidence.json'),
    '--image-id', join(dir, 'image-id.txt'), '--expected-image-id', input.expected.imageID,
    '--artifact-name', input.expected.artifactName, '--os-family', input.expected.osFamily,
    '--language-types', input.expected.requiredLanguageTypes.join(',') || 'none',
    '--playwright-version', input.expected.playwrightVersion, '--chromium-revision', input.expected.chromiumRevision, '--out', out,
  ] }
}
