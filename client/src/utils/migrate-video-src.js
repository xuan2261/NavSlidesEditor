/**
 * Back-compat migration for video elements: older presentations stored a URL in
 * `videoUrl`; the canonical field is now `src`. Fold `videoUrl` into `src`
 * when `src` is empty, but retain `videoUrl` as read-only legacy data so
 * migration is non-destructive. Renderers must resolve `src || videoUrl`.
 */
export function migrateVideoSrc(element) {
  if (!element || element.type !== 'video') return element
  if (!('videoUrl' in element)) return element
  return { ...element, src: element.src || element.videoUrl }
}
