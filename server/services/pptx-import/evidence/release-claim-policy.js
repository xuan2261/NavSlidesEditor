const { CLAIM_LEVELS: CLAIMS, claimIndex } = require('./claim-contract')

const LANES = Object.freeze([
  ['native-import', 'unit-lint', 'package-guards', 'durable-jobs', 'ownership',
    'exact-original', 'migration-restart'],
  ['no-edit-exact-bytes', 'opc-inventory', 'storage-recovery', 'package-security'],
  ['edited-preservation', 'officecli-qualified', 'process-containment', 'opc-graph',
    'native-reimport', 'impact', 'resource', 'security'],
  ['semantic', 'journal', 'patch', 'roundtrip', 'feature-coverage'],
  ['protected-powerpoint-provider'],
])

const TARGET_LANES = Object.freeze({
  server: [],
  docker: ['docker-package-no-officecli'],
  electron: ['electron-package-no-officecli'],
})

const WORDING = Object.freeze([
  [/powerpoint|1\s*:\s*1|visual fidelity|opens? in powerpoint/i, 4],
  [/editable|editability|semantic roundtrip/i, 3],
  [/valid edited|structurally valid/i, 2],
  [/package preserv|no-edit exact|exact bytes/i, 1],
  [/recover|recovery|original pptx/i, 0],
])

function requiredLanes(claim, targets = ['server']) {
  const index = claimIndex(claim)
  if (index < 0) throw new Error('invalid-claim-level')
  const lanes = LANES.slice(0, index + 1).flat()
  for (const target of targets) {
    if (!Object.hasOwn(TARGET_LANES, target)) throw new Error(`unsupported-target:${target}`)
    lanes.push(...TARGET_LANES[target])
  }
  return [...new Set(lanes)].sort()
}

function claimForWording(wording = '') {
  const match = WORDING.find(([pattern]) => pattern.test(wording))
  return match ? CLAIMS[match[1]] : null
}

function protectedReleaseAvailability(config = {}) {
  const evaluation = config && (config.evaluation || config.claimEvaluation)
  const evidence = evaluation?.evidence || evaluation?.attestation
  const authoritative = evaluation?.outcome === 'verified' &&
    evaluation?.passed === true &&
    evaluation?.claimLevel === CLAIMS[4] &&
    evidence?.protectedProvider === true &&
    evidence?.independentExternalSigner === true &&
    evidence?.immutableArtifact === true &&
    evidence?.teardownAttestation === true
  return {
    available: authoritative,
    authoritative,
    reason: authoritative ? null : 'protected-provider-unavailable',
  }
}

module.exports = {
  CLAIMS, TARGET_LANES, claimForWording, claimIndex, protectedReleaseAvailability, requiredLanes,
}
