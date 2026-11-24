import { createRequire } from 'node:module'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { inspectSemanticManifest, manifestDigest, sha256 } from './pptx-semantic-manifest.mjs'
import { verifyOperationResults, verifySemanticBinding } from './pptx-semantic-runner-results.mjs'
import { implementationDigest } from './pptx-semantic-source-subject.mjs'
import { verifyFeatureVisualEvidence } from './pptx-semantic-feature-visual.mjs'

const require = createRequire(import.meta.url)
const {
  evaluateEvidenceRun,
} = require('../../server/services/pptx-import/oracle/oracle-evidence-runner.js')
export { inspectSemanticManifest, verifyOperationResults }

export async function qualifySemanticCoverage({ root, manifest, evidenceDir }) {
  const inventory = await inspectSemanticManifest(root, manifest)
  const errors = [...inventory.errors]
  try {
    const reportBytes = await readFile(path.join(evidenceDir, 'semantic-tests.json'))
    const report = JSON.parse(reportBytes.toString('utf8'))
    const binding = JSON.parse(
      await readFile(path.join(evidenceDir, 'semantic-binding.json'), 'utf8')
    )
    errors.push(
      ...verifySemanticBinding(binding, {
        manifestDigest: manifestDigest(manifest),
        implementationDigest: await implementationDigest(root),
        runnerDigest: sha256(reportBytes),
      }).errors
    )
    const results = verifyOperationResults(manifest.operations, report)
    errors.push(...results.errors)
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
    errors.push('missing-semantic-runner-evidence')
  }
  let evidenceManifestPath = path.join(evidenceDir, 'oracle-manifest.json')
  try {
    await stat(evidenceManifestPath)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    evidenceManifestPath = null
  }
  const native = await evaluateEvidenceRun({
    evidenceManifestPath,
    roleReceiptsPath: path.join(evidenceDir, 'oracle-receipts.json'),
    corpusDir: path.resolve(root, 'server/data/test-corpus'),
    goldensDir: path.join(evidenceDir, 'goldens'),
    actualsDir: path.join(evidenceDir, 'actuals'),
  })
  errors.push(
    ...(native.gate?.integrity?.reasons || []),
    ...(native.gate?.qualification?.reasons || [])
  )
  if (native.gate?.qualification?.verdict !== 'passed') errors.push('native-visual-not-qualified')
  if (!manifest.featureFixtures?.length) errors.push('missing-semantic-feature-fixtures')
  for (const operation of manifest.operations) {
    if (
      !operation.fixtureIds?.length ||
      operation.fixtureIds.some(
        (id) => !manifest.featureFixtures.some((fixture) => fixture.id === id)
      )
    ) {
      errors.push(`missing-operation-source:${operation.id}`)
    }
  }
  errors.push(...(await verifyFeatureVisualEvidence({ root, manifest, evidenceDir })).reasons)
  return {
    qualified: errors.length === 0,
    scope: 'semantic-and-native-visual',
    manifestDigest: inventory.manifestDigest,
    errors: [...new Set(errors)].sort(),
  }
}

async function main(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--inventory') args.inventory = true
    else if (['--manifest', '--evidence'].includes(argv[i]) && argv[i + 1]) {
      args[argv[i].slice(2)] = argv[++i]
    } else throw new Error(`Unknown or incomplete argument: ${argv[i]}`)
  }
  if (!args.manifest || (!args.inventory && !args.evidence)) {
    throw new Error('Required: --manifest FILE and --evidence DIR (or --inventory)')
  }
  const root = process.cwd()
  const manifest = JSON.parse(await readFile(path.resolve(root, args.manifest), 'utf8'))
  const result = args.inventory
    ? await inspectSemanticManifest(root, manifest)
    : await qualifySemanticCoverage({
        root,
        manifest,
        evidenceDir: path.resolve(root, args.evidence),
      })
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = args.inventory ? (result.ok ? 0 : 1) : result.qualified ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
