const os = require('node:os')
const path = require('node:path')
const fs = require('fs-extra')
const { sanitizeDiagnostic } = require('./diagnostics')
const { hashFile } = require('./evidence/corpus-manifest')

function errorDetail(error, type) {
  return { type, message: sanitizeDiagnostic(error) }
}

async function removeSnapshot(directory, filePath) {
  let restoreError = null
  if (filePath) {
    try {
      await fs.chmod(filePath, 0o600)
    } catch (error) {
      restoreError = errorDetail(error, 'snapshot-restore-failed')
    }
  }
  try {
    await fs.remove(directory)
    return null
  } catch (error) {
    const cleanupError = errorDetail(error, 'snapshot-cleanup-failed')
    return restoreError
      ? { type: cleanupError.type, message: `${restoreError.message}; ${cleanupError.message}` }
      : cleanupError
  }
}

function sourcePath(corpusDir, deckId) {
  const corpusRoot = path.resolve(corpusDir)
  const filePath = path.resolve(corpusRoot, deckId)
  if (
    deckId !== path.basename(deckId) ||
    path.dirname(filePath) !== corpusRoot ||
    !filePath.toLowerCase().endsWith('.pptx')
  ) {
    throw new TypeError('qualification deck id must be a PPTX file in the corpus directory')
  }
  return filePath
}

async function createSourceSnapshot({ corpusDir, deck, hash = hashFile }) {
  let directory
  let filePath
  try {
    if (typeof corpusDir !== 'string' || typeof deck?.id !== 'string' || typeof deck?.sha256 !== 'string') {
      throw new TypeError('qualification source requires corpusDir, deck id and SHA-256')
    }
    const inputPath = sourcePath(corpusDir, deck.id)
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'navslides-pptx-qualification-'))
    filePath = path.join(directory, path.basename(deck.id))
    await fs.copyFile(inputPath, filePath)
    let sourceSha256
    try {
      sourceSha256 = await hash(filePath)
    } catch (error) {
      const cleanupError = await removeSnapshot(directory, filePath)
      return {
        ok: false,
        blocker: 'source-hash-unavailable',
        errorDetails: [errorDetail(error, 'source-hash-unavailable'), ...(cleanupError ? [cleanupError] : [])],
      }
    }
    if (sourceSha256 !== deck.sha256) {
      const cleanupError = await removeSnapshot(directory, filePath)
      return {
        ok: false,
        blocker: 'source-snapshot-hash-mismatch',
        errorDetails: [
          { type: 'source-hash-mismatch', message: 'Qualification source snapshot does not match manifest SHA-256.' },
          ...(cleanupError ? [cleanupError] : []),
        ],
      }
    }
    try {
      await fs.chmod(filePath, 0o444)
    } catch (error) {
      const cleanupError = await removeSnapshot(directory, filePath)
      return {
        ok: false,
        blocker: 'source-snapshot-protection-unavailable',
        errorDetails: [errorDetail(error, 'source-snapshot-protection-unavailable'), ...(cleanupError ? [cleanupError] : [])],
      }
    }
    return {
      ok: true,
      filePath,
      sourceSha256,
      async verify() {
        try {
          const currentHash = await hash(filePath)
          return currentHash === sourceSha256
            ? { ok: true, sourceSha256: currentHash }
            : {
              ok: false,
              blocker: 'source-snapshot-changed',
              sourceSha256: currentHash,
              errorDetails: [{ type: 'source-snapshot-changed', message: 'Qualification source snapshot changed during import.' }],
            }
        } catch (error) {
          return { ok: false, blocker: 'source-snapshot-unavailable', sourceSha256: null, errorDetails: [errorDetail(error, 'source-hash-unavailable')] }
        }
      },
      async cleanup() {
        return removeSnapshot(directory, filePath)
      },
    }
  } catch (error) {
    const cleanupError = directory ? await removeSnapshot(directory, filePath) : null
    return {
      ok: false,
      blocker: 'source-snapshot-unavailable',
      errorDetails: [errorDetail(error, 'source-snapshot-unavailable'), ...(cleanupError ? [cleanupError] : [])],
    }
  }
}

async function runSnapshotPass(snapshot, importer, options) {
  const before = await snapshot.verify()
  if (!before.ok) return { before, after: null, imported: null, error: null }
  let imported
  let error = null
  try {
    imported = await importer(snapshot.filePath, options)
  } catch (caught) {
    error = caught
  }
  return { before, after: await snapshot.verify(), imported, error }
}

module.exports = { createSourceSnapshot, runSnapshotPass }
