const crypto = require('node:crypto')
const JSZip = require('jszip')
const { MAX_DECOMPRESSED_BYTES, MAX_ZIP_ENTRIES } = require('../constants')
const { readBoundedZipEntry } = require('../pptx-guards')
const { createNestedPackageGuard, assertRelationshipsSafe, isZipPayload } = require('../nested-package-guard')
const { PackageSafetyError, createXmlSafetyBudget, isXmlPart, readLimit } = require('../xml-safety')
const { parseRawEntries, relationshipSource, resolveTarget } = require('./raw-zip')
const { SCHEMA_VERSION, hashRecord, validateManifest } = require('./schemas')
const { describeComplexObjects, toSafeCapabilitySummary } = require('../complex-object-policy')

const CLASSIFIERS = [
  ['package', /^\[Content_Types\]\.xml$|^_rels\/|^docProps\//],
  ['presentation', /^ppt\/presentation\.xml$/],
  ['slide', /^ppt\/slides\//],
  ['layout', /^ppt\/slideLayouts\//],
  ['master', /^ppt\/slideMasters\//],
  ['theme', /^ppt\/theme\//],
  ['notes', /^ppt\/notes/],
  ['comments', /^ppt\/comments|^ppt\/commentAuthors/],
  ['smartArt', /^ppt\/diagrams\//],
  ['chart', /^ppt\/charts\//],
  ['workbook', /^ppt\/embeddings\/.*\.(xlsx|xlsm)$/i],
  ['media', /^ppt\/media\//],
  ['vector', /\.(?:emf|wmf|svg)$/i],
  ['ole', /^ppt\/embeddings\//],
  ['activeX', /^ppt\/activeX\//],
  ['customXml', /^customXml\//],
  ['signature', /^_xmlsignatures\//i],
  ['macro', /vbaProject\.bin$/i],
  ['3d', /^ppt\/3dmodels\//i],
  ['ink', /^ppt\/(?:ink|drawings)\//i],
  ['icons', /^ppt\/icons\//i],
  ['zoom', /^ppt\/zoom\//i],
]

function attrs(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((match) => [
      match[1].replace(/^.*:/, ''), match[2] ?? match[3],
    ])
  )
}

function classify(name) {
  return CLASSIFIERS.find(([, pattern]) => pattern.test(name))?.[0] || 'unknown'
}

function contentTypeFor(name, types) {
  return types.overrides[`/${name}`] || types.defaults[name.split('.').pop().toLowerCase()] || null
}

function parseContentTypes(xml) {
  const defaults = {}
  const overrides = {}
  for (const match of xml.matchAll(/<(?:\w+:)?Default\b[^>]*\/?>/g)) {
    const value = attrs(match[0])
    if (value.Extension && value.ContentType) defaults[value.Extension.toLowerCase()] = value.ContentType
  }
  for (const match of xml.matchAll(/<(?:\w+:)?Override\b[^>]*\/?>/g)) {
    const value = attrs(match[0])
    if (value.PartName && value.ContentType) overrides[value.PartName] = value.ContentType
  }
  return { defaults, overrides }
}

function hasRelationshipCycle(relationships) {
  const edges = new Map()
  for (const rel of relationships.filter((item) => !item.external && !item.dangling)) {
    if (!edges.has(rel.source)) edges.set(rel.source, [])
    edges.get(rel.source).push(rel.normalizedTarget)
  }
  const visiting = new Set()
  const visited = new Set()
  function visit(node) {
    if (visiting.has(node)) return true
    if (visited.has(node)) return false
    visiting.add(node)
    if ((edges.get(node) || []).some(visit)) return true
    visiting.delete(node)
    visited.add(node)
    return false
  }
  return [...edges.keys()].some(visit)
}

async function buildOpcInventory(source, limits = {}) {
  const bytes = Buffer.isBuffer(source) ? source : await require('node:fs/promises').readFile(source)
  const maxZipEntries = readLimit(limits, 'maxZipEntries', MAX_ZIP_ENTRIES)
  const maxDecompressedBytes = readLimit(limits, 'maxDecompressedBytes', MAX_DECOMPRESSED_BYTES)
  const xmlBudget = createXmlSafetyBudget(limits)
  const nestedOptions = limits.nestedLimits === undefined ? limits : limits.nestedLimits
  const nestedGuard = createNestedPackageGuard(nestedOptions)
  const rawEntries = parseRawEntries(bytes)
  if (rawEntries.length > maxZipEntries) throw new Error('Too many ZIP entries')
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: false })
  if (!zip.file('[Content_Types].xml') || !zip.file('ppt/presentation.xml')) {
    throw new Error('ZIP package is missing required PPTX entries')
  }
  let totalBytes = 0
  const extracted = new Map()
  const relationshipState = { relationships: 0 }
  for (const raw of rawEntries) {
    const entry = zip.file(raw.name)
    if (!entry || entry.dir) continue
    const xmlPart = isXmlPart(raw.name)
    const partBytes = await readBoundedZipEntry(entry, {
      perEntryCap: xmlPart ? Math.min(maxDecompressedBytes, xmlBudget.limits.maxXmlBytes) : maxDecompressedBytes,
      remainingBudget: maxDecompressedBytes - totalBytes, signal: limits.signal,
      overflowError: xmlPart
        ? () => new PackageSafetyError('xml-byte-budget-exceeded', `XML byte budget exceeded in ${raw.name}`, 413)
        : undefined,
    })
    totalBytes += partBytes.length
    extracted.set(raw.name, partBytes)
    if (xmlPart) {
      xmlBudget.inspect(partBytes, raw.name)
      if (/\.rels$/i.test(raw.name)) assertRelationshipsSafe(partBytes, raw.name, relationshipState, nestedGuard.limits)
    }
    if (isZipPayload(raw.name, partBytes)) await nestedGuard.inspect(partBytes)
  }
  const contentTypes = parseContentTypes(extracted.get('[Content_Types].xml').toString('utf8'))
  const parts = rawEntries.filter((raw) => extracted.has(raw.name)).map((raw) => {
    const partBytes = extracted.get(raw.name)
    return {
      path: raw.name, rawNameHex: raw.rawNameHex, size: partBytes.length,
      compressedSize: raw.compressedSize, crc32: raw.crc32,
      sha256: crypto.createHash('sha256').update(partBytes).digest('hex'),
      contentType: contentTypeFor(raw.name, contentTypes), classification: classify(raw.name),
      encrypted: raw.encrypted, duplicate: false, caseCollision: false,
    }
  })
  const relationships = []
  const securityFlags = new Set()
  for (const [name, partBytes] of extracted) {
    const sourcePart = relationshipSource(name)
    if (sourcePart === null) continue
    for (const match of partBytes.toString('utf8').matchAll(/<(?:\w+:)?Relationship\b[^>]*\/?>/g)) {
      const value = attrs(match[0])
      const external = value.TargetMode === 'External'
      const normalizedTarget = external ? value.Target : resolveTarget(sourcePart, value.Target || '')
      if (external) securityFlags.add('external-relationship')
      if (!external && normalizedTarget.startsWith('../')) securityFlags.add('relationship-traversal')
      relationships.push({
        id: value.Id, source: sourcePart, target: value.Target, normalizedTarget, type: value.Type,
        targetMode: external ? 'External' : 'Internal', external,
        dangling: !external && !extracted.has(normalizedTarget),
      })
    }
  }
  for (const part of parts) {
    if (part.encrypted) securityFlags.add('encrypted-entry')
    if (['macro', 'ole', 'activeX', 'signature'].includes(part.classification)) securityFlags.add(part.classification)
    const xml = extracted.get(part.path)?.toString('utf8')
    if (xml && /<(?:\w+:)?modifyVerifier\b|documentProtection\b/i.test(xml)) securityFlags.add('protected-content')
  }
  if (Object.values(contentTypes.overrides).some((type) => /macroEnabled/i.test(type))) securityFlags.add('macro')
  if (relationships.some((relationship) => relationship.dangling)) securityFlags.add('dangling-target')
  if (hasRelationshipCycle(relationships)) securityFlags.add('relationship-cycle')
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    packageSha256: crypto.createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length,
    contentTypes, parts, relationships,
    unknownParts: parts.filter((part) => part.classification === 'unknown').map((part) => part.path),
    securityFlags: [...securityFlags].sort(), safetyVerdict: 'safe',
  }
  manifest.complexObjects = describeComplexObjects(manifest)
  manifest.capabilitySummary = toSafeCapabilitySummary(manifest.complexObjects)
  validateManifest(manifest)
  return { ...manifest, manifestHash: hashRecord(manifest) }
}

module.exports = { buildOpcInventory, classify, parseContentTypes }
