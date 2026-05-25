const { sanitizeHtml } = require('../sanitize')
const { extractShadow } = require('./utils-base')
const { mapAudio, mapMath, mapVideo } = require('./map-media')
const { mapPptxOutput } = require('./map-presentation')

module.exports = {
  mapPptxOutput,
  sanitizeHtml,
  mapVideo,
  mapAudio,
  extractShadow,
  mapMath,
}
