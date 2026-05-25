function mediaWarningMessage(warn) {
  if (warn.code === 'image-mime-hint-mismatch') {
    return `Image MIME hint ${warn.hinted || 'unknown'} differed from detected ${warn.detected || 'unknown'}`
  }
  if (warn.code === 'image-format-preserved-with-limited-browser-support') {
    return `Image format ${warn.detected || 'unknown'} was preserved with limited browser support`
  }
  if (warn.code === 'image-detect-failed') return 'Image media type could not be detected'
  if (warn.code === 'media-too-large') return 'Media file exceeds import size limit'
  if (warn.code === 'media-ref-missing') return 'Referenced media file was not found in PPTX archive'
  if (warn.code === 'media-extension-rejected') return 'Media file extension is not allowed'
  if (warn.code === 'media-magic-mismatch') return 'Media file bytes did not match the declared extension'
  if (warn.code === 'media-external-url-blocked') return 'External media URL was blocked during import'
  return 'Media import warning'
}

function pushMediaWarning(context, warn) {
  if (!warn) return
  context.warnings.push({
    slideIndex: context.slideIndex,
    type: warn.code || 'media-warning',
    message: mediaWarningMessage(warn),
    ...warn,
  })
}

module.exports = {
  mediaWarningMessage,
  pushMediaWarning,
}
