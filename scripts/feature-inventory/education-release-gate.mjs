import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROOT, policyIdentity } from './education-release-policy.mjs'
import { assertFrozenSubject } from './education-qualification-stage.mjs'
import { assertArtifactIdentities } from './education-artifact-identities.mjs'
import { evaluateEvidence, mergePackageReceipt } from './education-evidence-validation.mjs'
import { acquireEvidenceOwnership } from './education-evidence-ownership.mjs'

export { evaluateEvidence, mergePackageReceipt } from './education-evidence-validation.mjs'
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const value = (args, name) => {
  const at = args.indexOf(name)
  return at < 0 ? undefined : args[at + 1]
}
export async function runEducationGate(args, root = ROOT) {
  const contextPath = resolve(
    value(args, '--context') ||
      process.env.NAVSLIDES_EDUCATION_CONTEXT ||
      resolve(root, '.tmp/education-qualification-context.json')
  )
  const evidencePath = resolve(
    value(args, '--evidence') ||
      process.env.NAVSLIDES_EDUCATION_EVIDENCE ||
      resolve(root, 'scripts/feature-inventory/reports/education-release-evidence.json')
  )
  const packageArgument = value(args, '--import-package-receipt')
  const packagePath = packageArgument && resolve(packageArgument)
  const output = resolve(
    value(args, '--report') ||
      resolve(root, 'scripts/feature-inventory/reports/education-release-gate.json')
  )
  const ownership = acquireEvidenceOwnership([evidencePath, packagePath, output])
  try {
    const context = readJson(contextPath)
    assertFrozenSubject(root, context)
    const { cells, policyHash } = await policyIdentity(root)
    if (context.policyHash !== policyHash)
      throw new Error('Required-cell policy differs from the frozen qualification subject.')
    assertArtifactIdentities(context)
    let evidence = ownership.read(evidencePath, context)
    if (packagePath) {
      const receipt = ownership.read(packagePath, context)
      if (receipt.executionFailures?.length)
        throw new Error('Packaged runtime has failed/skipped execution receipts.')
      evidence = mergePackageReceipt(evidence, receipt, context, cells)
      ownership.write(evidencePath, evidence)
    }
    const report = evaluateEvidence({ records: evidence.records, context, requiredCells: cells })
    if (evidence.executionFailures?.length) {
      report.ok = false
      report.failures.push(
        ...evidence.executionFailures.map((failure) => ({
          reason: 'Actual required journey did not pass.',
          ...failure,
        }))
      )
    }
    ownership.write(output, {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      runId: context.runId,
      subjectHash: context.subjectHash,
      policyHash,
      ...report,
    })
    return { ...report, reportPath: output }
  } finally {
    ownership.release()
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await runEducationGate(process.argv.slice(2))
    console.log(
      `[education-release-gate] ${report.passed}/${report.required} exact cells; missing:${report.missing.length} failures:${report.failures.length}; ${report.ok ? 'PASS' : 'FAIL'}`
    )
    if (!report.ok) process.exitCode = 1
  } catch (error) {
    console.error(`[education-release-gate] ${error.message}`)
    process.exitCode = 1
  }
}
