#!/usr/bin/env node
const fs = require('fs-extra')
const path = require('node:path')
const { CLAIM_LEVELS, evaluateClaim } = require('./evidence/evidence-contract')
const { parseTrustedConfig } = require('./evidence/trusted-config')

const MAX_ARTIFACTS = 256
const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024
const MAX_TOTAL_BYTES = 256 * 1024 * 1024
const SAFE_CLAIM = /^[a-z0-9-]+$/

function validClaimLevel(value) {
  return typeof value === 'string' && CLAIM_LEVELS.includes(value) && SAFE_CLAIM.test(value)
}

async function regularRealPath(filePath, root, maxBytes = MAX_ARTIFACT_BYTES) {
  const stat = await fs.lstat(filePath)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) throw new Error('invalid-evidence-file')
  const real = await fs.realpath(filePath)
  const realRoot = await fs.realpath(root)
  if (real !== realRoot && !real.startsWith(`${realRoot}${path.sep}`)) throw new Error('invalid-evidence-path')
  return { real, size: stat.size }
}

function parseArgs(argv) {
  const args = { claimLevel: null, json: false, milestone: null, runDir: null, trustRoot: null, trustedConfig: null }
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i]
    if (value === '--milestone') args.milestone = argv[++i]
    else if (value.startsWith('--milestone=')) args.milestone = value.slice(12)
    else if (value === '--claim-level') args.claimLevel = argv[++i]
    else if (value === '--run-dir') args.runDir = argv[++i]
    else if (value === '--trust-root') args.trustRoot = argv[++i]
    else if (value === '--trusted-config') args.trustedConfig = argv[++i]
    else if (value === '--json') args.json = true
  }
  return args
}

function writeClaimReport(report, json) {
  if (json) return process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  process.stdout.write(`PPTX claim ${report.claimLevel || 'invalid'}: ${report.passed ? 'PASS' : 'UNAVAILABLE'}\n`)
  for (const reason of report.reasons) process.stdout.write(`  ${reason}\n`)
}

async function readArtifactContents(runDir, manifest) {
  const contents = Object.create(null)
  const root = path.resolve(runDir)
  const artifacts = Array.isArray(manifest?.artifacts) ? manifest.artifacts : []
  if (artifacts.length > MAX_ARTIFACTS) throw new Error('artifact-count-limit')
  const seen = new Set()
  let total = 0
  for (const artifact of artifacts) {
    if (!artifact || typeof artifact.path !== 'string' || artifact.path.length === 0 || artifact.path.length > 240) {
      throw new Error('invalid-artifact-path')
    }
    if (seen.has(artifact.path)) throw new Error('duplicate-artifact-path')
    seen.add(artifact.path)
    const filePath = path.resolve(root, artifact.path)
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) throw new Error('invalid-artifact-path')
    const checked = await regularRealPath(filePath, root)
    total += checked.size
    if (total > MAX_TOTAL_BYTES) throw new Error('artifact-total-size-limit')
    contents[artifact.path] = await fs.readFile(checked.real)
  }
  return contents
}

function unavailable(claimLevel, reason, json) {
  writeClaimReport({ claimLevel: CLAIM_LEVELS.includes(claimLevel) ? claimLevel : null,
    outcome: 'unavailable', passed: false, reasons: [reason], wording: null }, json)
  return 1
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv)
  if (args.claimLevel != null && !validClaimLevel(args.claimLevel)) {
    return unavailable(null, 'invalid-claim-level', args.json)
  }
  if (args.milestone) return unavailable(args.claimLevel, 'legacy-milestone-unsupported', args.json)
  if (!args.runDir) return unavailable(args.claimLevel, 'fresh-composite-run-required', args.json)
  if (!args.trustRoot) return unavailable(args.claimLevel, 'trusted-root-required', args.json)
  if (!args.trustedConfig) return unavailable(args.claimLevel, 'trusted-config-required', args.json)
  const root = path.resolve(args.runDir)
  const trustPath = path.resolve(args.trustRoot)
  const configPath = path.resolve(args.trustedConfig)
  if ([trustPath, configPath].some((file) => file === root || file.startsWith(`${root}${path.sep}`))) {
    return unavailable(args.claimLevel, 'trust-root-must-be-independent', args.json)
  }
  let report
  try {
    const runRoot = await fs.realpath(root)
    const readRunJson = async (name) => {
      const file = path.join(runRoot, name)
      const checked = await regularRealPath(file, runRoot, MAX_ARTIFACT_BYTES)
      return fs.readJson(checked.real)
    }
    const trust = await regularRealPath(trustPath, path.dirname(trustPath), MAX_ARTIFACT_BYTES)
    const config = await regularRealPath(configPath, path.dirname(configPath), MAX_ARTIFACT_BYTES)
    const manifest = await readRunJson('manifest.json')
    report = evaluateClaim({ manifest, corpus: await readRunJson('corpus-manifest.json'),
      trustRoot: await fs.readJson(trust.real), trustedConfig: parseTrustedConfig(await fs.readJson(config.real)),
      ledger: await readRunJson('epoch-ledger.json'), artifactContents: await readArtifactContents(runRoot, manifest) })
  } catch { return unavailable(args.claimLevel, 'invalid-composite-run-file', args.json) }
  if (args.claimLevel && report.claimLevel !== args.claimLevel) {
    report = { ...report, passed: false, outcome: 'unavailable',
      reasons: [...new Set([...report.reasons, 'requested-claim-level-mismatch'])].sort(), claimLevel: args.claimLevel }
  }
  writeClaimReport(report, args.json)
  return report.passed ? 0 : 1
}

if (require.main === module) main().then((code) => { process.exitCode = code }).catch(() => { process.exitCode = 1 })
module.exports = { main, parseArgs, readArtifactContents }
