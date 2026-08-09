/**
 * Back-compat migration for video elements: older presentations stored a URL in
 * `videoUrl`; the canonical field is now `src`. Legacy data remains readable
 * only when the canonical field is absent. An explicit blank `src` is an
 * intentional source clear and must not resurrect the legacy URL.
 */
export function resolveVideoSrc(element) {
  if (!element || element.type !== 'video') return ''
  if (Object.prototype.hasOwnProperty.call(element, 'src')) return element.src || ''
  return element.videoUrl || ''
}

export function migrateVideoSrc(element) {
  if (!element || element.type !== 'video') return element
  if (!('videoUrl' in element)) return element
  if (element.src) return element
  if (!Object.prototype.hasOwnProperty.call(element, 'src')) {
    return { ...element, src: element.videoUrl }
  }
  return element
}
