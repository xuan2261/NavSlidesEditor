const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { importPptxFile } = require('./importer')
const {
  normalizeTipTapSinglePlainRun,
  transportFromTipTapContent,
} = require('./tiptap-single-plain-run-eligibility')

const PLAIN_TEXT_ROW = 'primitive.text.run.plain-replacement'
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024
const SHA256 = /^[a-f0-9]{64}$/u

function failure(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function findSlide(slides, id) {
  for (const slide of slides || []) {
    if (slide?.id === id) return slide
    const nested = findSlide(slide?.children, id)
    if (nested) return nested
  }
  return null
}

function findElement(elements, id) {
  for (const element of elements || []) {
    if (element?.id === id) return element
    const nested = findElement(element?.elements || element?.children, id)
    if (nested) return nested
  }
  return null
}

function sameList(left, right) {
  return Array.isArray(left) && Array.isArray(right) &&
    left.length === right.length && left.every((value, index) => value === right[index])
}

function sameRecord(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null)
}

function sameStableProvenance(entry, sourceRef) {
  return entry?.status === 'authoritative' &&
    SHA256.test(entry.sourceHash || '') && SHA256.test(sourceRef.sourceHash || '') &&
    entry.packageGeneration === sourceRef.packageGeneration &&
    entry.revisionId === sourceRef.revisionId &&
    entry.partUri === sourceRef.partUri &&
    String(entry.nativeId) === String(sourceRef.nativeId) &&
    entry.kind === sourceRef.kind &&
    sameList(entry.relationshipChain, sourceRef.relationshipChain) &&
    sameList(entry.groupAncestry, sourceRef.groupAncestry) &&
    sameList(entry.occurrencePath, sourceRef.occurrencePath) &&
    sameRecord(entry.lineage, sourceRef.lineage) &&
    (entry.mediaPartUri || null) === (sourceRef.mediaPartUri || null) &&
    entry.matchMethod === sourceRef.matchMethod &&
    entry.confidence === sourceRef.confidence
}

function locateSource(imported, sourceRef, operation) {
  const entries = imported?.sourceMap?.entries
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return null
  const candidates = Object.entries(entries).filter(([, entry]) =>
    entry?.status === 'authoritative' &&
    entry.partUri === sourceRef.partUri &&
    String(entry.nativeId) === String(sourceRef.nativeId)
  )
  if (candidates.length !== 1) {
    if (candidates.length > 1) {
      throw failure('NATIVE_REIMPORT_SOURCE_AMBIGUOUS', 'Native re-import matched multiple source identities')
    }
    return null
  }
  const [key, entry] = candidates[0]
  const expectedKey = operation.slideId && operation.elementId
    ? `${operation.slideId}:${operation.elementId}`
    : null
  if (expectedKey && key !== expectedKey) {
    throw failure('NATIVE_REIMPORT_PROVENANCE_MISMATCH', 'Native re-import source key changed')
  }
  if (!sameStableProvenance(entry, sourceRef)) {
    throw failure('NATIVE_REIMPORT_PROVENANCE_MISMATCH', 'Native re-import source provenance changed')
  }
  return candidates[0]
}

function assertSourceMapIdentity(imported, context) {
  const sourceMap = imported?.sourceMap
  if (!sourceMap || sourceMap.presentationId !== context.presentationId ||
      sourceMap.revisionId !== context.revisionId ||
      sourceMap.packageGeneration !== context.packageGeneration) {
    throw failure('NATIVE_REIMPORT_PROVENANCE_MISMATCH', 'Native re-import package identity changed')
  }
}

function actualText(element) {
  const verdict = normalizeTipTapSinglePlainRun(transportFromTipTapContent(element?.content))
  return verdict.ok ? verdict.normalizedText : null
}

function validateOperation(imported, operation) {
  if (operation?.rowId !== PLAIN_TEXT_ROW || operation.objectKind !== 'text-run' ||
      typeof operation.after !== 'string') {
    throw failure('NATIVE_REIMPORT_OPERATION_UNSUPPORTED', 'Native re-import received an unsupported operation')
  }
  const sourceRef = operation.sourceRef
  if (sourceRef?.status !== 'authoritative' || !sourceRef.partUri || !sourceRef.nativeId ||
      !sourceRef.revisionId || !Number.isSafeInteger(sourceRef.packageGeneration) ||
      !sourceRef.kind || !sourceRef.matchMethod || sourceRef.confidence === undefined) {
    throw failure('NATIVE_REIMPORT_SOURCE_UNAVAILABLE', 'Native re-import source identity is unavailable')
  }
  const located = locateSource(imported, sourceRef, operation)
  if (!located) throw failure('NATIVE_REIMPORT_SOURCE_UNAVAILABLE', 'Native re-import could not match source identity')
  const [key] = located
  const separator = key.indexOf(':')
  if (separator <= 0) throw failure('NATIVE_REIMPORT_SOURCE_UNAVAILABLE', 'Native re-import element key is invalid')
  const slide = findSlide(imported.presentation?.slides, key.slice(0, separator))
  const element = findElement(slide?.elements, key.slice(separator + 1))
  if (!element || actualText(element) !== operation.after) {
    throw failure('NATIVE_REIMPORT_SEMANTIC_MISMATCH', 'Native re-import text does not match the journal')
  }
}

function createNativeReimportValidator({
  importer = importPptxFile,
  workspaceRoot = path.join(os.tmpdir(), 'navslides-native-reimport'),
  maxBytes = DEFAULT_MAX_BYTES,
} = {}) {
  if (typeof importer !== 'function') throw new TypeError('Native re-import importer is required')
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new TypeError('Native re-import byte limit is invalid')

  return async function nativeReimport(context = {}) {
    if (!Buffer.isBuffer(context.afterBytes) || context.afterBytes.length > maxBytes) {
      throw failure('NATIVE_REIMPORT_INPUT_INVALID', 'Native re-import package bytes are invalid or oversized')
    }
    if (!Array.isArray(context.journal?.operations) || context.journal.operations.length === 0) {
      throw failure('NATIVE_REIMPORT_JOURNAL_INVALID', 'Native re-import journal is empty or invalid')
    }
    await fs.mkdir(workspaceRoot, { recursive: true })
    const jobRoot = await fs.mkdtemp(path.join(workspaceRoot, 'job-'))
    try {
      const packagePath = path.join(jobRoot, 'edited-export.pptx')
      const uploadsDir = path.join(jobRoot, 'uploads')
      await fs.mkdir(uploadsDir, { recursive: true })
      await fs.writeFile(packagePath, context.afterBytes)
      const imported = await importer(packagePath, {
        originalName: 'edited-export.pptx',
        uploadsDir,
        strict: true,
        strictCountGate: true,
        strictNodeGate: true,
        sourceMapIdentity: {
          presentationId: context.presentationId,
          revisionId: context.revisionId,
          packageGeneration: context.packageGeneration,
        },
        signal: context.signal,
      })
      if (!imported?.presentation || !imported?.sourceMap) {
        throw failure('NATIVE_REIMPORT_RESULT_INVALID', 'Native re-import did not return projection authority')
      }
      assertSourceMapIdentity(imported, context)
      for (const operation of context.journal.operations) validateOperation(imported, operation)
      return true
    } catch (error) {
      if (error?.code) throw error
      throw failure('NATIVE_REIMPORT_FAILED', error?.message || 'Native re-import failed')
    } finally {
      await fs.rm(jobRoot, { recursive: true, force: true })
    }
  }
}

module.exports = { DEFAULT_MAX_BYTES, createNativeReimportValidator }
