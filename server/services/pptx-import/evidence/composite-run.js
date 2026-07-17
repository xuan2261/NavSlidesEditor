const { evaluateClaim } = require('./claim-evaluator')
const { claimIndex, requiredLanes } = require('./release-claim-policy')
const { cloneFrozen, INVALID, isPlainRecord, ownData } = require('../own-plain-data')

function environmentManifest() {
  return Object.freeze({ node: process.version, platform: process.platform, arch: process.arch })
}

function shardId(lane) {
  return `${lane.lane}:${lane.shard?.index}/${lane.shard?.total}`
}

function normalizeLanes(lanes) {
  if (!Array.isArray(lanes)) return Object.freeze([])
  try {
    return Object.freeze(lanes.map((lane) => {
      const value = cloneFrozen(lane)
      return Object.freeze({ lane: value.lane || null, shard: value.shard || null, result: value.result || null })
    }).filter((lane) => lane.lane !== null))
  } catch {
    return Object.freeze([])
  }
}

function requiredLaneReasons(required, lanes) {
  const reasons = []
  for (const name of required) {
    const matches = lanes.filter((lane) => lane.lane === name)
    if (!matches.length) {
      reasons.push(`required-lane-missing:${name}`)
      continue
    }
    if (matches.some((lane) => lane.result !== 'pass')) {
      reasons.push(`required-lane-failed:${name}`)
      continue
    }
    const sharded = matches.filter((lane) => lane.shard)
    if (!sharded.length) continue
    const total = sharded[0].shard?.total
    const indexes = new Set(sharded.map((lane) => lane.shard?.index))
    const validShardSet = Number.isSafeInteger(total) && total > 0 &&
      sharded.length === total && indexes.size === total &&
      [...indexes].every((index) => Number.isSafeInteger(index) && index >= 1 && index <= total)
    if (sharded.length !== matches.length || !validShardSet) {
      reasons.push(`required-lane-shards-incomplete:${name}`)
    }
  }
  return reasons
}

function normalizeCompositeEvidence(input = {}, trustedConfig) {
  if (!isPlainRecord(input)) return { manifest: null }
  const read = (field) => ownData(input, field)
  try {
    const value = cloneFrozen({
      manifest: read('manifest') === INVALID ? null : read('manifest'),
      corpus: read('corpus') === INVALID ? null : read('corpus'),
      trustRoot: read('trustRoot') === INVALID ? null : read('trustRoot'),
      trustedConfig: trustedConfig === undefined
        ? (read('trustedConfig') === INVALID ? null : read('trustedConfig'))
        : trustedConfig,
      ledger: read('ledger') === INVALID ? null : read('ledger'),
    })
    return { ...value, artifactContents: read('artifactContents') === INVALID ? null : read('artifactContents') }
  } catch { return { manifest: null } }
}

function aggregateCompositeRun(input = {}, trustedConfig) {
  const evidence = normalizeCompositeEvidence(input, trustedConfig)
  const result = evaluateClaim(evidence)
  const lanes = normalizeLanes(isPlainRecord(input) ? ownData(input, 'lanes') : null)
  const targets = isPlainRecord(input) ? ownData(input, 'targets') : null
  const requestedClaim = isPlainRecord(input) ? ownData(input, 'requestedClaimLevel') : null
  const normalizedTargets = Array.isArray(targets) && targets.length ? targets : ['server']
  let required = []
  const reasons = [...result.reasons]
  try {
    required = result.claimLevel ? requiredLanes(result.claimLevel, normalizedTargets) : []
  } catch {
    reasons.push('invalid-required-lanes')
  }
  reasons.push(...requiredLaneReasons(required, lanes))
  const requestedIndex = claimIndex(requestedClaim || result.claimLevel)
  const claimedIndex = claimIndex(result.claimLevel)
  if (requestedIndex >= 0 && requestedIndex !== claimedIndex) reasons.push('requested-claim-level-mismatch')
  return {
    ...result,
    passed: reasons.length === 0 && result.passed,
    reasons: [...new Set(reasons)].sort(),
    requiredLanes: required,
    lanes,
    environment: environmentManifest(),
  }
}

module.exports = {
  aggregateCompositeRun,
  environmentManifest,
  normalizeCompositeEvidence,
  normalizeLanes,
  requiredLaneReasons,
  shardId,
}
