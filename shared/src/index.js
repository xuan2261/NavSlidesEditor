const shapeUtils = require('./shapeUtils.js')
const htmlGenerator = require('./htmlGenerator.js')
const slideNotes = require('./slideNotes.js')

module.exports = {
  ...shapeUtils,
  ...htmlGenerator,
  ...slideNotes,
}
