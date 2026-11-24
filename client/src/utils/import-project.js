import JSZip from 'jszip'
import { getProjectImportContentErrors } from 'revealjs-shared'
import {
  buildLegacyArchiveEntries,
  rewriteProjectMediaUrls,
} from './project-media-utils'

/**
 * Parse uploaded file (.navslides ZIP or .navslides.json)
 * @param {File} file
 * @returns {Promise<{ type: 'zip'|'json', presentation: object, manifest?: object, mediaFiles?: Array }>}
 */
export async function parseProjectFile(file, options = {}) {
  const isZip = file.name.endsWith('.navslides') && !file.name.endsWith('.json')

  if (!isZip) {
    const text = await file.text()
    const data = JSON.parse(text)
    return { type: 'json', presentation: data.presentation, manifest: data, mediaFiles: [] }
  }
  if (options.serverAuthoritative) {
    return { type: 'zip', file, serverAuthoritative: true }
  }

  const zip = await JSZip.loadAsync(file)
  const manifestJson = await zip.file('manifest.json')?.async('text')
  const manifest = manifestJson ? JSON.parse(manifestJson) : null

  const presJson = await zip.file('presentation.json')?.async('text')
  if (!presJson) throw new Error('Invalid .navslides: missing presentation.json')
  const presentation = JSON.parse(presJson)

  const archiveFiles = []
  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (relativePath.startsWith('media/') && !zipEntry.dir) {
      archiveFiles.push({
        archivePath: relativePath,
        blob: await zipEntry.async('blob'),
      })
    }
  }

  const mediaFiles =
    Array.isArray(manifest?.media) && manifest.media.length
      ? await Promise.all(
          manifest.media.map(async (entry) => ({
            archivePath: entry.archivePath,
            blob: await zip.file(entry.archivePath)?.async('blob'),
            filename: entry.filename || entry.archivePath.replace(/^media\//, ''),
            originalUrl: entry.originalUrl,
          }))
        )
      : buildLegacyArchiveEntries(presentation, archiveFiles)

  return { type: 'zip', presentation, manifest, mediaFiles: mediaFiles.filter((entry) => entry.blob) }
}

export async function importProjectAtomically(api, file, options = {}) {
  options.onPhase?.('preflight')
  const admitted = await api.preflightProjectImport(file, {
    signal: options.signal,
    trustedAuthorActiveContentAcknowledged:
      options.trustedAuthorActiveContentAcknowledged === true,
  })
  const session = {
    sessionId: admitted.sessionId,
    capability: admitted.capability,
    trustedAuthorActiveContentAcknowledged:
      admitted.trustedAuthorActiveContentAcknowledged === true,
  }
  options.onSession?.(session)
  if (admitted.mediaCount > 0) {
    options.onPhase?.('media')
    await api.stageProjectImportMedia(session.sessionId, session.capability, {
      signal: options.signal,
    })
  }
  if (options.signal?.aborted) {
    const error = new Error('The operation was aborted')
    error.name = 'AbortError'
    throw error
  }
  options.onPhase?.('publishing')
  return api.publishProjectImport(session.sessionId, session.capability, {
    signal: options.signal,
    trustedAuthorActiveContentAcknowledged:
      session.trustedAuthorActiveContentAcknowledged,
  })
}

/**
 * Validate parsed project file structure.
 * @param {object} parsed
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateProjectFile(parsed) {
  const errors = []
  const warnings = []

  if (!parsed.presentation) {
    errors.push('Missing presentation data')
    return { valid: false, errors, warnings }
  }

  // Version recognition is structural only; DTO metadata never grants package authority.
  if (parsed.manifest?.version && !['1.0', '1.1', '2.0'].includes(parsed.manifest.version)) {
    warnings.push(`Unknown version: ${parsed.manifest.version}. Expected 1.0, 1.1 or 2.0`)
  }

  if (!parsed.presentation.title) warnings.push('Presentation missing title field')
  if (!Array.isArray(parsed.presentation.slides)) errors.push('Invalid structure: slides must be an array')
  errors.push(...getProjectImportContentErrors(parsed.presentation))

  return { valid: errors.length === 0, errors, warnings }
}

export function rewriteMediaUrls(presentation, urlMap) {
  return rewriteProjectMediaUrls(presentation, urlMap)
}

