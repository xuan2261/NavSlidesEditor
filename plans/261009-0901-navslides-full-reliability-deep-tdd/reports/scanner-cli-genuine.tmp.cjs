const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { pathToFileURL } = require('node:url')
const { spawnSync } = require('node:child_process')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-scanner-cli-proof-'))
  const receipt = { kind: 'genuine-disposable-scan-cli-replay', status: 'started', command: process.argv, recordedAt: new Date().toISOString(), limits: 'Reduced genuine Alpine scan. SBOM and browser inventory are explicitly synthetic contract inputs; not NavSlides candidate image or scanner attestation.', runs: [] }
  try {
    const raw = await fs.readFile('scripts/fixtures/trivy-v0.74.0-clean.json')
    const report = JSON.parse(raw), provenance = JSON.parse(await fs.readFile('scripts/fixtures/trivy-v0.74.0-clean-provenance.json'))
    assert.equal(sha(raw), provenance.fixtureSha256)
    receipt.provenance = provenance
    receipt.fixtureSha256 = sha(raw)
    receipt.sourceHashes = {}
    for (const name of ['scripts/verify-container-supply-chain.js', 'scripts/trivy-report-evidence.js']) receipt.sourceHashes[name] = sha(await fs.readFile(name))
    const policy = { schemaVersion: 1, failSeverities: ['HIGH', 'CRITICAL'], exceptions: [] }
    const sbom = { spdxVersion: 'SPDX-2.3', packages: report.Results.flatMap(result => result.Packages.map(pkg => ({ name: pkg.Name, versionInfo: pkg.Version, externalRefs: [{ referenceType: 'purl', referenceLocator: pkg.Identifier.PURL }] }))) }
    const browser = { playwrightVersion: '1.63.0', chromium: { revision: '1243', executablePath: '/synthetic-fixture/chromium' } }
    const { scanEvidence } = await import(pathToFileURL(path.resolve('scripts/trivy-report-evidence.js')).href)
    const evidence = scanEvidence({ report, sbom, browser, actualImageID: report.Metadata.ImageID }, { Version: provenance.scannerVersion, VulnerabilityDB: provenance.database }, { target: report.ArtifactName, exitCode: 0, listAllPkgs: true, ignoreUnfixed: false, scanners: ['vuln'], pkgTypes: ['os', 'library'], severities: ['HIGH', 'CRITICAL'] })
    const values = { policy, report, sbom, browser, 'scan-evidence': evidence }
    for (const [name, value] of Object.entries(values)) await fs.writeFile(path.join(root, `${name}.json`), JSON.stringify(value))
    await fs.writeFile(path.join(root, 'image-id.txt'), report.Metadata.ImageID)
    const args = Object.keys(values).flatMap(name => [`--${name}`, path.join(root, `${name}.json`)])
    args.push('--image-id', path.join(root, 'image-id.txt'), '--expected-image-id', report.Metadata.ImageID, '--artifact-name', report.ArtifactName, '--os-family', report.Metadata.OS.Family, '--language-types', 'none', '--playwright-version', browser.playwrightVersion, '--chromium-revision', browser.chromium.revision)
    for (const name of ['clean', 'truncated']) {
      const out = path.join(root, `${name}-receipt.json`)
      if (name === 'truncated') await fs.writeFile(path.join(root, 'report.json'), '{')
      const result = spawnSync(process.execPath, ['scripts/verify-container-supply-chain.js', ...args, '--out', out], { encoding: 'utf8', windowsHide: true })
      if (result.error) throw result.error
      const run = { name, exitCode: result.status, stdout: result.stdout, stderr: result.stderr }
      receipt.runs.push(run)
      if (name === 'clean') { assert.equal(result.status, 0); run.receipt = JSON.parse(await fs.readFile(out)); assert.equal(run.receipt.status, 'passed') }
      else { assert.equal(result.status, 1); await assert.rejects(fs.access(out), { code: 'ENOENT' }); run.successReceiptAbsent = true; assert.equal(await fs.readFile(path.join(root, 'report.json'), 'utf8'), '{') }
    }
    receipt.status = 'passed'
  } catch (error) { receipt.status = 'failed'; receipt.failure = error.stack; process.exitCode = 1 }
  finally { await fs.rm(root, { recursive: true, force: true }); receipt.ownedTempRootRemoved = true; await fs.writeFile('plans/261009-0901-navslides-full-reliability-deep-tdd/reports/scanner-cli-genuine-current02.json', JSON.stringify(receipt, null, 2), { flag: 'wx' }) }
  console.log(JSON.stringify({ status: receipt.status, failure: receipt.failure, runs: receipt.runs.map(({ name, exitCode }) => ({ name, exitCode })) }))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
