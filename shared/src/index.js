const shapeUtils = require('./shapeUtils.js')
const htmlGenerator = require('./htmlGenerator.js')
const slideNotes = require('./slideNotes.js')
const {
  TEXT_COLORS,
  BG_COLORS,
  GRADIENT_PRESETS,
  isLightColor,
} = require('./shared-toolbar-text-bg-color-palette-gradient-presets-config.js')

module.exports = {
  ...shapeUtils,
  ...htmlGenerator,
  ...slideNotes,
  TEXT_COLORS,
  BG_COLORS,
  GRADIENT_PRESETS,
  isLightColor,
}
