import JSZip from 'jszip'
import { generateRevealHTML } from 'revealjs-shared'
import { generateOfflineHTML } from './offlineExport'
import { detectLocalMedia } from './media-detector'

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

/**
 * Export presentation as .navslides.json (no local media)
 * or .navslides ZIP (has local media, includes offline HTML).
 * @param {object} presentation - presentation JSON object
 */
export async function exportProject(presentation) {
  const { hasLocalMedia, mediaUrls } = detectLocalMedia(presentation)
  const title = slugify(presentation?.title)
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  if (!hasLocalMedia) {
    // JSON-only export
    const data = {
      version: '1.0',
      title: presentation?.title || 'Presentation',
      exportedAt: new Date().toISOString(),
      hasLocalMedia: false,
      presentation,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `${title}-backup-${timestamp}.navslides.json`)
    return
  }

  // ZIP export with media
  const zip = new JSZip()
  const manifest = {
    version: '1.0',
    title: presentation?.title || 'Presentation',
    exportedAt: new Date().toISOString(),
    hasLocalMedia: true,
    mediaCount: mediaUrls.length,
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  zip.file('presentation.json', JSON.stringify(presentation, null, 2))

  // Fetch and add local media files
  const mediaFolder = zip.folder('media')
  await Promise.allSettled(mediaUrls.map(async (url) => {
    try {
      const fullUrl = url.startsWith('/') ? window.location.origin + url : url
      const resp = await fetch(fullUrl)
      if (!resp.ok) return
      const blob = await resp.blob()
      const filename = url.split('/').pop()
      mediaFolder.file(filename, blob)
    } catch { /* skip failed media */ }
  }))

  // Generate offline HTML and add
  try {
    const html = generateRevealHTML(presentation)
    const offline = await generateOfflineHTML(html)
    zip.file('presentation.html', offline)
  } catch { /* skip HTML generation */ }

  // Download ZIP
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  downloadBlob(zipBlob, `${title}-backup-${timestamp}.navslides`)
}
