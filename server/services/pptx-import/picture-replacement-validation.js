const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { UPLOADS_DIR, withUploadHashes } = require('../storage')
const { extractGeometryImageMetadata } = require('./geometry-image-metadata')
const { PptxSemanticValidationError } = require('revealjs-shared/src/pptx-semantic-document')
const { pictureReplacement, occurrencePictureReplacement, samePictureReplacement } = require('revealjs-shared/src/pptx-picture-replacement')
const { pictureOperationAvailable } = require('revealjs-shared/src/pptx-picture-operations')
const {
  semanticDefinition,
  semanticInstance,
  semanticInstances,
  replaceSemanticRecords,
} = require('revealjs-shared/src/pptx-semantic-records.js')
const fail = () => { throw new PptxSemanticValidationError('Uploaded picture replacement is not authorized') }

// Header admission matches imported pictures. This does not claim pixel decoding.
async function inspectPictureUpload(filePath, presentationId, filename) {
  const stat = await fs.lstat(filePath)
  if (!stat.isFile() || stat.size > 100 * 1024 * 1024) fail()
  const bytes = await fs.readFile(filePath)
  const { width, height, format } = extractGeometryImageMetadata(bytes)
  const extension = path.extname(filename).slice(1)
  if (format === 'jpeg' ? !['jpg', 'jpeg'].includes(extension) : extension !== format) fail()
  return pictureReplacement({
    kind: 'uploaded-picture', presentationId, filename,
    sha256: createHash('sha256').update(bytes).digest('hex'), width, height,
  })
}
function assertReplacementTarget(before, after, instanceId) {
  for (const presentation of [before, after]) {
    const document = presentation.pptxSemantic
    if (!semanticInstance(document, instanceId)) continue
    if (!pictureOperationAvailable(document, instanceId)) fail()
    let found = false
    function visit(slides, ancestorLocked = false) {
      for (const slide of slides || []) {
        const locked = ancestorLocked || slide.locked
        for (const element of slide.elements || []) if (element.pptxInstanceId === instanceId) {
          if (found || locked || element.locked) fail()
          found = true
        }
        visit(slide.children, locked)
      }
    }
    visit(presentation.slides)
    if (!found) fail()
  }
}
async function validatePictureReplacements(presentation, before) {
  const document = presentation.pptxSemantic
  if (!document) return
  const references = []
  for (const [, instance] of semanticInstances(document)) {
    if (!instance) continue
    const definition = semanticDefinition(document, instance.definitionId)
    if (!definition?.content?.pictureDocument) continue
    const replacement = occurrencePictureReplacement(definition, instance)
    const prior = before?.pptxSemantic ? semanticInstance(before.pptxSemantic, instance.id) : null
    const priorDefinition = prior ? semanticDefinition(before.pptxSemantic, prior.definitionId) : null
    const previousReplacement = priorDefinition?.content.pictureDocument
      ? occurrencePictureReplacement(priorDefinition, prior) : null
    if (before && !samePictureReplacement(previousReplacement, replacement))
      assertReplacementTarget(before, presentation, instance.id)
    if (replacement) references.push(replacement)
  }
  if (!references.length) return
  try {
    await withUploadHashes(async (hashes) => {
      const checked = new Map()
      for (const reference of references) {
        pictureReplacement(reference)
        if (reference.presentationId !== presentation.id) fail()
        const entry = Object.hasOwn(hashes, presentation.id) ? hashes[presentation.id]?.[reference.sha256] : null
        if (!entry || entry.filename !== reference.filename || entry.state === 'pending') fail()
        let actual = checked.get(reference.filename)
        if (!actual) {
          actual = await inspectPictureUpload(path.join(UPLOADS_DIR, reference.filename), presentation.id, reference.filename)
          checked.set(reference.filename, actual)
        }
        if (actual.sha256 !== reference.sha256 || actual.width !== reference.width ||
            actual.height !== reference.height) fail()
      }
    })
  } catch { fail() }
}
function replacementRecords(presentation) {
  const records = []
  const document = presentation?.pptxSemantic
  if (!document) return records
  for (const [, instance] of semanticInstances(document)) {
    if (!instance) continue
    const definition = semanticDefinition(document, instance.definitionId)
    const componentId = definition?.content?.pictureDocument?.componentId
    if (!componentId) continue
    const replacement = occurrencePictureReplacement(definition, instance)
    if (replacement) records.push({ instance, componentId, replacement })
  }
  return records
}
async function rebindPictureReplacementOwnership(presentation, sourceId, destinationId) {
  const records = replacementRecords(presentation)
  if (!records.length) return null
  for (const { replacement } of records) {
    pictureReplacement(replacement)
    if (replacement.presentationId !== sourceId) fail()
  }
  const prior = await withUploadHashes((hashes) => {
    if (Object.hasOwn(hashes, destinationId)) fail()
    const source = hashes[sourceId]
    if (!source || typeof source !== 'object' || Array.isArray(source)) fail()
    const destination = {}
    for (const { replacement } of records) {
      const entry = source[replacement.sha256]
      if (!entry || entry.filename !== replacement.filename || entry.state === 'pending') fail()
      destination[replacement.sha256] = { ...entry }
    }
    hashes[destinationId] = destination
    return destination
  })
  const updatedInstances = {}
  for (const { instance, componentId, replacement } of records) {
    const updatedReplacement = { ...replacement, presentationId: destinationId }
    try {
      replacement.presentationId = destinationId
    } catch {}
    const overrides = structuredClone(instance.overrides || {})
    overrides.components = overrides.components || {}
    overrides.components[componentId] = overrides.components[componentId] || {}
    overrides.components[componentId].picture = {
      ...(overrides.components[componentId].picture || {}),
      replacement: updatedReplacement,
    }
    updatedInstances[instance.id] = {
      ...instance,
      overrides,
    }
  }
  presentation.pptxSemantic = replaceSemanticRecords(presentation.pptxSemantic, {
    instances: updatedInstances,
  })
  return { destinationId, prior }
}
async function rollbackPictureReplacementOwnership(token) {
  if (!token) return
  await withUploadHashes((hashes) => {
    const current = hashes[token.destinationId]
    if (JSON.stringify(current) !== JSON.stringify(token.prior)) fail()
    delete hashes[token.destinationId]
  })
}
async function adoptProjectImportPictureReplacements(presentation, destinationId, placements = []) {
  const records = replacementRecords(presentation)
  if (!records.length) return null
  if (!Array.isArray(placements)) fail()
  const originalPlacements = new Map(), reboundPlacements = new Map()
  for (const item of placements) {
    if (typeof item?.originalUrl !== 'string' || originalPlacements.has(item.originalUrl)) fail()
    originalPlacements.set(item.originalUrl, item)
    const prior = reboundPlacements.get(item.filename)
    if (prior && (prior.sha256 !== item.sha256 || prior.absolutePath !== item.absolutePath)) fail()
    reboundPlacements.set(item.filename, item)
  }
  const adopted = await withUploadHashes(async (hashes) => {
    const existing = Object.hasOwn(hashes, destinationId) ? hashes[destinationId] : {}
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) fail()
    const destination = { ...existing }, checked = new Map(), updatedInstances = {}
    for (const { instance, componentId, replacement } of records) {
      try { pictureReplacement(replacement) } catch { fail() }
      let placement = originalPlacements.get(`/uploads/${replacement.filename}`)
      // Package recovery can retain an already-rebound projection. Its prior
      // destination grant is required; a filename alone never grants ownership.
      if (!placement && replacement.presentationId === destinationId) {
        const grant = existing[replacement.sha256]
        if (!grant || grant.filename !== replacement.filename || grant.state !== 'committed') fail()
        placement = reboundPlacements.get(replacement.filename)
      }
      if (!placement || placement.sha256 !== replacement.sha256) fail()
      try {
        pictureReplacement({ ...replacement, presentationId: destinationId, filename: placement.filename })
      } catch { fail() }
      const filePath = path.join(path.resolve(UPLOADS_DIR), placement.filename)
      if (placement.absolutePath !== filePath) fail()
      const owned = Object.values(hashes.global || {}).some(entry =>
        entry?.filename === placement.filename && entry.sha256 === placement.sha256 &&
        (placement.ownership === 'reused' ? entry.state === 'committed' :
          placement.ownership === 'new' && (entry.state === 'pending' &&
            typeof entry.placementOwner === 'string' && entry.placementOwner.startsWith('project-import:') &&
            entry.sourceKey === placement.archivePath ||
            entry.state === 'committed' && entry.presentationId === destinationId)))
      if (!owned) fail()
      let actual = checked.get(placement.filename)
      if (!actual) {
        try { actual = await inspectPictureUpload(filePath, destinationId, placement.filename) } catch { fail() }
        checked.set(placement.filename, actual)
      }
      if (actual.sha256 !== placement.sha256 || actual.width !== replacement.width ||
          actual.height !== replacement.height) fail()
      destination[actual.sha256] = {
        filename: actual.filename, originalName: actual.filename, sha256: actual.sha256,
        width: actual.width, height: actual.height, state: 'committed',
        uploadedAt: existing[actual.sha256]?.uploadedAt || new Date().toISOString(),
      }
      const overrides = structuredClone(instance.overrides || {})
      overrides.components = overrides.components || {}
      overrides.components[componentId] = overrides.components[componentId] || {}
      overrides.components[componentId].picture = {
        ...(overrides.components[componentId].picture || {}), replacement: actual,
      }
      updatedInstances[instance.id] = { ...instance, overrides }
    }
    const document = replaceSemanticRecords(presentation.pptxSemantic, { instances: updatedInstances })
    // Only publish after every receipt, placement, byte inspection and rewrite succeeds.
    hashes[destinationId] = destination
    return { prior: destination, document }
  })
  presentation.pptxSemantic = adopted.document
  return { destinationId, prior: adopted.prior }
}
module.exports = {
  inspectPictureUpload,
  validatePictureReplacements,
  rebindPictureReplacementOwnership,
  rollbackPictureReplacementOwnership,
  adoptProjectImportPictureReplacements,
}
