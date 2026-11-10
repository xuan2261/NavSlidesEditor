import JSZip from 'jszip'
import { generateRevealHTML, projectExportValue } from 'revealjs-shared'
import { generateOfflineHTML } from './offlineExport'
import { buildArchiveMediaManifestEntries } from './project-media-utils'
import { api } from './api'
import {
  assertOutputActive, prepareSemanticOutputResources, validateSemanticOutputHTML,
} from './generateHTML'

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function slugify(str) {
  return String(str || 'presentation')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function fetchProjectMediaBytes(url) {
  const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url
  const response = await fetch(fullUrl)
  if (!response.ok) throw new Error(`Failed to fetch ${url} (HTTP ${response.status})`)
  return new Uint8Array(await response.arrayBuffer())
}


/** Remove client authority only for the legacy projection-only export format. */
export function toProjectExportPresentation(presentation) {
  return projectExportValue(presentation)
}

function getExportWarningMessage(reason) {
  if (reason instanceof Error) return reason.message
  return reason ? String(reason) : 'Failed to fetch media'
}

async function collectProjectMediaFiles(mediaEntries) {
  const settledResults = await Promise.allSettled(
    mediaEntries.map(async (entry) => ({
      ...entry,
      bytes: await fetchProjectMediaBytes(entry.originalUrl),
    }))
  )

  const included = []
  const failures = []
  settledResults.forEach((result, index) => {
    if (result.status === 'fulfilled') included.push(result.value)
    else failures.push({ ...mediaEntries[index], reason: getExportWarningMessage(result.reason) })
  })
  if (failures.length) {
    throw Object.assign(
      new Error(
        `Project media attachment failed: ${failures.map((item) => `${item.originalUrl}: ${item.reason}`).join('; ')}`
      ),
      {
        code: 'PROJECT_MEDIA_ATTACHMENT_FAILED',
        failures,
      }
    )
  }
  return included
}

/**
 * Package-backed decks use the server-owned ZIP v2 archive, with or without media.
 * Legacy projections use JSON v1.1 or a media ZIP without package fidelity claims.
 * @param {object} presentation
 */
export async function exportProject(presentation, { signal } = {}) {
  assertOutputActive(signal)
  if (presentation?.pptxSourceAvailable === true) {
    if (!presentation.id || !Number.isSafeInteger(presentation.aggregateGeneration) || presentation.aggregateGeneration < 1) {
      throw new Error('Project archive requires a saved package generation')
    }
    const archive = await api.downloadProjectArchive(presentation.id, presentation.aggregateGeneration)
    assertOutputActive(signal)
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    downloadBlob(archive, `${slugify(presentation.title)}-backup-${timestamp}.navslides`)
    return
  }
  const exportPresentation = toProjectExportPresentation(presentation)
  const mediaEntries = buildArchiveMediaManifestEntries(exportPresentation)
  const title = slugify(exportPresentation?.title)
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  if (!mediaEntries.length) {
    const data = {
      version: '1.1',
      title: exportPresentation?.title || 'Presentation',
      exportedAt: new Date().toISOString(),
      hasLocalMedia: false,
      presentation: exportPresentation,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `${title}-backup-${timestamp}.navslides.json`)
    return
  }

  const zip = new JSZip()
  zip.file('presentation.json', JSON.stringify(exportPresentation, null, 2))

  const included = await collectProjectMediaFiles(mediaEntries)
  assertOutputActive(signal)
  included.forEach(({ bytes, ...entry }) => {
    zip.file(entry.archivePath, bytes)
  })

  const manifestMedia = included.map(({ bytes: _bytes, ...entry }) => entry)
  const manifest = {
    version: '1.1',
    title: exportPresentation?.title || 'Presentation',
    exportedAt: new Date().toISOString(),
    hasLocalMedia: manifestMedia.length > 0,
    mediaCount: manifestMedia.length,
    media: manifestMedia,
  }

  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  try {
    const semanticOutputResources = await prepareSemanticOutputResources(presentation, { signal })
    assertOutputActive(signal)
    // Projection stripping must not erase the canonical journal used by this
    // attachment. The archive JSON remains the existing external projection.
    const htmlPresentation = presentation.pptxSemantic
      ? { ...exportPresentation, pptxSemantic: presentation.pptxSemantic } : exportPresentation
    const html = generateRevealHTML(htmlPresentation, { portable: true, semanticOutputResources })
    const offline = await generateOfflineHTML(html, {
      generatedDocument: true,
      strictRequiredAssets: true,
    })
    assertOutputActive(signal)
    if (presentation.pptxSemantic) await validateSemanticOutputHTML(offline, { signal })
    assertOutputActive(signal)
    zip.file('presentation.html', offline)
  } catch (cause) {
    throw Object.assign(
      new Error(`Project HTML attachment failed: ${getExportWarningMessage(cause)}`, { cause }),
      {
        code: 'PROJECT_HTML_ATTACHMENT_FAILED',
      }
    )
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  assertOutputActive(signal)
  downloadBlob(zipBlob, `${title}-backup-${timestamp}.navslides`)
}
