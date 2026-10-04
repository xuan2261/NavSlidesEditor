import release from '../../shared/src/education/release-capabilities.js'
import schema from '../../shared/src/education/release-evidence-schema.js'
import { verifyObservationArtifacts } from './education-evidence-files.mjs'
import { resolve } from 'node:path'
const { cellKey } = release
const equal = (left, right) =>
  JSON.stringify(Object.entries(left || {}).sort()) ===
  JSON.stringify(Object.entries(right || {}).sort())

export function recordProblems(record, context, requiredMap, verifyArtifacts) {
  const errors = []
  try {
    schema.validateEvidenceRecord(record)
  } catch (error) {
    errors.push(error.message)
  }
  const required = requiredMap.get(cellKey(record))
  if (!required) errors.push('Unknown or wrong-scope required cell.')
  for (const key of ['schemaVersion', 'runId', 'subjectHash', 'policyHash'])
    if (record[key] !== context[key]) errors.push(`Wrong ${key}.`)
  const lane = context.lanes?.[record.lane]
  if (!lane) errors.push('Missing frozen artifact lane.')
  else {
    if (!equal(record.artifactHashes, lane.artifactHashes))
      errors.push('Stale or mismatched lane artifact identity.')
    for (const key of ['runtimeVersion', 'environment', 'browser'])
      if (record[key] !== lane[key]) errors.push(`Wrong lane ${key}.`)
    if (!(lane.projects || [lane.project]).includes(record.project))
      errors.push('Wrong browser project.')
    if (!(Array.isArray(lane.protocol) ? lane.protocol : [lane.protocol]).includes(record.protocol))
      errors.push('Wrong execution protocol.')
    if (lane.origins && !lane.origins.includes(record.origin))
      errors.push('Wrong production artifact origin.')
    if (
      lane.viewport &&
      (record.viewport?.width !== lane.viewport.width ||
        record.viewport?.height !== lane.viewport.height)
    )
      errors.push('Wrong actual viewport.')
    if (lane.browserVersion && record.browserVersion !== lane.browserVersion)
      errors.push('Wrong browser version.')
    if (lane.artifactPaths?.exe) {
      const normalize = (path) =>
        process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path)
      if (
        !record.executablePath ||
        normalize(record.executablePath) !== normalize(lane.artifactPaths.exe)
      )
        errors.push('Wrong actual launched executable path.')
    }
  }
  if (
    Date.parse(record.timestamp) < Date.parse(context.frozenAt) ||
    Date.parse(record.timestamp) > Date.now() + 300000
  )
    errors.push('Stale or future execution timestamp.')
  if (record.surface === 'file' && record.protocol !== 'file:')
    errors.push('Portable evidence was not observed through file protocol.')
  if (record.lane === 'windows-packaged' && record.environment !== 'win32')
    errors.push('Packaged receipt was not observed on Windows.')
  if (record.mode === 'live' && !['http:', 'https:'].includes(record.protocol))
    errors.push('Live evidence lacks hosted transport.')
  const width = /^responsive-(\d+)$/.exec(record.scenarioId)?.[1]
  if (width && record.viewport?.width !== Number(width))
    errors.push('Responsive scenario viewport mismatch.')
  if (record.result !== 'passed') errors.push(`Required execution did not pass: ${record.result}.`)
  if (!verifyArtifacts(record)) errors.push('Missing or changed observation artifact bytes.')
  return errors
}
export function evaluateEvidence({
  records,
  context,
  requiredCells,
  verifyArtifacts = verifyObservationArtifacts,
}) {
  if (
    !Array.isArray(records) ||
    !Array.isArray(requiredCells) ||
    !requiredCells.length ||
    !context ||
    !Number.isFinite(Date.parse(context.frozenAt))
  )
    return {
      ok: false,
      missing: [],
      failures: [{ reason: 'Invalid qualification context or required evidence manifest.' }],
      required: requiredCells?.length || 0,
      passed: 0,
    }
  const requiredMap = new Map(requiredCells.map((cell) => [cellKey(cell), cell]))
  const seen = new Set(),
    failures = []
  for (const record of records) {
    if (!record || typeof record !== 'object') {
      failures.push({ reason: 'Malformed evidence record.' })
      continue
    }
    const key = cellKey(record)
    const errors = recordProblems(record, context, requiredMap, verifyArtifacts)
    if (errors.length) failures.push({ cell: key, testTitle: record.testTitle, reasons: errors })
    else seen.add(key)
  }
  const missing = [...requiredMap.keys()].filter((key) => !seen.has(key))
  return {
    ok: failures.length === 0 && missing.length === 0,
    required: requiredMap.size,
    passed: seen.size,
    missing,
    failures,
  }
}
export function mergePackageReceipt(
  evidence,
  receipt,
  context,
  requiredCells,
  verifyArtifacts = verifyObservationArtifacts
) {
  const lane = context.lanes?.['windows-packaged']
  if (!lane) throw new Error('Frozen Windows packaged artifact identity is absent.')
  if (receipt.executionFailures?.length)
    throw new Error('Package receipt contains failed or skipped journeys.')
  for (const key of ['schemaVersion', 'runId', 'subjectHash', 'policyHash'])
    if (receipt[key] !== context[key]) throw new Error(`Package receipt ${key} mismatch.`)
  for (const key of ['installer', 'exe', 'client', 'shared', 'vendor'])
    if (
      !schema.HASH.test(receipt.artifactHashes?.[key]) ||
      receipt.artifactHashes[key] !== lane.artifactHashes?.[key]
    )
      throw new Error(`Package ${key} identity mismatch.`)
  if (
    !Array.isArray(receipt.records) ||
    receipt.records.some((record) => record.lane !== 'windows-packaged')
  )
    throw new Error('Package receipt contains missing or wrong-lane records.')
  const result = evaluateEvidence({
    records: receipt.records,
    context,
    requiredCells: requiredCells.filter((cell) => cell.lane === 'windows-packaged'),
    verifyArtifacts,
  })
  if (!result.ok) throw new Error(`Package qualification refused: ${JSON.stringify(result)}`)
  return { ...evidence, records: [...(evidence.records || []), ...receipt.records] }
}
