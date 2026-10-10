import crypto from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')
const pick = (value, fields) => Object.fromEntries(fields.filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]]))

// Reproducible reduction only: never remove a target, package or finding.
export function reduceTrivyCapture(report) {
  if (report?.SchemaVersion !== 2 || report?.Trivy?.Version !== '0.74.0' || !Array.isArray(report.Results)) {
    throw new Error('a genuine pinned Trivy v0.74.0 capture is required')
  }
  return {
    ...pick(report, ['SchemaVersion', 'Trivy', 'ReportID', 'CreatedAt', 'ArtifactName', 'ArtifactType']),
    Metadata: { ...pick(report.Metadata, ['ImageID', 'OS', 'RepoDigests']), ImageConfig: pick(report.Metadata.ImageConfig, ['os']) },
    Results: report.Results.map((result) => ({
      ...pick(result, ['Target', 'Class', 'Type']),
      ...(result.Packages ? { Packages: result.Packages.map((pkg) => pick(pkg, ['Name', 'Version', 'Identifier'])) } : {}),
      ...(result.Vulnerabilities ? { Vulnerabilities: result.Vulnerabilities.map((finding) => pick(finding, ['VulnerabilityID', 'PkgName', 'InstalledVersion', 'FixedVersion', 'Status', 'Severity'])) } : {}),
    })),
  }
}

export async function captureFixture(rawPath, outPath, databasePath, severity) {
  if (!['HIGH,CRITICAL', 'UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL'].includes(severity)) throw new Error('unsupported capture severity filter')
  const raw = await readFile(rawPath)
  const database = await readFile(databasePath)
  const report = JSON.parse(raw)
  const fixture = reduceTrivyCapture(report)
  const content = `${JSON.stringify(fixture, null, 2)}\n`
  const provenance = {
    kind: 'actual-disposable-remote-image-scan', scannerVersion: '0.74.0',
    binarySource: 'https://github.com/aquasecurity/trivy/releases/download/v0.74.0/trivy_0.74.0_windows-64bit.zip',
    binaryArchiveSha256: '94c40e0696e4b907a74b7b2e1438d5d72ebaca83115817407f568a002d520842',
    binaryVerification: 'SHA256 matched primary GitHub release asset digest and checksum manifest; signature not verified',
    command: ['trivy.exe', 'image', '--cache-dir', '<isolated-temp>/cache', '--image-src', 'remote', '--scanners', 'vuln', '--pkg-types', 'os,library', '--list-all-pkgs', '--severity', severity, '--ignore-unfixed=false', '--exit-code', '0', '--format', 'json', '--output', '<raw-capture>', report.ArtifactName],
    imageConfigID: report.Metadata.ImageID, registryManifestDigests: report.Metadata.RepoDigests,
    database: JSON.parse(database), databaseMetadataSha256: digest(database), rawReportSha256: digest(raw), fixtureSha256: digest(content),
    capturedAt: report.CreatedAt,
    reduction: 'Preserved every target/package/finding and its identity. Omitted descriptions, references, image history/layers and ancillary package metadata. No findings pruned by reducer.',
    qualification: severity === 'HIGH,CRITICAL' ? 'Policy-filtered capture; clean is not all-severity vulnerability-free.' : 'All-severity capture.',
    limits: 'Disposable image schema evidence only, not NavSlides candidate runtime qualification or scanner attestation. SBOM/browser test inputs are synthetic unless separately captured.',
  }
  await writeFile(outPath, content, { flag: 'wx' })
  await writeFile(outPath.replace(/\.json$/, '-provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`, { flag: 'wx' })
  return provenance
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  captureFixture(...process.argv.slice(2)).catch((error) => { console.error(error.message); process.exitCode = 1 })
}
