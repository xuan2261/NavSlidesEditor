const crypto = require('node:crypto')
const { patchPlainRun } = require('./ooxml-text-run-xml')
const { INVALID, cloneFrozen, isPlainRecord, ownData } = require('./own-plain-data')
const { relationshipElements } = require('./opc-relationship-parser')
const { normalizeTipTapSinglePlainRun, transportFromTipTapContent } = require('./tiptap-single-plain-run-eligibility')

const SOURCE_MAP_VERSION = 1
const STATUSES = new Set(['authoritative', 'diagnostic', 'ambiguous', 'missing'])
const HASH = /^[a-f0-9]{64}$/
const NATIVE_ID = /^[1-9]\d*$/u
const OFFICE_DOCUMENT = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'
const SLIDE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'

function fail(message) { throw new TypeError(message) }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex') }
function text(value) { return typeof value === 'string' && value.length > 0 }
function nativeId(value) { const result = String(value); return NATIVE_ID.test(result) && Number.isSafeInteger(Number(result)) ? result : null }
function stringList(value) {
  try {
    if (!Array.isArray(value)) return false
    const length = ownData(value, 'length')
    if (!Number.isSafeInteger(length) || length < 0) return false
    for (let index = 0; index < length; index += 1) if (!text(ownData(value, String(index)))) return false
    return true
  } catch { return false }
}
function createSourceRef(input) {
  if (!isPlainRecord(input) || !STATUSES.has(ownData(input, 'status'))) fail('Invalid source status')
  const generation = ownData(input, 'packageGeneration')
  if (!Number.isSafeInteger(generation) || generation < 1) fail('Invalid source package generation')
  const fields = ['revisionId', 'partUri', 'kind', 'sourceHash']
  if (fields.some((field) => !text(ownData(input, field))) || !HASH.test(ownData(input, 'sourceHash'))) fail('Invalid source reference')
  const relationships = ownData(input, 'relationshipChain')
  const ancestry = ownData(input, 'groupAncestry'); const occurrence = ownData(input, 'occurrencePath')
  if (!stringList(relationships) || !Array.isArray(ancestry) || !Array.isArray(occurrence)) fail('Invalid source path')
  const id = ownData(input, 'nativeId')
  if (ownData(input, 'status') === 'authoritative' &&
      (!nativeId(id) || ownData(input, 'matchMethod') !== 'native-id' || ownData(input, 'confidence') !== 1 || relationships.length === 0)) fail('Authoritative source requires exact native identity and relationships')
  const rawLineage = ownData(input, 'lineage')
  const lineage = rawLineage === undefined || typeof rawLineage === 'symbol' ? { tombstone: false, replaces: null } : rawLineage
  if (!isPlainRecord(lineage) || typeof ownData(lineage, 'tombstone') !== 'boolean') fail('Invalid source lineage')
  const record = { schemaVersion: SOURCE_MAP_VERSION, status: ownData(input, 'status'), packageGeneration: generation,
    revisionId: ownData(input, 'revisionId'), partUri: ownData(input, 'partUri'), kind: ownData(input, 'kind'),
    relationshipChain: relationships, groupAncestry: ancestry, occurrencePath: occurrence, sourceHash: ownData(input, 'sourceHash'), lineage }
  for (const field of ['matchMethod', 'confidence', 'mediaPartUri']) { const value = ownData(input, field); if (value !== undefined && typeof value !== 'symbol') record[field] = value }
  if (id !== undefined && typeof id !== 'symbol') record.nativeId = String(id)
  return cloneFrozen(record)
}
function createSourceMap(input) {
  if (!isPlainRecord(input) || !text(ownData(input, 'presentationId')) || !text(ownData(input, 'revisionId')) || !isPlainRecord(ownData(input, 'entries'))) fail('Invalid source map')
  const suppliedGeneration = ownData(input, 'packageGeneration')
  const hasSuppliedGeneration = suppliedGeneration !== INVALID
  if (hasSuppliedGeneration &&
      (!Number.isSafeInteger(suppliedGeneration) || suppliedGeneration < 1)) {
    fail('Invalid source map generation')
  }
  const entries = Object.fromEntries(Object.entries(ownData(input, 'entries')).map(([key, ref]) => [key, createSourceRef(ref)]))
  const authoritative = new Set()
  for (const ref of Object.values(entries)) {
    if (ref.status !== 'authoritative') continue
    const identity = `${ref.partUri}${String.fromCharCode(0)}${ref.nativeId}`
    if (authoritative.has(identity)) fail('Duplicate authoritative source identity')
    authoritative.add(identity)
  }
  const generations = new Set(Object.values(entries).map((ref) => ref.packageGeneration))
  if (generations.size > 1 || (hasSuppliedGeneration && generations.size &&
      suppliedGeneration !== [...generations][0])) fail('Source map generation mismatch')
  return cloneFrozen({
    schemaVersion: SOURCE_MAP_VERSION,
    presentationId: ownData(input, 'presentationId'),
    revisionId: ownData(input, 'revisionId'),
    packageGeneration: generations.size ? [...generations][0] : hasSuppliedGeneration ? suppliedGeneration : null,
    entries,
  })
}
function rebindSourceMap(input, identity, sourceHashes = {}) {
  if (!isPlainRecord(identity) || !text(ownData(identity, 'presentationId')) || !text(ownData(identity, 'revisionId')) || !Number.isSafeInteger(ownData(identity, 'packageGeneration')) || !isPlainRecord(sourceHashes)) fail('Invalid source map')
  const entries = ownData(input, 'entries')
  if (!isPlainRecord(entries)) fail('Invalid source map')
  return createSourceMap({ presentationId: ownData(identity, 'presentationId'), revisionId: ownData(identity, 'revisionId'), packageGeneration: ownData(identity, 'packageGeneration'), entries: Object.fromEntries(Object.entries(entries).map(([key, ref]) => [key, { ...ref, revisionId: ownData(identity, 'revisionId'), packageGeneration: ownData(identity, 'packageGeneration'), ...(typeof ownData(sourceHashes, key) === 'string' ? { sourceHash: ownData(sourceHashes, key) } : {}) }])) })
}
function graphSlideFor(graph, index) { return (graph?.slides || []).find((slide) => slide.index === index) || null }
function ancestry(node, nodes) {
  const byId = new Map(nodes.map((item) => [String(item.id), item])); const result = []
  for (let current = node; current?.parentId != null;) { const parent = byId.get(String(current.parentId)); if (!parent) break; result.unshift(String(parent.id)); current = parent }
  return result
}
function normalizeTarget(base, target) {
  if (!text(target) || /^[a-z][a-z\d+.-]*:/iu.test(target) || target.startsWith('/')) return null
  const out = []
  for (const segment of `${base}${target}`.split('/')) { if (!segment || segment === '.') continue; if (segment === '..') { if (!out.length) return null; out.pop() } else out.push(segment) }
  return out.join('/')
}
function relationship(xml, type, target, base) {
  return relationshipElements(xml).some((attrs) => attrs.Type === type && (!attrs.TargetMode || attrs.TargetMode === 'Internal') && normalizeTarget(base, attrs.Target) === target)
}
async function relationshipChain(zip, partUri) {
  const rootPart = '_rels/.rels'; const presentationPart = 'ppt/_rels/presentation.xml.rels'
  try {
    const [root, presentation] = await Promise.all([zip?.file?.(rootPart)?.async('string'), zip?.file?.(presentationPart)?.async('string')])
    return root && presentation && relationship(root, OFFICE_DOCUMENT, 'ppt/presentation.xml', '') && relationship(presentation, SLIDE, partUri, 'ppt/') ? [rootPart, presentationPart] : []
  } catch { return [] }
}
function exactServerProvenance(element) {
  const source = element?._pptxSource
  return source && (source.matchedBy === 'sourceId' || source.matchedBy === 'name') ? source.nodeId : null
}
const MAPPER_STYLE_PARAGRAPH = /^<p style="[^"]*">([^<]*)<\/p>$/u
const MAPPER_STYLE_SPAN = /^<p style="[^"]*"><span style="[^"]*">([^<]*)<\/span><\/p>$/u
function normalizeMapperTextForSourceProof(content) {
  const strict = normalizeTipTapSinglePlainRun(transportFromTipTapContent(content))
  if (strict.ok || typeof content !== 'string') return strict
  const match = MAPPER_STYLE_PARAGRAPH.exec(content) || MAPPER_STYLE_SPAN.exec(content)
  return match ? normalizeTipTapSinglePlainRun(transportFromTipTapContent(`<p>${match[1]}</p>`)) : strict
}
function textRef(element, node, slideXml, partUri, chain, identity, nodes, occurrencePath) {
  const id = nativeId(node?.id); const sourceXml = typeof node?.sourceXml === 'string' ? node.sourceXml : null
  // Mapper-owned style wrappers do not alter the text value. Native patch simulation still proves it.
  const verdict = normalizeMapperTextForSourceProof(element?.content)
  if (!id || !sourceXml || !verdict.ok || !slideXml.includes(sourceXml) || chain.length === 0) return null
  try { patchPlainRun(slideXml, id, verdict.normalizedText, verdict.normalizedText) } catch { return null }
  return { packageGeneration: identity.packageGeneration, revisionId: identity.revisionId, partUri, kind: 'text-run', nativeId: id, relationshipChain: chain, groupAncestry: ancestry(node, nodes), occurrencePath, sourceHash: sha256(sourceXml), status: 'authoritative', matchMethod: 'native-id', confidence: 1 }
}
function shapeRef(element, node, slideXml, partUri, chain, identity, nodes, occurrencePath) {
  const id = nativeId(node?.id); const sourceXml = typeof node?.sourceXml === 'string' ? node.sourceXml : null
  if (element?.type !== 'shape' || node?.kind !== 'shape' || !id || !sourceXml || !slideXml.includes(sourceXml) || chain.length === 0 ||
      !new RegExp(`<${tagForShape()}cNvPr\\b[^>]*\\bid=(?:"${id}"|'${id}')`).test(sourceXml)) return null
  return { packageGeneration: identity.packageGeneration, revisionId: identity.revisionId, partUri, kind: 'shape', nativeId: id, relationshipChain: chain, groupAncestry: ancestry(node, nodes), occurrencePath, sourceHash: sha256(sourceXml), status: 'authoritative', matchMethod: 'native-id', confidence: 1 }
}
function tagForShape() { return '(?:\\w+:)?' }
async function buildImportSourceMap(projection, sceneGraph, zip, supplied = {}) {
  const identity = {
    packageGeneration: supplied.packageGeneration === undefined ? 1 : supplied.packageGeneration,
    revisionId: supplied.revisionId === undefined ? 'import-pending' : supplied.revisionId,
  }
  const entries = {}; const entryKeys = new Set(); const slides = []; const slideIds = new Set()
  const collectSlides = (items) => (items || []).forEach((slide) => {
    if (!slide?.id || slideIds.has(slide.id)) fail('Ambiguous source slide identity')
    slideIds.add(slide.id); slides.push(slide); collectSlides(slide.children)
  })
  collectSlides(projection?.slides)
  for (const [slideIndex, slide] of slides.entries()) {
    const graph = graphSlideFor(sceneGraph, slideIndex); const partUri = graph?.path; const file = partUri && zip?.file?.(partUri)
    let slideXml = ''; try { slideXml = file ? await file.async('string') : '' } catch { slideXml = '' }
    const nodes = graph?.nodes || []; const chain = partUri ? await relationshipChain(zip, partUri) : []
    const visit = (elements, path = []) => (elements || []).forEach((element, index) => {
      if (!element?.id) return
      const node = nodes.find((item) => String(item.id) === String(exactServerProvenance(element)))
      const occurrencePath = [...path, index]
      const ref = partUri && element.type === 'text'
        ? textRef(element, node, slideXml, partUri, chain, identity, nodes, occurrencePath)
        : partUri && element.type === 'shape'
          ? shapeRef(element, node, slideXml, partUri, chain, identity, nodes, occurrencePath)
          : null
      const key = `${slide.id}:${element.id}`
      if (entryKeys.has(key)) fail('Ambiguous source element identity')
      entryKeys.add(key)
      entries[key] = ref || { ...identity, partUri: partUri || 'unknown', kind: node?.kind || element.type || 'unknown', status: node ? 'diagnostic' : 'missing', relationshipChain: chain, groupAncestry: node ? ancestry(node, nodes) : [], occurrencePath, sourceHash: sha256(node?.sourceXml && slideXml.includes(node.sourceXml) ? node.sourceXml : slideXml) }
      visit(element.elements || element.children, occurrencePath)
    })
    visit(slide.elements)
  }
  return createSourceMap({
    presentationId: supplied.presentationId === undefined
      ? projection?.id || 'import-pending'
      : supplied.presentationId,
    revisionId: identity.revisionId,
    packageGeneration: identity.packageGeneration,
    entries,
  })
}
function assertPatchableSource(ref, bytes) {
  if (ref?.status !== 'authoritative') { const error = new Error('Source identity is not authoritative'); error.code = 'SOURCE_NOT_AUTHORITATIVE'; throw error }
  if (bytes !== undefined && sha256(bytes) !== ref.sourceHash) { const error = new Error('Source hash precondition failed'); error.code = 'SOURCE_HASH_MISMATCH'; throw error }
  return ref
}
module.exports = { SOURCE_MAP_VERSION, SOURCE_STATUSES: Object.freeze([...STATUSES]), assertPatchableSource, buildImportSourceMap, createSourceMap, createSourceRef, rebindSourceMap }
