const {
  PACKAGE_HEAD_SCHEMA_VERSION,
  PACKAGE_STATE_SCHEMA_VERSION,
  STATE_ROOT_SCHEMA_VERSION,
  validateState,
  validateStateRoot,
} = require('./schemas')
const {
  createMatrixAuthoritySubjects,
  validateMatrixAuthoritySubjects,
} = require('../canonical-feature-matrix')

const LEGACY_SCHEMA_VERSION = 1

function hasOwn(value, key) {
  return value != null && Object.prototype.hasOwnProperty.call(value, key)
}


function validateLegacyRoot(root) {
  if (root?.schemaVersion !== LEGACY_SCHEMA_VERSION) {
    throw new TypeError('Unsupported state root schema version')
  }
  validateStateRoot({ ...root, schemaVersion: STATE_ROOT_SCHEMA_VERSION })
  return root
}

function validatePackageStoreRoot(root) {
  if (root?.schemaVersion === STATE_ROOT_SCHEMA_VERSION) return validateStateRoot(root)
  if (root?.schemaVersion === LEGACY_SCHEMA_VERSION) return validateLegacyRoot(root)
  throw new TypeError('Unsupported state root schema version')
}

function classifyLegacyAuthority(state) {
  const stateHasEpoch = hasOwn(state, 'matrixAuthorityEpoch')
  let completeHeads = 0
  for (const head of state.heads) {
    const hasEpoch = hasOwn(head, 'matrixAuthorityEpoch')
    const hasSubjects = hasOwn(head, 'matrixAuthoritySubjects')
    if (hasEpoch !== hasSubjects) throw new TypeError('Ambiguous legacy head authority shape')
    if (hasEpoch) completeHeads += 1
  }
  if (!stateHasEpoch && completeHeads === 0) return 'pre-authority-v1'
  if (!stateHasEpoch || completeHeads !== state.heads.length) {
    throw new TypeError('Ambiguous legacy state authority shape')
  }
  if (!Number.isSafeInteger(state.matrixAuthorityEpoch) || state.matrixAuthorityEpoch < 1) {
    throw new TypeError('Invalid legacy matrix authority epoch')
  }
  for (const head of state.heads) {
    if (head.matrixAuthorityEpoch !== state.matrixAuthorityEpoch) {
      throw new TypeError('Legacy head matrix authority epoch mismatch')
    }
    const verdict = validateMatrixAuthoritySubjects(
      head.matrixAuthoritySubjects,
      undefined,
      state.matrixAuthorityEpoch
    )
    if (!verdict.authorized) throw new TypeError('Invalid legacy matrix authority subjects')
  }
  return 'authority-v1'
}

function validateLegacyStateShape(state) {
  if (state?.schemaVersion !== LEGACY_SCHEMA_VERSION) {
    throw new TypeError('Unsupported package state schema version')
  }
  if (!Number.isSafeInteger(state.generation) || state.generation < 0) {
    throw new TypeError('Invalid legacy state generation')
  }
  if (!Number.isSafeInteger(state.fencingEpoch) || state.fencingEpoch < 0) {
    throw new TypeError('Invalid legacy state fencing epoch')
  }
  for (const key of [
    'blobs', 'revisions', 'heads', 'owners', 'leases', 'jobs', 'mutationResults',
    'compatibilityOutbox', 'compatibilityDeadLetter', 'candidateBlobs',
  ]) {
    if (!Array.isArray(state[key])) throw new TypeError(`Invalid legacy state ${key} index`)
  }
}

function migrateLegacyState(root, inputState, { highWater = null } = {}) {
  validateLegacyRoot(root)
  validateLegacyStateShape(inputState)
  const migratedFrom = classifyLegacyAuthority(inputState)
  const sourceEpoch = migratedFrom === 'authority-v1' ? inputState.matrixAuthorityEpoch : 1
  const matrixAuthorityEpoch = Math.max(sourceEpoch, highWater || 1)
  const state = structuredClone(inputState)
  state.schemaVersion = PACKAGE_STATE_SCHEMA_VERSION
  state.matrixAuthorityEpoch = matrixAuthorityEpoch
  state.heads = state.heads.map((head) => ({
    ...head,
    schemaVersion: PACKAGE_HEAD_SCHEMA_VERSION,
    matrixAuthorityEpoch,
    matrixAuthoritySubjects: createMatrixAuthoritySubjects(undefined, matrixAuthorityEpoch),
  }))
  validateState(state)
  return {
    root: structuredClone(root),
    state,
    migratedFrom,
    actions: ['loaded-legacy-state-v1'],
  }
}

function loadPackageStoreState(root, state, options = {}) {
  validatePackageStoreRoot(root)
  if (root.schemaVersion === STATE_ROOT_SCHEMA_VERSION) {
    return { root, state: validateState(state), migration: null }
  }
  const migrated = migrateLegacyState(root, state, options)
  return {
    root: migrated.root,
    state: migrated.state,
    migration: {
      migratedFrom: migrated.migratedFrom,
      actions: migrated.actions,
    },
  }
}

module.exports = {
  LEGACY_SCHEMA_VERSION,
  loadPackageStoreState,
  migrateLegacyState,
  validatePackageStoreRoot,
}
