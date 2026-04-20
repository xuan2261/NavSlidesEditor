// Scans presentation elements for local media URLs (/uploads/*)

const LOCAL_URL_PATTERNS = [
  /^\/uploads\//,
  /^http.*\/uploads\//,
]

/**
 * Scan all slides' elements for local media URLs.
 * @param {object} presentation - presentation object
 * @returns {{ hasLocalMedia: boolean, mediaUrls: string[] }}
 */
export function detectLocalMedia(presentation) {
  const mediaUrls = new Set()
  const slides = presentation?.slides || []
  for (const slide of slides) {
    const elements = slide?.elements || []
    for (const el of elements) {
      if (el.src && LOCAL_URL_PATTERNS.some(p => p.test(el.src))) {
        mediaUrls.add(el.src)
      }
    }
    // Check background image
    if (slide.background?.type === 'image' && slide.background.src) {
      if (LOCAL_URL_PATTERNS.some(p => p.test(slide.background.src))) {
        mediaUrls.add(slide.background.src)
      }
    }
  }
  return { hasLocalMedia: mediaUrls.size > 0, mediaUrls: [...mediaUrls] }
}