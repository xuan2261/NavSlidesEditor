import shared from 'revealjs-shared'

const {
  isSafeHref: isSharedSafeHref,
  isSafeMediaSrc: isSharedSafeMediaSrc,
  sanitizeMediaSrc: sanitizeSharedMediaSrc,
} = shared

const MEDIA_DATA_KIND = /^data:(image|audio|video)\//i

export const isSafeHref = isSharedSafeHref
export const isSafeMediaSrc = isSharedSafeMediaSrc
export const sanitizeMediaSrc = sanitizeSharedMediaSrc

export function resolveUrlEntry(value, kind) {
  const normalized = String(value || '').trim()
  const mediaKind = String(kind || '').toLowerCase()

  if (mediaKind === 'link') {
    return isSafeHref(normalized)
      ? { value: normalized, error: '' }
      : { value: '', error: 'Enter a safe HTTP(S), mailto, tel, project-relative, or slide link.' }
  }

  if (!isSafeMediaSrc(normalized)) {
    return { value: '', error: `Enter a safe ${mediaKind || 'media'} URL.` }
  }

  const dataKind = normalized.match(MEDIA_DATA_KIND)?.[1]?.toLowerCase()
  if (dataKind && mediaKind && dataKind !== mediaKind) {
    const article = /^[aeiou]/.test(mediaKind) ? 'an' : 'a'
    return { value: '', error: `Enter ${article} ${mediaKind} data URL, not ${dataKind}.` }
  }

  return { value: normalized, error: '' }
}
