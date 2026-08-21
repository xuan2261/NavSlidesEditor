'use strict'

function disabledImageSize() {
  throw new Error(
    'Automatic image dimension parsing is disabled; provide explicit image dimensions instead.'
  )
}

module.exports = disabledImageSize
module.exports.default = disabledImageSize
module.exports.imageSize = disabledImageSize
module.exports.sizeOf = disabledImageSize
