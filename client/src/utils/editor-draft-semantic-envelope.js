import { captureShell, captureOwnedShell, isOwnedShell, replayShell } from './editor-draft-shell-delta'
import { isCertifiedSemanticDocument } from 'revealjs-shared/src/pptx-semantic-records.js'
import { normalizePptxSemanticDocument } from 'revealjs-shared/src/pptx-semantic-document.js'

export const SEMANTIC_DRAFT_VERSION = 2
const bases = new Map()
const own = (object, key) => Object.hasOwn(object, key)
const json = (value) => JSON.parse(JSON.stringify(value))
const transportKeys = ['semanticDraftVersion', 'semanticBaseline', 'semanticPatch',
  'shellPatch', 'semanticCheckpointVersion', 'snapshotKeyOrder']

// Define in source descriptor order; integer keys retain JavaScript's native order.
function orderedCopy(keys, source, replacementKey, replacement) {
  const result = {}
  for (const key of keys) {
    if (key !== replacementKey && !own(source, key)) continue
    Object.defineProperty(result, key, { value: key === replacementKey ? replacement : source[key],
      enumerable: true, writable: true, configurable: true })
  }
  return result
}

// Identity sharing and compact eligibility are separate proofs. Retain the
// producer root for exact bytes and dictionary identity; retain normalization's
// output only as a successful-validation receipt. Use migration's default limits,
// including all global budgets, and cache failures as well as successes per root.
const eligibility = new WeakMap()
function validated(semantic) {
  if (!eligibility.has(semantic)) {
    let receipt = null
    try { receipt = normalizePptxSemanticDocument(semantic) } catch { /* Full fallback. */ }
    eligibility.set(semantic, receipt)
  }
  return eligibility.get(semantic)
}
// Only closed, internally captured receipts may reuse their serialized bytes.
// Public captureDraft calls still return independently mutable clones.
const ownedCaptures = new WeakSet()
const encodedCaptures = new WeakMap()
const frozenAllocations = new WeakSet()
function freezeOwned(value) {
  if (!value || typeof value !== 'object' || frozenAllocations.has(value) ||
      isOwnedShell(value) || isCertifiedSemanticDocument(value)) return value
  Object.values(value).forEach(freezeOwned)
  Object.freeze(value)
  frozenAllocations.add(value)
  return value
}
export function captureOwnedDraft(record) {
  const captured = freezeOwned(capture(record, true))
  ownedCaptures.add(captured)
  return captured
}
const STORAGE_FORMAT = 'navslides-editor-draft'

// Full records always live inside this envelope, never beside its marker.
// The absence of an outer snapshot and the exact shape distinguish application
// metadata (including these very field names) from storage transport.
export function draftMetadata(value) {
  return isFullEnvelope(value) ? value.record : value
}
function isFullEnvelope(value) {
  return value && value.format === STORAGE_FORMAT && value.storageVersion === 3 &&
    value.kind === 'full' && Object.keys(value).length === 5 &&
    ['key', 'format', 'storageVersion', 'kind', 'record'].every(key => own(value, key)) &&
    value.record && typeof value.record === 'object' && value.key === value.record.key &&
    typeof value.record.snapshot?.id === 'string'
}
export function fullDraftEnvelope(record) {
  return { key: record.key, format: STORAGE_FORMAT, storageVersion: 3, kind: 'full', record }
}

export function capturedDraftBytes(captured, compactHead) {
  if (!ownedCaptures.has(captured)) return undefined
  const encoded = encodedCaptures.get(captured)
  if (compactHead?.semanticDraftVersion === 2) return JSON.stringify(compactHead)
  if (!compactHead) {
    if (captured.semanticShell || !encoded) return undefined
    // Reuse the private JSON receipt; do not serialize application data twice.
    return encoded
  }
  if (!encoded || !captured.semanticShell) return undefined
  const { semanticDraftVersion, semanticBaseline, semanticPatch } = compactHead
  const suffix = JSON.stringify({ semanticDraftVersion, semanticBaseline, semanticPatch })
  return `${encoded.slice(0, -1)},${suffix.slice(1)}`
}

export function captureDraft(record) {
  return capture(record, false)
}

