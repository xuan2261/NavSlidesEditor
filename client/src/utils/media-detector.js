import { collectProjectMediaEntries } from './project-media-utils'

/**
 * Scan all slides for local project media URLs.
 * @param {object} presentation
 * @returns {{ hasLocalMedia: boolean, mediaUrls: string[] }}
 */
export function detectLocalMedia(presentation) {
  const mediaUrls = collectProjectMediaEntries(presentation, { localOnly: true }).map(
    (entry) => entry.originalUrl
  )

  return {
    hasLocalMedia: mediaUrls.length > 0,
    mediaUrls,
  }
}
