import crypto from 'node:crypto'

export const IMAGE_ID = /^sha256:[a-f0-9]{64}$/
export const hashJson = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const text = (value) => typeof value === 'string' && value.trim().length > 0
const severities = new Set(['UNKNOWN', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const osPackageTypes = new Set(['deb', 'apk', 'rpm'])
const languageTypes = { npm: ['node-pkg', 'npm', 'yarn', 'pnpm'], pypi: ['python-pkg', 'pip', 'pipenv', 'poetry', 'uv'], gem: ['gemspec', 'bundler'], golang: ['gobinary', 'gomod'], maven: ['jar', 'pom', 'gradle'], nuget: ['dotnet-core', 'nuget'], cargo: ['cargo', 'rustbinary'], composer: ['composer'] }

export function scanEvidence(input, scanner, invocation) {
  return {
    schemaVersion: 1, imageID: input.actualImageID,
    sbomImageID: input.actualImageID, browserImageID: input.actualImageID,
    scanner, invocation,
    inputHashes: Object.fromEntries(['report', 'sbom', 'browser'].map((key) => [key, hashJson(input[key])])),
  }
}

export function assertInvocation(input, now) {
  const evidence = input.scanEvidence
  const invocation = evidence?.invocation
  const db = evidence?.scanner?.VulnerabilityDB
  if (!Number.isFinite(now) || !object(evidence) || evidence.schemaVersion !== 1 || evidence.scanner?.Version !== '0.74.0' ||
      db?.Version !== 2 || ![db.UpdatedAt, db.NextUpdate, db.DownloadedAt].every((date) => text(date) && Number.isFinite(Date.parse(date))) ||
      Date.parse(db.UpdatedAt) > now || Date.parse(db.NextUpdate) <= now || Date.parse(db.DownloadedAt) > now) {
    throw new Error('scanner invocation evidence or database metadata is invalid or stale')
  }
  if ([evidence.imageID, evidence.sbomImageID, evidence.browserImageID].some((id) => id !== input.actualImageID)) {
    throw new Error('scanner/SBOM/browser image evidence mismatch')
  }
  if (!object(invocation) || invocation.target !== input.expected.artifactName || invocation.exitCode !== 0 ||
      invocation.listAllPkgs !== true || invocation.ignoreUnfixed !== false ||
      JSON.stringify(invocation.scanners) !== '["vuln"]' || JSON.stringify(invocation.pkgTypes) !== '["os","library"]' ||
      JSON.stringify(invocation.severities) !== '["HIGH","CRITICAL"]') throw new Error('scanner invocation coverage is incomplete')
  for (const key of ['report', 'sbom', 'browser']) {
    if (evidence.inputHashes?.[key] !== hashJson(input[key])) throw new Error(`scanner evidence ${key} hash mismatch`)
  }
}

export function assertTrivyReport(report, expected, actualImageID, sbom) {
  if (!object(report) || report.SchemaVersion !== 2) throw new Error('unsupported Trivy report schema')
  if (report.Trivy?.Version !== '0.74.0') throw new Error('unsupported Trivy scanner version')
  if (!text(expected.artifactName) || !text(expected.osFamily)) throw new Error('expected scanner artifact and OS coverage are required')
  if (report.ArtifactType !== 'container_image' || report.ArtifactName !== expected.artifactName) throw new Error('scanner artifact target mismatch')
  if (report.Metadata?.ImageID !== actualImageID) throw new Error('scanner image configID mismatch')
  if (Object.hasOwn(report.Metadata ?? {}, 'RepoDigests') && (!Array.isArray(report.Metadata.RepoDigests) || !report.Metadata.RepoDigests.every((digest) => text(digest) && /^.+@sha256:[a-f0-9]{64}$/.test(digest)))) throw new Error('scanner registry image digest metadata is invalid')
  const os = report.Metadata?.OS
  if (!object(os) || !text(os.Family) || !text(os.Name) || os.Family !== expected.osFamily || report.Metadata?.ImageConfig?.os !== 'linux') {
    throw new Error('scanner Linux OS metadata mismatch')
  }
  if (!Array.isArray(report.Results) || !report.Results.length) throw new Error('scanner Results coverage is incomplete')
  if (!Array.isArray(expected.requiredLanguageTypes) || !expected.requiredLanguageTypes.every(text)) throw new Error('expected package coverage is required')
  const inventories = new Map()
  const languages = new Set()
  let osCoverage = false
  const findings = []
  for (const result of report.Results) {
    if (!object(result) || !text(result.Target) || !text(result.Type) || !['os-pkgs', 'lang-pkgs'].includes(result.Class)) throw new Error('scanner result schema is invalid')
    if (!Array.isArray(result.Packages) || !result.Packages.length) throw new Error('scanner package coverage is incomplete')
    if (result.Class === 'os-pkgs') {
      if (result.Type !== os.Family || result.Target !== `${expected.artifactName} (${os.Family} ${os.Name})`) throw new Error('scanner OS target coverage mismatch')
      osCoverage = true
    } else languages.add(result.Type)
    const inventory = inventories.get(result.Type) ?? new Set()
    for (const pkg of result.Packages) {
      if (!object(pkg) || !text(pkg.Name) || !text(pkg.Version)) throw new Error('scanner package identity is invalid')
      const version = `${pkg.Epoch ? `${pkg.Epoch}:` : ''}${pkg.Version}${pkg.Release ? `-${pkg.Release}` : ''}`
      inventory.add(`${pkg.Name}@${version}`)
    }
    inventories.set(result.Type, inventory)
    if (Object.hasOwn(result, 'Vulnerabilities') && !Array.isArray(result.Vulnerabilities)) throw new Error('scanner vulnerabilities must be an array')
    if (Object.hasOwn(result, 'ExperimentalModifiedFindings') && (!Array.isArray(result.ExperimentalModifiedFindings) || result.ExperimentalModifiedFindings.length)) throw new Error('scanner suppressed findings are not allowed')
    for (const finding of result.Vulnerabilities ?? []) {
      if (!object(finding) || !text(finding.VulnerabilityID) || !text(finding.PkgName) || !text(finding.InstalledVersion)) throw new Error('scanner finding identity is invalid')
      if (!severities.has(finding.Severity)) throw new Error('scanner finding severity is invalid')
      if (!inventory.has(`${finding.PkgName}@${finding.InstalledVersion}`)) throw new Error('scanner finding package coverage mismatch')
      findings.push({ ...finding, target: result.Target })
    }
  }
  if (!osCoverage || expected.requiredLanguageTypes.some((type) => !languages.has(type))) throw new Error('scanner OS/language coverage is incomplete')
  let osPackages = 0
  for (const pkg of sbom.packages ?? sbom.components) {
    if (!object(pkg)) throw new Error('SBOM package identity is invalid')
    const purls = pkg.purl ? [pkg.purl] : (pkg.externalRefs ?? []).filter((ref) => ref.referenceType === 'purl').map((ref) => ref.referenceLocator)
    for (const purl of purls) {
      if (!text(purl) || !/^pkg:[a-z]+\//.test(purl)) throw new Error('SBOM package purl is invalid')
      const type = purl.slice(4, purl.indexOf('/'))
      const types = osPackageTypes.has(type) ? [os.Family] : languageTypes[type]
      if (!types) continue // Generic image/browser binaries are not vulnerability package targets.
      const name = pkg.name
      const version = pkg.versionInfo ?? pkg.version
      // Syft 1.52.0 uses go1.x.y for Go stdlib; Trivy 0.74.0 uses v1.x.y.
      const inventoryVersion = type === 'golang' && name === 'stdlib' && /^go1\.\d+\.\d+$/.test(version) ? `v${version.slice(2)}` : version
      if (!text(name) || !text(version) || !types.some((targetType) => inventories.get(targetType)?.has(`${name}@${version}`) || (inventoryVersion !== version && inventories.get(targetType)?.has(`${name}@${inventoryVersion}`)))) throw new Error(`scanner SBOM package coverage mismatch: ${name ?? 'unknown'}`)
      if (osPackageTypes.has(type)) osPackages += 1
    }
  }
  if (!osPackages) throw new Error('SBOM OS package coverage is incomplete')
  return findings
}