function dataFields(value) {
  if (!value || typeof value !== 'object' ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error('Nonordinary record')
  const fields = Object.getOwnPropertyDescriptors(value)
  for (const key of Reflect.ownKeys(fields)) {
    if (typeof key !== 'string' || !fields[key].enumerable || !own(fields[key], 'value') ||
        ['__proto__', 'constructor', 'prototype', 'toJSON'].includes(key)) throw Error('Unsafe record')
  }
  return fields
}
function capture(record, internal) {
  // Reflection cannot exclude browser proxies. Consume descriptor data only,
  // never application gets after inspection. Unsafe inputs use full historical JSON.
  try {
    const fields = dataFields(record)
    const descriptors = dataFields(fields.snapshot?.value)
    const semantic = descriptors.pptxSemantic?.value
    if (!isCertifiedSemanticDocument(semantic)) throw Error('Uncertified semantic')
    const metadataInput = Object.create(null)
    for (const key of Object.keys(fields)) {
      const value = fields[key].value
      if (key === 'snapshot' || value === undefined || typeof value === 'function' || typeof value === 'symbol') continue
      Object.defineProperty(metadataInput, key, { value, enumerable: true })
    }
    const metadata = captureShell(metadataInput).copy
    // The baseline is privately owned and installed only after its IDB commit.
    const snapshotKeys = Object.keys(descriptors)
    delete descriptors.pptxSemantic
    const shell = Object.create(null, descriptors)
    const base = bases.get(metadata.key)
    const capturedShell = (internal ? captureOwnedShell : captureShell)(shell, base?.shell)
    const snapshot = orderedCopy(snapshotKeys, capturedShell.copy, 'pptxSemantic', semantic)
    const receipt = { record: orderedCopy(Object.keys(fields), metadata, 'snapshot', snapshot),
      semantic: validated(semantic) ? semantic : null, shell: capturedShell.copy,
      compactionBlocked: transportKeys.some(key => own(fields, key)),
      shellPatch: capturedShell.patch, shellBaseline: base?.key }
    if (internal) receipt.semanticShell = true
    return receipt
  } catch { /* Unsafe JSON uses the historical JSON.stringify fallback. */ }
  const encoded = JSON.stringify(internal ? fullDraftEnvelope(record) : record)
  const captured = { record: internal ? JSON.parse(encoded).record : JSON.parse(encoded), semantic: null }
  if (internal) encodedCaptures.set(captured, encoded)
  return captured
}

function withoutText(instance) {
  const copy = json(instance)
  for (const [key, component] of Object.entries(copy?.overrides?.components || {})) {
    delete component.textDocument
    if (!Object.keys(component).length) delete copy.overrides.components[key]
  }
  if (copy?.overrides?.components && !Object.keys(copy.overrides.components).length)
    delete copy.overrides.components
  return JSON.stringify(copy)
}

function patches(base, next) {
  const baseKeys = Object.keys(base)
  const nextKeys = Object.keys(next)
  if (baseKeys.length !== nextKeys.length || baseKeys.some((key) =>
    !own(next, key) || (key !== 'instances' && base[key] !== next[key]))) return null
  const sets = []
  const deletes = []
  for (const key of Object.keys(base.instances)) {
    if (!own(next.instances, key)) return null // Non-text structural edits use full records.
  }
  for (const key of Object.keys(next.instances)) {
    if (!own(base.instances, key)) return null
    const before = base.instances[key]
    const after = next.instances[key]
    if (before === after) continue
    if (withoutText(before) !== withoutText(after)) return null
    // Wire dictionary keys, not decoded instance IDs. Null and undefined are
    // encoded with the same semantics as a complete JSON snapshot.
    const encoded = JSON.stringify(after)
    if (encoded === undefined) deletes.push(key)
    else sets.push([key, JSON.parse(encoded)])
  }
  return { sets, deletes }
}

export function compactDraft(captured) {
  const base = bases.get(captured.record.key)
  if (captured.compactionBlocked || transportKeys.some(key => own(captured.record, key)) ||
      !base || !captured.semantic || !captured.shell || !base.shell) return null
  const patch = patches(base.semantic, captured.semantic)
  if (!patch) return null
  if (captured.shellBaseline !== base.key) return null
  return {
    ...captured.record, snapshot: { id: captured.record.snapshot.id },
    semanticDraftVersion: 2, semanticBaseline: base.key, semanticPatch: patch,
    shellPatch: captured.shellPatch,
    ...(Object.keys(captured.record.snapshot).at(-1) !== 'pptxSemantic'
      ? { snapshotKeyOrder: Object.keys(captured.record.snapshot) } : {}),
  }
}

export function checkpointNeeded(captured) {
  const base = bases.get(captured.record.key)
  return captured.semantic && (!base || !patches(base.semantic, captured.semantic))
}

export function acceptCheckpoint(captured, key) {
  // Never retain caller-owned shell graphs, including public capture receipts.
  bases.set(captured.record.key, { key, semantic: captured.semantic,
    shell: captured.shell ? checkpointShell(captured) : null })
}

function checkpointShell(captured) {
  return ownedCaptures.has(captured) ? captured.shell : captureOwnedShell(captured.shell).copy
}

export function checkpointRecord(captured) {
  const nonce = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
  return { key: `semantic-checkpoint:${nonce}`, semanticCheckpointVersion: 1,
    draftKey: captured.record.key, semantic: captured.semantic,
    ...(captured.shell ? { shell: ownedCaptures.has(captured)
      ? captured.shell : captureShell(captured.shell).copy } : {}) }
}

export async function expandDraft(record, load, routeKey) {
  if (routeKey && (record?.key !== routeKey ||
      draftMetadata(record)?.snapshot?.id !== routeKey.slice(routeKey.indexOf(':') + 1))) return null
  if (isFullEnvelope(record)) return record.record
  // Full snapshots may own transport-looking application metadata. A real
  // legacy compact head has no embedded semantic document and must still replay.
  if (!record || !own(record, 'semanticDraftVersion') ||
      (record.snapshot && own(record.snapshot, 'pptxSemantic'))) return record
  // An ordinary legacy full snapshot can carry arbitrary transport-looking
  // metadata. Only a complete transport claim, or an id-only compact shell,
  // is treated as compact; malformed real compact heads must fail closed.
  const transportClaim = [1, 2].includes(record.semanticDraftVersion) &&
    typeof record.semanticBaseline === 'string' &&
    Array.isArray(record.semanticPatch?.sets) && Array.isArray(record.semanticPatch?.deletes)
  const idOnly = record.snapshot && Object.keys(record.snapshot).every(key => key === 'id')
  if (!transportClaim && !idOnly) return record
  if (![1, 2].includes(record.semanticDraftVersion) ||
      typeof record.semanticBaseline !== 'string' || !record.semanticPatch) return null
  const base = await load(record.semanticBaseline)
  if (base?.semanticCheckpointVersion !== 1 || base.key !== record.semanticBaseline ||
      base.draftKey !== record.key || !base.semantic?.instances) return null
  const instances = { ...base.semantic.instances }
  const { sets, deletes } = record.semanticPatch
  if (!Array.isArray(sets) || !Array.isArray(deletes)) return null
  for (const key of deletes) {
    if (typeof key !== 'string') return null
    delete instances[key]
  }
  for (const entry of sets) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string') return null
    Object.defineProperty(instances, entry[0], {
      value: entry[1], enumerable: true, writable: true, configurable: true,
    })
  }
  const { semanticDraftVersion, semanticBaseline, semanticPatch, ...head } = record
  let shell = head.snapshot
  let snapshotKeys
  if (semanticDraftVersion === 2) {
    try {
      if (!base.shell) return null
      shell = replayShell(base.shell, record.shellPatch)
      delete head.shellPatch
      delete head.snapshotKeyOrder
      if (shell.id !== head.snapshot?.id) return null
      if (own(record, 'snapshotKeyOrder')) {
        snapshotKeys = record.snapshotKeyOrder
        const expected = [...Object.keys(shell), 'pptxSemantic']
        if (!Array.isArray(snapshotKeys) || snapshotKeys.length !== expected.length ||
            new Set(snapshotKeys).size !== expected.length ||
            snapshotKeys.some(key => typeof key !== 'string' || !expected.includes(key))) return null
      }
    } catch { return null }
  }
  const semantic = { ...base.semantic, instances }
  return { ...head, snapshot: orderedCopy(snapshotKeys || [...Object.keys(shell), 'pptxSemantic'],
    shell, 'pptxSemantic', semantic) }
}
