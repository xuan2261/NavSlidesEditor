import JSZip from 'jszip'
import {
  buildLegacyArchiveEntries,
  rewriteProjectMediaUrls,
} from './project-media-utils'

/**
 * Parse uploaded file (.navslides ZIP or .navslides.json)
 * @param {File} file
 * @returns {Promise<{ type: 'zip'|'json', presentation: object, manifest?: object, mediaFiles?: Array }>}
 */
export async function parseProjectFile(file) {
  const isZip = file.name.endsWith('.navslides') && !file.name.endsWith('.json')

  if (!isZip) {
    const text = await file.text()
    const data = JSON.parse(text)
    return { type: 'json', presentation: data.presentation, manifest: data, mediaFiles: [] }
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

  if (parsed.manifest?.version && !['1.0', '1.1'].includes(parsed.manifest.version)) {
    warnings.push(`Unknown version: ${parsed.manifest.version}. Expected 1.0 or 1.1`)
  }

  if (!parsed.presentation.title) warnings.push('Presentation missing title field')
  if (!Array.isArray(parsed.presentation.slides)) errors.push('Invalid structure: slides must be an array')

  return { valid: errors.length === 0, errors, warnings }
}

export function rewriteMediaUrls(presentation, urlMap) {
  return rewriteProjectMediaUrls(presentation, urlMap)
}

export async function rehydrateImportedPresentation(api, parsed) {
  let finalPresentation = parsed.presentation
  if (parsed.type !== 'zip' || !parsed.mediaFiles?.length) return finalPresentation

  const urlMap = {}
  for (const media of parsed.mediaFiles) {
    try {
      const uploadName = media.filename || media.archivePath.replace(/^media\//, '')
      const uploaded = await api.uploadFile(new File([media.blob], uploadName))
      const uploadedUrl = uploaded.url || `/uploads/${uploaded.filename}`
      urlMap[media.originalUrl] = uploadedUrl
    } catch (error) {
      console.warn('Failed to upload media:', media.archivePath, error)
    }
  }

  if (Object.keys(urlMap).length > 0) finalPresentation = rewriteProjectMediaUrls(finalPresentation, urlMap)
  return finalPresentation
}
