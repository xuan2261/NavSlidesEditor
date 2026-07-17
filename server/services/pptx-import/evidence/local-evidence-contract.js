const { CLAIM_LEVELS } = require('./claim-contract')
const { hashCanonical } = require('./canonical-hash')
const { canonicalMatrixSubject, verifyLocalEvidenceManifest } = require('./local-evidence-validator')
const {
  BOUNDED_COMPATIBILITY, LOCAL_AUTHORITY, LOCAL_EVIDENCE_SCHEMA_VERSION,
  LOCAL_LIMITATIONS, isRecord, isSha256, unique,
} = require('./local-evidence-values')

const FORBIDDEN_CAPABILITY_FIELDS = new Set([
  'packagePath', 'sourceRef', 'sourceRefs', 'journal', 'journals', 'executablePath',
  'workspacePath', 'localUsername', 'machineId', 'command', 'commands', 'output',
  'outputs', 'receipt', 'receipts', 'owner', 'ownerIdentity', 'artifactLocator',
])
const SAFE_ENVIRONMENT_DIGESTS = new Set([
  'windowsDigest', 'officeDigest', 'officeCliDigest', 'fontSetDigest',
  'localeDigest', 'dpiDigest', 'configurationDigest',
])

function localClaimCeiling(claimLadder) {
  const verified = CLAIM_LEVELS.filter((level) => claimLadder[level]?.verdict === 'verified')
  return verified.at(-1) || null
}

function buildLocalEvidenceManifest({ subject, stage, artifacts, claimLadder, compatibility } = {}) {
  const canonicalSubject = {
    ...subject,
    matrix: subject?.matrix || canonicalMatrixSubject(),
  }
  return {
    schemaVersion: LOCAL_EVIDENCE_SCHEMA_VERSION,
    authority: LOCAL_AUTHORITY,
    subject: canonicalSubject,
    subjectHash: hashCanonical(canonicalSubject),
    stage: { ...stage },
    artifacts: Array.isArray(artifacts) ? artifacts.map((artifact) => ({ ...artifact })) : artifacts,
    claimLadder: Object.fromEntries(
      CLAIM_LEVELS.map((level) => [level, { ...(claimLadder?.[level] || {}) }])
    ),
    limitations: [...LOCAL_LIMITATIONS],
    compatibility: compatibility || BOUNDED_COMPATIBILITY,
  }
}

function buildPrivateCapabilityDto({ manifest, generation, rows, officeCli, localOracle,
  originalAvailable, environmentSummary } = {}) {
  const safeRows = Array.isArray(rows) ? rows.map(({ id, tier, eligible, promoted, verdict, reasons }) => ({
    id, tier, eligible: Boolean(eligible), promoted: Boolean(promoted),
    verdict: verdict || (promoted ? 'verified' : 'unavailable'),
    reasons: Array.isArray(reasons) ? [...reasons] : [],
  })) : []
  const dto = {
    schemaVersion: LOCAL_EVIDENCE_SCHEMA_VERSION,
    authority: LOCAL_AUTHORITY,
    generation: Number.isSafeInteger(generation) ? generation : null,
    subjectHash: manifest?.subjectHash || null,
    packageRevisionHash: manifest?.subject?.packageRevisionHash || null,
    matrix: manifest?.subject?.matrix || null,
    claimLadder: isRecord(manifest?.claimLadder)
      ? Object.fromEntries(CLAIM_LEVELS.map((level) => [
        level,
        {
          verdict: manifest.claimLadder[level]?.verdict,
          reasons: Array.isArray(manifest.claimLadder[level]?.reasons)
            ? [...manifest.claimLadder[level].reasons]
            : [],
        },
      ]))
      : null,
    claimCeiling: localClaimCeiling(manifest?.claimLadder || {}),
    limitations: manifest?.limitations ? [...manifest.limitations] : [...LOCAL_LIMITATIONS],
    compatibility: BOUNDED_COMPATIBILITY,
    artifacts: Array.isArray(manifest?.subject?.applicationArtifacts)
      ? manifest.subject.applicationArtifacts.map(({ id, sha256 }) => ({ id, sha256 }))
      : [],
    rows: safeRows,
    officeCli: officeCli ? { verdict: officeCli.verdict, age: officeCli.age } : { verdict: 'unavailable' },
    localOracle: localOracle ? { verdict: localOracle.verdict } : { verdict: 'unavailable' },
    originalAvailable: originalAvailable === true,
    environmentSummary: isRecord(environmentSummary)
      ? Object.fromEntries(Object.entries(environmentSummary).filter(([key, value]) =>
        SAFE_ENVIRONMENT_DIGESTS.has(key) && isSha256(value)
      ))
      : {},
  }
  return Object.freeze(dto)
}

