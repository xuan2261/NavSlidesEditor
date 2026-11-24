const { shapeLabelSvgString } = require('./pptx-shape-label.js')
const { escapePlainText } = require('./content-safety.js')

// Textboxes and shape labels paint the same canonical body. Only shapes use a
// geometry text rectangle; native txBox text occupies its own local frame.
function textBoxSvgString(element, options = {}) {
  const width = Number(element.width), height = Number(element.height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new TypeError('Canonical textbox requires a finite positive local frame')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${escapePlainText(String(width))} ${escapePlainText(String(height))}" style="display:block;overflow:visible;">${shapeLabelSvgString({ ...element, pptxGeometry: undefined }, options)}</svg>`
}
module.exports = { textBoxSvgString }
