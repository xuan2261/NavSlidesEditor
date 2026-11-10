const { layoutOmmlDocument } = require('./pptx-omml-layout')

const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]
  )
function renderOmmlDocument(document, options) {
  const result = layoutOmmlDocument(document, options)
  function primitive(p) {
    if (p.kind === 'line')
      return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${escape(p.color)}" stroke-width="${p.strokeWidth}"/>`
    const s = p.style
    const family = options.resolveFontFamily ? options.resolveFontFamily({ ...s }) : s.fontFamily
    return `<text transform="translate(${p.x} ${p.y}) scale(${p.scaleX ?? 1} ${p.scaleY ?? 1})" font-family="${escape(family)}" font-size="${s.fontSize}" font-weight="${s.bold ? 'bold' : 'normal'}" font-style="${s.italic ? 'italic' : 'normal'}" fill="${escape(s.color)}" xml:space="preserve">${escape(p.text)}</text>`
  }
  function render(box) {
    if (box.hidden) return ''
    return `<g data-component-id="${escape(box.componentId)}" data-omml-type="${escape(box.type)}" transform="translate(${box.x} ${box.y})">${box.primitives.map(primitive).join('')}${box.children.map(render).join('')}</g>`
  }
  const { width, ascent, descent } = result.layout
  // Empty equations keep genuine zero extents; there is no invented placeholder.
  result.svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${ascent + descent}" viewBox="0 ${-ascent} ${width} ${ascent + descent}">${render(result.layout)}</svg>`
  return result
}
module.exports = { renderOmmlDocument }
