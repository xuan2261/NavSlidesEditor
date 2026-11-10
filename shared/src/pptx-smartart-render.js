const { normalizeSmartArtDocument } = require('./pptx-smartart-document')
const { evaluateSmartArtLayout } = require('./pptx-smartart-layout')
const { freezeLayout } = require('./pptx-smartart-layout-declarations')
const { smartArtNodeStyle, styleFailure } = require('./pptx-smartart-style')
const { paint } = require('./pptx-table-render-paint')
const { cellText } = require('./pptx-table-render-text')
const { escapePlainText } = require('./content-safety')

// Graph topology is not connector routing. No cached drawing, guessed paint,
// EMU conversion, text fitting, equal sizing or substitute algorithm lives here.
function createSmartArtRenderModel(input, bounds) {
  const document = normalizeSmartArtDocument(input)
  for (const property of document.sourceProperties ?? [])
    styleFailure('source property style rendering is not implemented', property.tree.source,
      property.tree.definitionId ?? document.componentId)
  const layout = evaluateSmartArtLayout(document, bounds)
  const points = new Map(document.points.map((p) => [p.componentId, p]))
  return freezeLayout({
    ...layout,
    bounds: { ...bounds },
    nodes: layout.placements.map((placement) => ({
      ...placement,
      point: points.get(placement.componentId),
      textDocument: points.get(placement.componentId).textDocument ?? null,
    })),
    connections: document.connections,
  })
}

// Relative constraints are dimensionless: evaluating them against the authored
// frame EMUs gives physical geometry without a native-unit assumption. Literal
// zero is unit invariant. Nonzero literals need a separately captured oracle.
function createSmartArtPhysicalModel(input, bounds) {
  const document = normalizeSmartArtDocument(input)
  for (const d of document.layout?.declarations ?? [])
    if (d.type === 'constr' && d.attributes.val !== undefined && d.attributes.val !== 0)
      styleFailure('physical layout literal unit calibration is missing', d.source, d.componentId)
  const model = createSmartArtRenderModel(document, bounds)
  return freezeLayout({ ...model, coordinateUnit: 'emu',
    nodes: model.nodes.map((node) => ({ ...node, style: smartArtNodeStyle(document, node) })) })
}
function renderSmartArtSvg(document, bounds, options = {}) {
  const model = createSmartArtPhysicalModel(document, bounds)
  const nodes = model.nodes.map((node) => {
    const id = escapePlainText(node.componentId), style = node.style
    if (!['rect', 'ellipse', 'none'].includes(node.shapeType))
      styleFailure('missing or unsupported source geometry', node.source, node.componentId)
    const w = node.width / 9525, h = node.height / 9525
    const fill = paint(style.fill, {}, node.componentId, 'style.fill')
    const line = paint(style.line, {}, node.componentId, 'style.line')
    const join = style.lineJoin
    const attrs = ` fill="${fill.value}" fill-opacity="${fill.alpha}" stroke="${line.value}" stroke-opacity="${line.alpha}" stroke-width="${style.lineWidthEmu / 9525}"` +
      (join ? ` stroke-linejoin="${join.kind === 'miter' && join.limit < 100000 ? 'bevel' : join.kind}"` +
        (join.kind === 'miter' && join.limit >= 100000 ? ` stroke-miterlimit="${join.limit / 100000}"` : '') : '')
    const shape = node.shapeType === 'none' ? '' : node.shapeType === 'ellipse'
      ? `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}"${attrs}/>`
      : `<rect width="${w}" height="${h}"${attrs}/>`
    let text = ''
    if (node.textDocument) {
      if (node.shapeType === 'ellipse')
        styleFailure('ellipse preset text rectangle is not implemented', node.source, node.componentId)
      if (!options.measurement || !options.fontProfile || !options.fontFamilies)
        styleFailure('verified physical font runtime is missing', style.source, node.componentId)
      try {
        text = cellText({ componentId: node.componentId, properties: {}, textDocument: node.textDocument },
          node.width, node.height, { ...options, textDefaults: style.textDefaults })
      } catch (error) {
        styleFailure(error.message, style.source, error.componentId ?? node.componentId)
      }
    }
    return `<g data-smartart-point="${id}" data-smartart-model="${escapePlainText(node.modelId)}" data-smartart-shape="${node.shapeType}" transform="translate(${(node.x - bounds.x) / 9525} ${(node.y - bounds.y) / 9525})">${shape}${text}</g>`
  }).join('')
  // parOf/presOf are semantic graph edges, not drawing commands. A source conn
  // algorithm is rejected by the interpreter, never guessed from these edges.
  return `<svg xmlns="http://www.w3.org/2000/svg" role="group" aria-label="SmartArt" data-smartart-root="${escapePlainText(model.graphComponentId)}" data-smartart-layout="${model.layoutStatus}" viewBox="0 0 ${bounds.width / 9525} ${bounds.height / 9525}" width="100%" height="100%" overflow="visible">${nodes}</svg>`
}
module.exports = { createSmartArtRenderModel, createSmartArtPhysicalModel, renderSmartArtSvg }
