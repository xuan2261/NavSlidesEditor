/**
 * Back-compat migration for video elements: older presentations stored a URL in
 * `videoUrl`; the renderer resolves `videoUrl || src` so old data still plays,
 * but the canonical field is now `src`. Fold `videoUrl` into `src` (when `src`
 * is empty) and DROP `videoUrl` so the renderer's fallback can never shadow a
 * later edit to `src`. Pure + per-element so it can run inside the per-slide
 * migration funnel before the history snapshot.
 */
export function migrateVideoSrc(element) {
  if (!element || element.type !== 'video') return element
  if (!('videoUrl' in element)) return element
  const { videoUrl, ...rest } = element
  return { ...rest, src: element.src || videoUrl }
}
