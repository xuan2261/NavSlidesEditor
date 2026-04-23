const LOCAL_UPLOAD_PATTERNS = [/^\/uploads\//i, /^https?:\/\/[^/]+\/uploads\//i]

function sanitizeFilename(name) {
  return String(name || 'asset')
    .replace(/[?#].*$/, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
}

function hashString(value) {
  let hash = 5381
  for (const char of String(value || '')) hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0
  return hash.toString(16).padStart(8, '0')
}

export function isLocalProjectMediaUrl(url) {
  if (!url) return false
  return LOCAL_UPLOAD_PATTERNS.some((pattern) => pattern.test(String(url)))
}

export function getBackgroundImageUrl(backgroundOrSlide) {
  const background = backgroundOrSlide?.background || backgroundOrSlide
  if (!background || background.type !== 'image') return ''
  return background.image || background.src || ''
}

export function getMediaFilename(url) {
  if (!url) return ''
  try {
    const parsed = new URL(url, 'http://navslides.local')
    return sanitizeFilename(parsed.pathname.split('/').pop() || 'asset')
  } catch {
    return sanitizeFilename(String(url).split('/').pop() || 'asset')
  }
}

function addMediaEntry(target, seen, url, meta, localOnly) {
  if (!url) return
  if (localOnly && !isLocalProjectMediaUrl(url)) return
  if (seen.has(url)) return
  seen.add(url)
  target.push({ originalUrl: url, ...meta })
}

export function collectProjectMediaEntries(presentation, { localOnly = false } = {}) {
  const entries = []
  const seen = new Set()

  for (const [slideIndex, slide] of (presentation?.slides || []).entries()) {
    addMediaEntry(
      entries,
      seen,
      getBackgroundImageUrl(slide),
      { kind: 'background', slideIndex },
      localOnly
    )

    for (const element of slide?.elements || []) {
      addMediaEntry(
        entries,
        seen,
        element?.src,
        { kind: 'src', slideIndex, elementId: element?.id || null },
        localOnly
      )
      addMediaEntry(
        entries,
        seen,
        element?.poster,
        { kind: 'poster', slideIndex, elementId: element?.id || null },
        localOnly
      )
    }
  }

  return entries
}

export function buildArchiveMediaManifestEntries(presentation) {
  return collectProjectMediaEntries(presentation, { localOnly: true }).map((entry) => {
    const filename = getMediaFilename(entry.originalUrl)
    return {
      originalUrl: entry.originalUrl,
      archivePath: `media/${hashString(entry.originalUrl)}-${filename}`,
      filename,
    }
  })
}

export function rewriteProjectMediaUrls(presentation, urlMap) {
  const clone = JSON.parse(JSON.stringify(presentation))

  for (const slide of clone?.slides || []) {
    for (const element of slide?.elements || []) {
      if (element.src && urlMap[element.src]) element.src = urlMap[element.src]
      if (element.poster && urlMap[element.poster]) element.poster = urlMap[element.poster]
    }

    if (slide?.background?.type === 'image') {
      const current = getBackgroundImageUrl(slide)
      if (current && urlMap[current]) {
        slide.background.image = urlMap[current]
        delete slide.background.src
      }
    }
  }

  return clone
}

export function buildLegacyArchiveEntries(presentation, archiveFiles) {
  const refs = collectProjectMediaEntries(presentation)
  const unmatched = new Map()
  refs.forEach((ref) => {
    const filename = getMediaFilename(ref.originalUrl)
    if (!unmatched.has(filename)) unmatched.set(filename, [])
    unmatched.get(filename).push(ref.originalUrl)
  })

  return archiveFiles.map(({ archivePath, blob }) => {
    const filename = archivePath.replace(/^media\//, '')
    const candidates = unmatched.get(filename) || []
    const originalUrl = candidates.shift() || `/uploads/${filename}`
    if (candidates.length === 0) unmatched.delete(filename)

    return {
      archivePath,
      blob,
      filename,
      originalUrl,
    }
  })
}
