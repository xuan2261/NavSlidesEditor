import JSZip from 'jszip'

/**
 * Parse uploaded file (.navslides ZIP or .navslides.json)
 * @param {File} file
 * @returns {Promise<{ type: 'zip'|'json', presentation: object, manifest?: object, mediaFiles?: object }>}
 */
export async function parseProjectFile(file) {
  const isZip = file.name.endsWith('.navslides') && !file.name.endsWith('.json')

  if (!isZip) {
    const text = await file.text()
    const data = JSON.parse(text)
    return { type: 'json', presentation: data.presentation, manifest: data }
  }

  // ZIP file
  const zip = await JSZip.loadAsync(file)
  const manifestJson = await zip.file('manifest.json')?.async('text')
  const manifest = manifestJson ? JSON.parse(manifestJson) : null

  const presJson = await zip.file('presentation.json')?.async('text')
  if (!presJson) throw new Error('Invalid .navslides: missing presentation.json')
  const presentation = JSON.parse(presJson)

  // Collect media files
  const mediaFiles = {}
  const mediaFolder = zip.folder('media')
  if (mediaFolder) {
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      if (relativePath.startsWith('media/') && !zipEntry.dir) {
        const filename = relativePath.replace('media/', '')
        if (filename) {
          mediaFiles[filename] = await zipEntry.async('blob')
        }
      }
    }
  }

  return { type: 'zip', presentation, manifest, mediaFiles }
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

  if (parsed.manifest?.version && parsed.manifest.version !== '1.0') {
    warnings.push(`Unknown version: ${parsed.manifest.version}. Expected 1.0`)
  }

  if (!parsed.presentation.title) {
    warnings.push('Presentation missing title field')
  }

  if (!Array.isArray(parsed.presentation.slides)) {
    errors.push('Invalid structure: slides must be an array')
  }

  return { valid: errors.length === 0, errors, warnings }
}

/**
 * Rewrite local media URLs to new uploaded server URLs.
 * Returns a deep-cloned presentation object with updated URLs.
 * @param {object} presentation
 * @param {Record<string, string>} urlMap - old path → new path
 * @returns {object}
 */
export function rewriteMediaUrls(presentation, urlMap) {
  const clone = JSON.parse(JSON.stringify(presentation))
  for (const slide of clone.slides || []) {
    for (const el of slide.elements || []) {
      if (el.src && urlMap[el.src]) {
        el.src = urlMap[el.src]
      }
    }
    if (slide.background?.src && urlMap[slide.background.src]) {
      slide.background.src = urlMap[slide.background.src]
    }
  }
  return clone
}
