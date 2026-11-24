function effectiveSlideIdentity(slide, horizontal, vertical = 0) {
  return slide.id || `position:${horizontal}:${vertical}`
}
function gameInstanceKey(identity) {
  if (!identity) return null
  const { effectiveSlideId, elementId } = identity
  if (
    typeof effectiveSlideId !== 'string' ||
    !effectiveSlideId ||
    typeof elementId !== 'string' ||
    !elementId
  )
    return null
  return JSON.stringify([effectiveSlideId, elementId])
}
module.exports = { effectiveSlideIdentity, gameInstanceKey }