function claimCore(representation) {
  if (!isRecord(representation)) return null
  return {
    authority: representation.authority,
    subjectHash: representation.subjectHash,
    matrix: representation.matrix,
    claimLadder: representation.claimLadder,
    limitations: representation.limitations,
    artifacts: representation.artifacts || representation.applicationArtifacts || [],
    rows: Array.isArray(representation.rows) ? representation.rows : [],
  }
}

function compareClaimRepresentations(representations) {
  if (!Array.isArray(representations) || representations.length < 2) {
    return { matches: false, reasons: ['insufficient-claim-representations'] }
  }
  const [first, ...rest] = representations.map(claimCore)
  if (!first || rest.some((item) => !item || hashCanonical(item) !== hashCanonical(first))) {
    return { matches: false, reasons: ['claim-representation-mismatch'] }
  }
  return { matches: true, reasons: [] }
}

function verifyStageLineage(stages) {
  const reasons = []
  if (!Array.isArray(stages) || stages.length === 0) {
    return { valid: false, reasons: ['missing-evidence-stages'] }
  }
  const byInvocationId = new Map()
  const rootFlowIds = new Set()
  for (const stage of stages) {
    if (!isRecord(stage) || typeof stage.invocationId !== 'string' ||
      typeof stage.rootFlowId !== 'string' || !stage.rootFlowId ||
      !isSha256(stage.inputSubjectHash) || !isSha256(stage.outputSubjectHash)) {
      reasons.push('invalid-evidence-stage')
      continue
    }
    if (byInvocationId.has(stage.invocationId)) reasons.push('duplicate-stage-invocation')
    byInvocationId.set(stage.invocationId, stage)
    rootFlowIds.add(stage.rootFlowId)
  }
  if (rootFlowIds.size !== 1 || rootFlowIds.has(undefined)) reasons.push('mixed-stage-root-flow')
  const roots = [...byInvocationId.values()].filter((stage) => !stage.parentInvocationId)
  if (roots.length !== 1) reasons.push(roots.length === 0 ? 'missing-root-stage' : 'multiple-root-stages')
  for (const stage of byInvocationId.values()) {
    if (!stage.parentInvocationId) continue
    const parent = byInvocationId.get(stage.parentInvocationId)
    if (!parent) reasons.push('missing-parent-stage')
    else if (parent.outputSubjectHash !== stage.inputSubjectHash) reasons.push('broken-stage-subject-edge')
  }
  for (const stage of byInvocationId.values()) {
    const ancestry = new Set()
    let current = stage
    while (current?.parentInvocationId) {
      if (ancestry.has(current.invocationId)) {
        reasons.push('cyclic-stage-lineage')
        break
      }
      ancestry.add(current.invocationId)
      current = byInvocationId.get(current.parentInvocationId)
    }
  }
  return { valid: reasons.length === 0, reasons: unique(reasons) }
}

module.exports = {
  BOUNDED_COMPATIBILITY,
  FORBIDDEN_CAPABILITY_FIELDS,
  SAFE_ENVIRONMENT_DIGESTS,
  LOCAL_AUTHORITY,
  LOCAL_EVIDENCE_SCHEMA_VERSION,
  LOCAL_LIMITATIONS,
  buildLocalEvidenceManifest,
  buildPrivateCapabilityDto,
  compareClaimRepresentations,
  verifyLocalEvidenceManifest,
  verifyStageLineage,
}
