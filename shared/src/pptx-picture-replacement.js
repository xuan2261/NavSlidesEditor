// Uploaded occurrence identity is deliberately separate from native source authority.
function pictureReplacement(value) {
  const keys = ['kind', 'presentationId', 'filename', 'sha256', 'width', 'height']
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || keys.some((key) => !Object.hasOwn(value, key)) ||
      value.kind !== 'uploaded-picture' ||
      typeof value.presentationId !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,200}$/.test(value.presentationId) ||
      ['global', '__proto__', 'constructor', 'prototype'].includes(value.presentationId) ||
      typeof value.filename !== 'string' ||
      !/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|gif|webp|bmp)$/.test(value.filename) ||
      typeof value.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.sha256) ||
      ![value.width, value.height].every((n) => Number.isSafeInteger(n) && n > 0 && n <= 2147483647))
    throw new TypeError('Invalid uploaded picture replacement')
  return value
}
function occurrencePictureReplacement(definition, instance) {
  return instance.overrides.components?.[definition.content.pictureDocument.componentId]
    ?.picture?.replacement ?? null
}
function pictureAsset(definition, instance) {
  const replacement = occurrencePictureReplacement(definition, instance)
  if (!replacement) return definition.content.media
  const { filename, sha256, width, height } = pictureReplacement(replacement)
  return { src: `/uploads/${filename}`, sha256, width, height }
}
function samePictureReplacement(a, b) {
  return a === null || b === null ? a === b :
    ['kind', 'presentationId', 'filename', 'sha256', 'width', 'height'].every((key) => a[key] === b[key])
}
module.exports = { pictureReplacement, occurrencePictureReplacement, pictureAsset, samePictureReplacement }
