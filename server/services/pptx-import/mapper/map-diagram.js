const uuidv4 = () => require('node:crypto').randomUUID()
const { arrowMarker, colorValue } = require('./utils-color')
const { buildPptxTextImportMeta, extractTextMetadata, plainText } = require('./utils-text')
const { scaleLength, shapeName } = require('./utils-base')
const { readCoord, readNumber } = require('../geometry')
const { sanitizeHtml } = require('../sanitize')

function isConnectorNode(node) {
  const shapeType = String(node.shapType || '').toLowerCase()
  return shapeType.includes('line') || shapeType.includes('connector') || shapeType.includes('straight')
}

function mapDiagramNode(node, textList, index, maxNodes, element, context) {
  const boxWidth = readNumber(element.width, 300, 0)
  const boxHeight = readNumber(element.height, 200, 0)
  const diagramLeft = readCoord(element.left, element.x, 0)
  const diagramTop = readCoord(element.top, element.y, 0)
  const displayTextSource = textList[index]?.text || node.text || node.content || ''
  const metadataTextSource = node.content || node.text || textList[index]?.text || ''
  const nodeHtml = sanitizeHtml(metadataTextSource)
  const textMetadata = extractTextMetadata(nodeHtml, node, context.scale)
  const sanitizedText = plainText(displayTextSource)
  const nodeX = diagramLeft + readCoord(node.left, node.x, (index * boxWidth) / maxNodes)
  const nodeY = diagramTop + readCoord(node.top, node.y, 0)
  const width = Math.max(1, Math.round(readNumber(node.width, boxWidth / maxNodes, 0) * context.scale.x))
  const height = Math.max(1, Math.round(readNumber(node.height, boxHeight / 3, 0) * context.scale.y))

  context.zIndex += 1
  const mapped = {
    id: uuidv4(),
    x: Math.round(nodeX * context.scale.x),
    y: Math.round(nodeY * context.scale.y),
    width,
    height,
    rotation: readNumber(node.rotate, 0),
    opacity: typeof node.opacity === 'number' ? node.opacity : 1,
    zIndex: context.zIndex,
    type: 'shape',
    shape: shapeName(node.shape || node.shapType || 'rect'),
    fill: colorValue(node.fill, '#e5e7eb'),
    stroke: colorValue(node.borderColor, 'none'),
    strokeWidth: scaleLength(node.borderWidth, context.scale.x),
    text: sanitizedText,
    textColor: '#111827',
    ...textMetadata,
  }
  // Diagram node boxes are already scaled; give text the same fit-meta clamp
  // that text/shape elements get so long labels don't overflow the node.
  if (sanitizedText) {
    mapped._pptxImportMeta = buildPptxTextImportMeta({ width, height }, mapped, { textLength: sanitizedText.length })
  }
  return mapped
}

function mapDiagramConnector(node, element, context) {
  const diagramLeft = readCoord(element.left, element.x, 0)
  const diagramTop = readCoord(element.top, element.y, 0)
  const cx1 = node.x1 ?? node.left ?? 0
  const cy1 = node.y1 ?? node.top ?? 0
  const cx2 = node.x2 ?? (node.left ?? 0) + (node.width ?? 100)
  const cy2 = node.y2 ?? (node.top ?? 0) + (node.height ?? 10)
  const normType = String(node.shapType || '').toLowerCase()

  context.zIndex += 1
  return {
    id: uuidv4(),
    x1: Math.round((diagramLeft + cx1) * context.scale.x),
    y1: Math.round((diagramTop + cy1) * context.scale.y),
    x2: Math.round((diagramLeft + cx2) * context.scale.x),
    y2: Math.round((diagramTop + cy2) * context.scale.y),
    rotation: 0,
    opacity: typeof node.opacity === 'number' ? node.opacity : 1,
    zIndex: context.zIndex,
    type: 'line',
    stroke: colorValue(node.borderColor, '#6b7280'),
    strokeWidth: scaleLength(node.borderWidth, context.scale.x, 1),
    dashArray: node.borderStrokeDasharray || undefined,
    arrowStart: normType.includes('triangle') || normType.includes('diamond')
      ? arrowMarker(normType.replace(/end|start/gi, ''))
      : 'none',
    arrowEnd: arrowMarker(normType),
  }
}

function flattenDiagramElement(element, context) {
  const results = []
  const nodes = element.elements || []
  const textList = element.textList || []

  if (!nodes.length) {
    context.warnings.push({ slideIndex: context.slideIndex, type: 'diagram-empty', message: 'Empty diagram' })
    return []
  }

  const maxNodes = Math.min(nodes.length, 50)
  if (nodes.length > 50) {
    context.warnings.push({ slideIndex: context.slideIndex, type: 'diagram-truncated', message: `Diagram has ${nodes.length} nodes, using first 50` })
  }

  for (let i = 0; i < maxNodes; i++) {
    const node = nodes[i]
    if (!isConnectorNode(node)) results.push(mapDiagramNode(node, textList, i, maxNodes, element, context))
  }

  for (let i = 0; i < maxNodes; i++) {
    const node = nodes[i]
    if (isConnectorNode(node)) results.push(mapDiagramConnector(node, element, context))
  }

  return results
}

module.exports = {
  flattenDiagramElement,
  isConnectorNode,
}
