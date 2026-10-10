const express = require('express')
const JSZip = require('jszip')
const { privateEditorOnly } = require('./project-import-origin')
const { isSafePresentationId } = require('./presentations-helpers')
const { readAuthoritativePresentation } = require('../services/package-backed-presentation-read')
const { getReadablePackageStore } = require('../services/pptx-import/package-store-runtime')
const { validatePortableBundle } = require('../services/pptx-import/package-store/portable')
const { hashRecord } = require('../services/pptx-import/package-store/schemas')
const { stripAuthority } = require('../services/pptx-import/package-store/dto')
const { PROJECT_IMPORT_LIMITS } = require('../services/project-import-archive-limits')
const { importError, inspectPresentation } = require('../services/project-import-archive-validation')
const { inspectRawEntries } = require('../services/project-import-archive-entries')
const { collectOwnedArchiveMedia } = require('./project-export-media')

const router = express.Router()
const sourceChanged = () => importError('SYNC_SOURCE_CHANGED', 'Presentation changed during full project export', 409)
const EXPORT_LIMITS = Object.freeze({ ...PROJECT_IMPORT_LIMITS,
  maxExpandedBytes: Math.min(PROJECT_IMPORT_LIMITS.maxExpandedBytes, PROJECT_IMPORT_LIMITS.maxCompressedBytes) })

function assertBundleBounds(state, head, limits) {
  const ids = new Set([head.originalRevisionId, head.packageRevisionId])
  const hashes = new Set(state.revisions.filter((revision) => ids.has(revision.id)).map((revision) => revision.blobSha256))
  const blobs = state.blobs.filter((blob) => hashes.has(blob.sha256))
  if (blobs.length + 3 > limits.maxEntries || blobs.some((blob) => blob.byteLength > limits.maxEntryBytes) ||
      blobs.reduce((sum, blob) => sum + blob.byteLength, 0) > limits.maxExpandedBytes) {
    throw importError('PROJECT_ARCHIVE_EXPANSION_LIMIT', 'Package exceeds project archive policy', 413)
  }
}

router.get('/:id/project-archive',
  (req, res, next) => privateEditorOnly(req, res, next, { allowReadNavigation: true }),
  (_req, res, next) => { res.set('Cache-Control', 'no-store'); next() },
  async (req, res) => {
  let assertCurrent
  try {
    const generationHeader = req.get('If-Pptx-Generation')
    if (generationHeader === undefined) throw importError('EXPECTED_GENERATION_REQUIRED', 'If-Pptx-Generation is required', 428)
    if (!/^[1-9]\d*$/u.test(generationHeader) || !Number.isSafeInteger(Number(generationHeader))) {
      throw importError('INVALID_EXPECTED_GENERATION', 'If-Pptx-Generation must be a positive safe integer')
    }
    if (!isSafePresentationId(req.params.id)) throw importError('INVALID_PRESENTATION_ID', 'Presentation ID is invalid')
    const store = await getReadablePackageStore()
    const state = store.getState()
    const heads = state.heads.filter((head) => head.presentationId === req.params.id)
    if (heads.length !== 1 || heads[0].generation !== Number(generationHeader)) throw sourceChanged()
    const expectedHead = structuredClone(heads[0]), expectedHash = hashRecord(expectedHead)
    assertCurrent = () => {
      const current = store.getState().heads.filter((head) => head.presentationId === req.params.id)
      if (current.length !== 1 || hashRecord(current[0]) !== expectedHash) throw sourceChanged()
    }
    assertBundleBounds(state, expectedHead, EXPORT_LIMITS)
    const resolved = await readAuthoritativePresentation(req.params.id, { normalize: false })
    assertCurrent()
    if (!resolved) throw importError('PRESENTATION_NOT_FOUND', 'Presentation not found', 404)
    const bundle = await store.exportPresentationPackage(req.params.id, { expectedHead })
    assertCurrent()
    if (!bundle) throw sourceChanged()
    const verified = validatePortableBundle(bundle)
    const presentation = verified.projection || stripAuthority(resolved.presentation)
    inspectPresentation(presentation, PROJECT_IMPORT_LIMITS)
    const presentationBytes = Buffer.from(JSON.stringify(presentation))
    const packageBytes = Buffer.from(JSON.stringify(bundle.manifest))
    if (presentationBytes.length > PROJECT_IMPORT_LIMITS.maxJsonBytes || packageBytes.length > PROJECT_IMPORT_LIMITS.maxJsonBytes) {
      throw importError('PROJECT_JSON_LIMIT', 'Project JSON exceeds archive policy', 413)
    }
    const budget = { used: presentationBytes.length + packageBytes.length + bundle.blobs.reduce((sum, blob) => sum + blob.byteLength, 0) }
    if (budget.used > EXPORT_LIMITS.maxExpandedBytes) throw importError('PROJECT_ARCHIVE_COMPRESSED_LIMIT', 'Project exceeds response byte policy', 413)
    const origin = new URL(req.get('origin') || req.get('referer')).origin
    const media = await collectOwnedArchiveMedia(req.params.id, [presentation, ...(verified.mediaProjections || [])],
      origin, EXPORT_LIMITS, budget, assertCurrent)
    const manifestBytes = Buffer.from(JSON.stringify({ version: '2.0', media: media.media, externalLinks: media.externalLinks,
      ...(media.sourceOrigin ? { sourceOrigin: media.sourceOrigin } : {}) }))
    if (manifestBytes.length > PROJECT_IMPORT_LIMITS.maxJsonBytes || budget.used + manifestBytes.length > EXPORT_LIMITS.maxExpandedBytes) {
      throw importError('PROJECT_ARCHIVE_EXPANSION_LIMIT', 'Project manifest exceeds archive policy', 413)
    }
    if (bundle.blobs.length + media.payloads.length + 3 > PROJECT_IMPORT_LIMITS.maxEntries) throw importError('PROJECT_ARCHIVE_ENTRY_LIMIT', 'Project has too many archive entries', 413)
    const zip = new JSZip(), add = (name, bytes) => zip.file(name, bytes, { createFolders: false })
    add('manifest.json', manifestBytes); add('presentation.json', presentationBytes); add('package/manifest.json', packageBytes)
    for (const blob of bundle.blobs) add(`package/blobs/${blob.sha256}`, blob.bytes)
    for (const item of media.payloads) add(item.archivePath, item.bytes)
    assertCurrent()
    // STORE keeps the response inside the same compression-ratio policy as preflight.
    const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
    assertCurrent()
    if (bytes.length > PROJECT_IMPORT_LIMITS.maxCompressedBytes) throw importError('PROJECT_ARCHIVE_COMPRESSED_LIMIT', 'Project archive is too large', 413)
    inspectRawEntries(bytes, PROJECT_IMPORT_LIMITS)
    const title = String(presentation.title || 'presentation').replace(/[^a-z0-9._-]+/giu, '_').slice(0, 120) || 'presentation'
    res.set('Content-Type', 'application/zip')
    res.set('Content-Disposition', `attachment; filename="${title}.navslides"`)
    res.set('Content-Length', String(bytes.length))
    res.set('X-Pptx-Generation', String(expectedHead.generation))
    return res.send(bytes)
  } catch (error) {
    let failure = error
    if (assertCurrent) {
      try { assertCurrent() } catch (conflict) { failure = conflict }
    }
    return res.status(failure.status || 500).json({ error: failure.status ? failure.message : 'Full project export failed safely',
      code: failure.code || 'PROJECT_EXPORT_FAILED' })
  }
})

module.exports = router
