const { canonicalJson, createEmptyState, validateState } = require('./schemas')

const STATE_MANIFEST_TYPE = 'navslides.package-state-manifest'
const STATE_MANIFEST_VERSION = 1
// One schema source, including optional/defaulted collections; never infer from user data.
const EMPTY_STATE = createEmptyState()
const STATE_COLLECTIONS = Object.freeze(Object.keys(EMPTY_STATE).filter((key) => Array.isArray(EMPTY_STATE[key])))
const own = (value, key) => Object.hasOwn(value, key)

function assert(condition, message) {
  if (!condition) throw new TypeError(`Invalid state manifest: ${message}`)
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
}

function keys(value, allowed, required = allowed) {
  assert(object(value), 'expected object')
  assert(Reflect.ownKeys(value).every((key) => allowed.includes(key)), 'unknown key')
  assert(required.every((key) => own(value, key)), 'missing key')
}

function reference(ref) {
  keys(ref, ['hash', 'bytes'])
  assert(typeof ref.hash === 'string' && /^[a-f0-9]{64}$/.test(ref.hash), 'record hash')
  assert(Number.isSafeInteger(ref.bytes) && ref.bytes > 0, 'record byte length')
  return ref
}

function validateStateManifest(manifest) {
  keys(manifest, ['type', 'stateManifestVersion', 'state'])
  assert(manifest.type === STATE_MANIFEST_TYPE, 'type')
  assert(manifest.stateManifestVersion === STATE_MANIFEST_VERSION, 'version')
  // The envelope is codec-owned and strict; the state shell retains the public
  // schema's extensible root metadata, without interpreting user references.
  assert(object(manifest.state), 'expected state object')
  for (const key of STATE_COLLECTIONS) {
    const slot = manifest.state[key]
    keys(slot, ['type', 'records'])
    assert(slot.type === 'record-collection', 'collection type')
    assert(Array.isArray(slot.records), 'record list')
    for (let index = 0; index < slot.records.length; index++) {
      assert(own(slot.records, index), 'sparse record list')
      reference(slot.records[index])
    }
  }
  // Reuse precisely the public state validation, with empty collection placeholders.
  validateState({ ...manifest.state, ...Object.fromEntries(STATE_COLLECTIONS.map((key) => [key, []])) })
  return manifest
}

/**
 * Representation only: records are opaque whole collection entries, not recursive
 * reference-bearing values. Caller still owns admission, snapshot isolation and
 * publication. The returned state is fully resolved; it is not a new public schema.
 * Serialize manifest with the existing canonicalJson/hashRecord at publication.
 */
async function encodeStateManifest(state, recordStore, options = {}) {
  options.signal?.throwIfAborted()
  const resolved = validateState({ ...state })
  // Admit the complete representation before writing any record. In particular,
  // root extras must obey the same JSON contract as collection entries: sparse
  // and undefined array slots have invalid historical canonical bytes, not null.
  for (const key of STATE_COLLECTIONS) {
    for (let index = 0; index < resolved[key].length; index++) {
      assert(own(resolved[key], index), 'sparse collection')
    }
  }
  let shell
  try {
    shell = { ...require('./state-record-store').canonicalProjection(resolved) }
  } catch (error) {
    // Preserve the codec's historical parse-error contract, now before record I/O.
    throw new SyntaxError(error.message, { cause: error })
  }
  for (const key of STATE_COLLECTIONS) {
    const records = []
    for (let index = 0; index < resolved[key].length; index++) {
      options.signal?.throwIfAborted()
      assert(own(resolved[key], index), 'sparse collection')
      const ref = reference(await recordStore.put(resolved[key][index], options))
      records.push({ hash: ref.hash, bytes: ref.bytes })
    }
    shell[key] = { type: 'record-collection', records }
  }
  options.signal?.throwIfAborted()
  // Historical canonicalization drops undefined object properties; malformed
  // sparse/undefined array serialization is not silently converted into nulls.
  const manifest = JSON.parse(canonicalJson({
    type: STATE_MANIFEST_TYPE,
    stateManifestVersion: STATE_MANIFEST_VERSION,
    state: shell,
  }))
  validateStateManifest(manifest)
  return { manifest, state: resolved }
}

/** Raw legacy indexes are returned unchanged for the existing migration loader. */
async function decodeStateManifest(value, recordStore, { signal } = {}) {
  signal?.throwIfAborted()
  // Public raw states have schemaVersion, while the manifest envelope never does.
  // Any envelope discriminator reserves the position, including malformed versions.
  if (!object(value) ||
      (own(value, 'schemaVersion') && value.type !== STATE_MANIFEST_TYPE && !own(value, 'stateManifestVersion')) ||
      (!own(value, 'type') && !own(value, 'stateManifestVersion'))) return value
  validateStateManifest(value)
  const state = { ...value.state }
  for (const key of STATE_COLLECTIONS) {
    state[key] = []
    for (const ref of value.state[key].records) {
      signal?.throwIfAborted()
      state[key].push(await recordStore.get(ref, { signal }))
    }
  }
  signal?.throwIfAborted()
  return validateState(state)
}

/** Direct content hashes for GC; whole records contain no codec-owned references. */
function collectManifestReferences(manifest) {
  validateStateManifest(manifest)
  return new Set(STATE_COLLECTIONS.flatMap((key) => manifest.state[key].records.map((ref) => ref.hash)))
}

module.exports = {
  STATE_COLLECTIONS,
  STATE_MANIFEST_TYPE,
  STATE_MANIFEST_VERSION,
  encodeStateManifest,
  decodeStateManifest,
  collectManifestReferences,
  validateStateManifest,
}
