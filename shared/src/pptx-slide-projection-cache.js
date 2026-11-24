const { semanticInstances, semanticInstance, semanticRecordPredecessor, isCertifiedSemanticDocument } = require('./pptx-semantic-records.js')
// Admission is deliberately narrower than the renderer: only plain, acyclic
// slide data and absent field context. Date/Intl and caller-owned exotic values
// continue through the uncached path. Never use slide/element identity as proof.
const slideProjections = new Map()
// Only certified, recursively immutable documents may key this index. Build
// once per revision, rather than enumerating/decoding the entire deck for each
// thumbnail. Do not key by the instances root: wire decoding also uses catalogs.
const occurrenceIndexes = new WeakMap()
function occurrenceIndex(document) {
  let index = occurrenceIndexes.get(document)
  if (index) return index
  const provenance = semanticRecordPredecessor(document)
  const previous = provenance && occurrenceIndexes.get(provenance.previous)
  // Called only after render normalization succeeds. Any changed non-instance
  // root (including unknown roots/catalogs) invalidates incremental decoding.
  const keys = Reflect.ownKeys(document).filter((key) => key !== 'instances')
  const oldKeys = provenance && Reflect.ownKeys(provenance.previous).filter((key) => key !== 'instances')
  if (previous && keys.length === oldKeys.length && keys.every((key, i) =>
    key === oldKeys[i] && Object.is(document[key], provenance.previous[key]))) {
    const changes = provenance.instanceIds.map((id) => [id, semanticInstance(document, id)])
    // New dictionary keys can change numeric wire enumeration order. Fall back
    // for insertion; edits, relocation and deletion preserve predecessor order.
    if (changes.every(([id, value]) => !value || previous.byId.has(id))) {
      const byId = new Map(previous.byId), bySlide = new Map(previous.bySlide)
      const affected = new Set()
      for (const [id, value] of changes) {
        const old = byId.get(id)
        if (old) affected.add(old.slideId)
        if (value) { byId.set(id, value); affected.add(value.slideId) }
        else byId.delete(id)
      }
      for (const slideId of affected) {
        const local = new Map(previous.bySlide.get(slideId) || [])
        for (const [id, value] of changes) {
          local.delete(id)
          if (value?.slideId === slideId) local.set(id, value)
        }
        const bucket = [...local].sort(([a], [b]) => previous.order.get(a) - previous.order.get(b))
        if (bucket.length) bySlide.set(slideId, Object.freeze(bucket.map(Object.freeze)))
        else bySlide.delete(slideId)
      }
      index = { byId, bySlide, order: previous.order }
      occurrenceIndexes.set(document, index)
      return index
    }
  }
  const byId = new Map(), bySlide = new Map(), order = new Map()
  for (const entry of semanticInstances(document)) {
    const [id, instance] = entry
    order.set(id, order.size)
    byId.set(id, instance)
    let local = bySlide.get(instance.slideId)
    if (!local) bySlide.set(instance.slideId, local = [])
    local.push(Object.freeze(entry))
  }
  for (const bucket of bySlide.values()) Object.freeze(bucket)
  index = { byId, bySlide, order }
  occurrenceIndexes.set(document, index)
  return index
}
const emptyOccurrences = Object.freeze([])
// Internal validated-root API: callers MUST normalize successfully first.
// Certification proves immutability, not validation; do not normalize here (the
// normalizer has broader consumers). Raw/mutable callers go through their full
// normalizer before reaching this shared index. Dependency direction: records only.
function semanticSlideOccurrences(document, slideId) {
  if (!isCertifiedSemanticDocument(document)) throw new TypeError('Expected certified semantic document')
  return occurrenceIndex(document).bySlide.get(slideId) || emptyOccurrences
}
const ownedSnapshots = new WeakSet()
function snapshotSlide(value, ancestors = new Set()) {
  if (value === null || ['string', 'boolean', 'undefined'].includes(typeof value)) return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (!value || typeof value !== 'object' || ancestors.has(value)) throw new TypeError('Uncacheable slide')
  const array = Array.isArray(value)
  const prototype = Object.getPrototypeOf(value)
  if (array && prototype !== Array.prototype) throw new TypeError('Uncacheable slide array')
  if (!array && prototype !== null && prototype !== Object.prototype) throw new TypeError('Uncacheable slide')
  ancestors.add(value)
  const result = array ? [] : Object.create(null)
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === 'length') continue
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (typeof key !== 'string' || !descriptor.enumerable || !('value' in descriptor))
      throw new TypeError('Uncacheable slide')
    Object.defineProperty(result, key, { value: snapshotSlide(descriptor.value, ancestors), enumerable: true })
  }
  if (array) result.length = Object.getOwnPropertyDescriptor(value, 'length').value
  ancestors.delete(value)
  Object.freeze(result)
  ownedSnapshots.add(result)
  return result
}
// One descriptor-owned value walk for both navigator comparison and rendering.
function ownedSlideSnapshot(value, previous) {
  if (value && typeof value === 'object' && ownedSnapshots.has(value)) return value
  return previous && matchesSlide(value, previous) ? previous : snapshotSlide(value)
}
function sameSnapshot(left, right) {
  if (Object.is(left, right)) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' ||
      Array.isArray(left) !== Array.isArray(right)) return false
  if (Array.isArray(left) && left.length !== right.length) return false
  const keys = Object.keys(left), other = Object.keys(right)
  return keys.length === other.length && keys.every((key, i) =>
    key === other[i] && sameSnapshot(left[key], right[key]))
}
// Compare caller-owned mutable data on every read. In particular, object
// identity is never evidence of equality. Inspect descriptors instead of reading
// properties so accessors cannot execute during cache admission. Only a miss
// allocates another owned snapshot; unchanged slides still undergo validation.
function matchesSlide(value, snapshot, ancestors = new Set()) {
  if (value === null || ['string', 'boolean', 'undefined'].includes(typeof value))
    return Object.is(value, snapshot)
  if (typeof value === 'number') return Number.isFinite(value) && Object.is(value, snapshot)
  if (!value || typeof value !== 'object' || ancestors.has(value) ||
      !snapshot || typeof snapshot !== 'object') return false
  const array = Array.isArray(value)
  const prototype = Object.getPrototypeOf(value)
  if (array !== Array.isArray(snapshot) || (array && prototype !== Array.prototype)) return false
  if (!array && prototype !== null && prototype !== Object.prototype) return false
  const keys = Reflect.ownKeys(value), other = Reflect.ownKeys(snapshot)
  if (keys.length !== other.length) return false
  ancestors.add(value)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (key !== other[i]) return false
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !('value' in descriptor)) return false
    if (array && key === 'length') {
      if (descriptor.value !== snapshot.length) return false
      continue
    }
    if (typeof key !== 'string' || !descriptor.enumerable ||
        !matchesSlide(descriptor.value, snapshot[key], ancestors)) return false
  }
  ancestors.delete(value)
  return true
}
function projectionEnvelope(document, slide, fieldContext) {
  if (fieldContext !== undefined || !isCertifiedSemanticDocument(document)) return null
  let snapshot
  try {
    const id = Object.getOwnPropertyDescriptor(slide, 'id')
    const previous = id && 'value' in id && slideProjections.get(id.value)
    snapshot = ownedSlideSnapshot(slide, previous?.envelope.snapshot)
  } catch { return null }
  // Include *every* non-occurrence root, not a hand-maintained subset: schema,
  // definitions, styles, fonts, components and all wire decoding catalogs.
  // Certified immutable values can be retained as snapshots; equality below
  // is structural (with identity only as a fast path), including cloned roots.
  const dependencies = Object.keys(document).filter((key) => key !== 'instances')
    .flatMap((key) => [key, document[key]])
  const local = semanticSlideOccurrences(document, snapshot.id)
  const { byId } = occurrenceIndex(document)
  // Connector derivation reads bound targets and their ancestry, not unrelated
  // slides. Keep explicit closure (including missing target IDs) so lookup can
  // never hide an endpoint/ancestry change. Normalization still validates first.
  const required = new Set(local.map(([id]) => id))
  const pending = local.flatMap(([, instance]) => Object.values(instance.connectorBindings || {})
    .filter(Boolean).map((binding) => binding.targetInstanceId))
  // Local membership is not proof that its ancestry has been traversed. A
  // connector usually targets a local occurrence whose parent may be external.
  const visitedAncestors = new Set()
  while (pending.length) {
    const id = pending.pop()
    if (visitedAncestors.has(id)) continue
    visitedAncestors.add(id)
    required.add(id)
    const parent = byId.get(id)?.parentInstanceId
    if (parent != null) pending.push(parent)
  }
  const occurrences = [...required].map((id) => [id, byId.get(id)])
  return { snapshot, dependencies, occurrences, document }
}
function sameEnvelope(left, right) {
  return left.dependencies.length === right.dependencies.length &&
    left.dependencies.every((value, i) => sameSnapshot(value, right.dependencies[i])) &&
    left.occurrences.length === right.occurrences.length &&
    left.occurrences.every(([id, instance], i) =>
      id === right.occurrences[i][0] && sameSnapshot(instance, right.occurrences[i][1])) &&
    sameSnapshot(left.snapshot, right.snapshot)
}
function freezeOwned(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeOwned(child)
    Object.freeze(value)
  }
  return value
}
function ownImmutable(value) { return freezeOwned(structuredClone(value)) }
// A producer-certified instance-only patch can retain the prior projection
// without normalization/tree construction. Include missing connector targets and
// ancestry from the existing admission signature, and check incoming membership.
function priorSlideProjection(document, snapshot) {
  if (!isCertifiedSemanticDocument(document) || !ownedSnapshots.has(snapshot)) return null
  const entry = slideProjections.get(snapshot.id)
  if (!entry || !sameSnapshot(snapshot, entry.envelope.snapshot)) return null
  if (entry.envelope.document === document) return entry.result
  const provenance = semanticRecordPredecessor(document)
  if (!provenance || provenance.previous !== entry.envelope.document) return null
  const keys = Reflect.ownKeys(document).filter(key => key !== 'instances')
  const oldKeys = Reflect.ownKeys(provenance.previous).filter(key => key !== 'instances')
  if (keys.length !== oldKeys.length || !keys.every((key, i) =>
    key === oldKeys[i] && Object.is(document[key], provenance.previous[key]))) return null
  const required = new Set(entry.envelope.occurrences.map(([id]) => id))
  if (provenance.instanceIds.some(id => required.has(id) ||
    semanticInstance(document, id)?.slideId === snapshot.id)) return null
  return entry.result
}
module.exports = { slideProjections, projectionEnvelope, sameEnvelope, ownImmutable,
  ownedSlideSnapshot, sameSnapshot, priorSlideProjection, semanticSlideOccurrences }
