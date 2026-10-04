const { SCHEMA_VERSION, CELL_FIELDS } = require('./release-capabilities.js')
const HASH = /^[a-f0-9]{64}$/
const RESULTS = new Set(['passed', 'failed', 'skipped', 'timedOut', 'interrupted'])
const CERTIFICATION_KEYS = new Set([
  'passed',
  'pass',
  'status',
  'result',
  'success',
  'ok',
  'testPassed',
  'testTitle',
  'certified',
  'testsPassed',
])
function behaviorObservation(value) {
  if (typeof value === 'string')
    return (
      value.trim().length > 8 &&
      !/^(?:test\s+)?pass(?:ed)?$|^success$|^ok$|^all (?:tests )?passed$|^test passed$/i.test(
        value.trim()
      )
    )
  if (Array.isArray(value))
    return (
      value.length > 0 &&
      value.some(
        (item) =>
          (typeof item === 'string' && item.trim().length > 0) ||
          (typeof item === 'number' && Number.isFinite(item)) ||
          typeof item === 'boolean' ||
          behaviorObservation(item)
      )
    )
  if (!value || typeof value !== 'object') return false
  if (
    Object.keys(value).every((key) => CERTIFICATION_KEYS.has(key)) &&
    !Object.values(value).some(
      (item) => item && typeof item === 'object' && behaviorObservation(item)
    )
  )
    return false
  return Object.entries(value).some(
    ([key, item]) =>
      key.trim().length > 0 &&
      (typeof item === 'boolean' ||
        (typeof item === 'number' && Number.isFinite(item)) ||
        (typeof item === 'string' && item.length > 0) ||
        behaviorObservation(item))
  )
}
function validateScenario(scenario) {
  if (!scenario || typeof scenario !== 'object')
    throw new Error('Scenario evidence must be an object.')
  for (const field of CELL_FIELDS) {
    if (!(field in scenario)) throw new Error(`Missing scenario identity: ${field}`)
    if (
      !['gameType', 'questionKind', 'presetId'].includes(field) &&
      (typeof scenario[field] !== 'string' || !scenario[field])
    )
      throw new Error(`Invalid scenario identity: ${field}`)
    if (
      ['gameType', 'questionKind', 'presetId'].includes(field) &&
      scenario[field] !== null &&
      (typeof scenario[field] !== 'string' || !scenario[field])
    )
      throw new Error(`Invalid nullable scenario discriminator: ${field}`)
  }
  if (!behaviorObservation(scenario.expected) || !behaviorObservation(scenario.observed))
    throw new Error(
      'Explicit expected and observed behavior is required; test-pass certification is not evidence.'
    )
  if (!RESULTS.has(scenario.result)) throw new Error(`Invalid observed result: ${scenario.result}`)
  if (
    !Array.isArray(scenario.artifactPaths) ||
    !scenario.artifactPaths.every((path) => typeof path === 'string' && path.length > 0)
  )
    throw new Error('Scenario artifact paths must be an array of file paths.')
  if (
    !Array.isArray(scenario.limitations) ||
    !scenario.limitations.every((item) => typeof item === 'string')
  )
    throw new Error('Scenario limitations must be a text array.')
  return scenario
}
function validateEvidenceRecord(record) {
  validateScenario(record)
  if (record.schemaVersion !== SCHEMA_VERSION)
    throw new Error('Unsupported evidence schema version.')
  for (const field of ['subjectHash', 'policyHash'])
    if (!HASH.test(record[field])) throw new Error(`Invalid ${field}.`)
  for (const field of [
    'runId',
    'runtimeVersion',
    'environment',
    'browser',
    'browserVersion',
    'project',
    'protocol',
    'testTitle',
    'timestamp',
  ])
    if (typeof record[field] !== 'string' || !record[field])
      throw new Error(`Missing execution evidence: ${field}`)
  if (!Number.isFinite(Date.parse(record.timestamp)))
    throw new Error('Invalid execution timestamp.')
  if (
    !record.viewport ||
    !Number.isInteger(record.viewport.width) ||
    !Number.isInteger(record.viewport.height) ||
    record.viewport.width < 1 ||
    record.viewport.height < 1 ||
    record.viewport.width > 16384 ||
    record.viewport.height > 16384
  )
    throw new Error('Invalid actual viewport.')
  if (
    !record.artifactHashes ||
    !Object.keys(record.artifactHashes).length ||
    !Object.values(record.artifactHashes).every((hash) => HASH.test(hash))
  )
    throw new Error('Exact artifact identities are required.')
  if (
    !record.artifactPaths.length ||
    !record.artifactFileHashes ||
    !record.artifactPaths.every((path) => HASH.test(record.artifactFileHashes[path]))
  )
    throw new Error('Hashed observation attachments are required.')
  return record
}
module.exports = {
  SCHEMA_VERSION,
  HASH,
  behaviorObservation,
  validateScenario,
  validateEvidenceRecord,
}
