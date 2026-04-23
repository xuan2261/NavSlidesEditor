import JSZip from 'jszip'
import { generateRevealHTML } from 'revealjs-shared'
import { generateOfflineHTML } from './offlineExport'
import { buildArchiveMediaManifestEntries } from './project-media-utils'

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

async function fetchProjectMediaBlob(url) {
  const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url
  const response = await fetch(fullUrl)
  if (!response.ok) throw new Error(`Failed to fetch ${url}`)
  return await response.blob()
}

function getExportWarningMessage(reason) {
  if (reason instanceof Error) return reason.message
  return reason ? String(reason) : 'Failed to fetch media'
}

async function collectProjectMediaFiles(mediaEntries) {
  const settledResults = await Promise.allSettled(
    mediaEntries.map(async (entry) => ({
      ...entry,
      blob: await fetchProjectMediaBlob(entry.originalUrl),
    }))
  )

  return settledResults.reduce(
    (result, settledResult, index) => {
      if (settledResult.status === 'fulfilled') {
        result.included.push(settledResult.value)
      } else {
        result.skipped.push({
          ...mediaEntries[index],
          reason: getExportWarningMessage(settledResult.reason),
        })
      }
      return result
    },
    { included: [], skipped: [] }
  )
}

/**
 * Export presentation as .navslides.json (no local media)
 * or .navslides ZIP (has local media, includes offline HTML).
 * @param {object} presentation
 */
export async function exportProject(presentation) {
  const mediaEntries = buildArchiveMediaManifestEntries(presentation)
  const title = slugify(presentation?.title)
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  if (!mediaEntries.length) {
    const data = {
      version: '1.1',
      title: presentation?.title || 'Presentation',
      exportedAt: new Date().toISOString(),
      hasLocalMedia: false,
      presentation,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `${title}-backup-${timestamp}.navslides.json`)
    return
  }

  const zip = new JSZip()
  zip.file('presentation.json', JSON.stringify(presentation, null, 2))

  const { included, skipped } = await collectProjectMediaFiles(mediaEntries)
  included.forEach(({ blob, ...entry }) => {
    zip.file(entry.archivePath, blob)
  })

  if (skipped.length > 0) {
    console.warn('Project export skipped media files:', skipped)
  }

  const manifestMedia = included.map(({ blob: _blob, ...entry }) => entry)
  const manifest = {
    version: '1.1',
    title: presentation?.title || 'Presentation',
    exportedAt: new Date().toISOString(),
    hasLocalMedia: manifestMedia.length > 0,
    mediaCount: manifestMedia.length,
    media: manifestMedia,
    ...(skipped.length > 0 ? { skippedMedia: skipped } : {}),
  }

  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  try {
    const html = generateRevealHTML(presentation)
    const offline = await generateOfflineHTML(html)
    zip.file('presentation.html', offline)
  } catch {
    /* skip HTML generation */
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  downloadBlob(zipBlob, `${title}-backup-${timestamp}.navslides`)
}
