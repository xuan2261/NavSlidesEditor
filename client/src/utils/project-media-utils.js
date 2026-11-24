import {
  collectGameMediaReferences,
  geometryBlipMediaReferences,
  rewriteGameMediaUrls,
  rewriteGeometryBlipMedia,
} from 'revealjs-shared'
import { semanticDefinitions, replaceSemanticRecords } from 'revealjs-shared/src/pptx-semantic-records.js'

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

export function collectProjectMediaEntries(presentation, { localOnly = false } = {}) {
  const entries = new Map()
  const references = collectGameMediaReferences(presentation)
  references.push(...geometryBlipMediaReferences(presentation))
  if (presentation?.pptxSemantic) {
    for (const [id, definition] of semanticDefinitions(presentation.pptxSemantic)) {
      for (const key of ['src', 'videoUrl', 'poster']) {
        const url = definition.content?.media?.[key]
        if (typeof url === 'string' && url)
          references.push({
            url,
            path: ['pptxSemantic', 'definitions', id, 'content', 'media', key],
            kind: 'media',
          })
      }
    }
  }
  for (const { url, path, kind } of references) {
    if (localOnly && !isLocalProjectMediaUrl(url)) continue
    if (!entries.has(url)) {
      const location =
        path[0] === 'slides'
          ? { slideIndex: path[1], ...(path[2] === 'children' ? { childIndex: path[3] } : {}) }
          : path[0] === 'layoutMasters'
            ? { layoutMasterIndex: path[1] }
            : {}
      const elementAt = path.lastIndexOf('elements')
      const element =
        elementAt < 0
          ? null
          : path.slice(0, elementAt + 2).reduce((at, key) => at?.[key], presentation)
      entries.set(url, {
        originalUrl: url,
        kind,
        ...location,
        elementId: element?.id || null,
        references: [],
      })
    }
    entries.get(url).references.push({ path, kind })
  }
  return [...entries.values()]
}

export function buildArchiveMediaManifestEntries(presentation) {
  const paths = new Set()
  return collectProjectMediaEntries(presentation, { localOnly: true }).map((entry) => {
    const filename = getMediaFilename(entry.originalUrl)
    const prefix = hashString(entry.originalUrl)
    let archivePath = `media/${prefix}-${filename}`
    let collision = 1
    while (paths.has(archivePath.toLowerCase()))
      archivePath = `media/${prefix}-${++collision}-${filename}`
    paths.add(archivePath.toLowerCase())
    return { originalUrl: entry.originalUrl, archivePath, filename, references: entry.references }
  })
}

export function rewriteProjectMediaUrls(presentation, urlMap) {
  let clone = rewriteGameMediaUrls(presentation, urlMap)
  if (clone?.pptxSemantic) {
    const patchDefinitions = {}
    for (const [id, definition] of semanticDefinitions(clone.pptxSemantic)) {
      const media = definition.content?.media
      if (!media) continue
      let modified = false
      const nextMedia = { ...media }
      for (const key of ['src', 'videoUrl', 'poster']) {
        if (typeof nextMedia[key] === 'string' && Object.hasOwn(urlMap, nextMedia[key])) {
          nextMedia[key] = urlMap[nextMedia[key]]
          modified = true
        }
      }
      if (modified) {
        patchDefinitions[id] = {
          ...definition,
          content: {
            ...definition.content,
            media: nextMedia,
          },
        }
      }
    }
    if (Object.keys(patchDefinitions).length) {
      clone = {
        ...clone,
        pptxSemantic: replaceSemanticRecords(clone.pptxSemantic, { definitions: patchDefinitions }),
      }
    }
  }
  return rewriteGeometryBlipMedia(clone, url => Object.hasOwn(urlMap, url) ? urlMap[url] : url)
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
