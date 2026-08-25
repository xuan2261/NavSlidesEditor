/**
 * Pure, dependency-free geometry for bounded same-slide line attachments.
 * Coordinates returned for a line are local to that line's wrapper.
 */
const CONNECTOR_ANCHORS = Object.freeze(['center', 'n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'])
const CONNECTOR_ANCHOR_SET = new Set(CONNECTOR_ANCHORS)

function finite(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function lineFallbackCoordinates(line = {}) {
  const width = finite(line.width, 0)
  const height = finite(line.height, 0)
  return {
    x1: finite(line.x1, 0),
    y1: finite(line.y1, height / 2),
    x2: finite(line.x2, width),
    y2: finite(line.y2, height / 2),
  }
}

function normalizeConnectionEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== 'object') return null
  const targetId = typeof endpoint.targetId === 'string' ? endpoint.targetId.trim() : ''
  if (!targetId || !CONNECTOR_ANCHOR_SET.has(endpoint.anchor)) return null
  return { targetId, anchor: endpoint.anchor }
}

function normalizeLineConnections(connections) {
  if (!connections || typeof connections !== 'object' || Array.isArray(connections)) return undefined
  const start = normalizeConnectionEndpoint(connections.start)
  const end = normalizeConnectionEndpoint(connections.end)
  return start || end ? { ...(start ? { start } : {}), ...(end ? { end } : {}) } : undefined
}

function normalizeLineElement(line) {
  if (!line || line.type !== 'line') return line
  const coordinates = lineFallbackCoordinates(line)
  const connections = normalizeLineConnections(line.connections)
  const normalized = { ...line, ...coordinates }
  if (connections) normalized.connections = connections
  else delete normalized.connections
  return normalized
}

function sameEndpoint(a, b) {
  return a?.targetId === b?.targetId && a?.anchor === b?.anchor
}

function sameConnections(a, b) {
  return sameEndpoint(a?.start, b?.start) && sameEndpoint(a?.end, b?.end)
}

function isValidTarget(target, lineId) {
  return Boolean(
    target &&
      target.id !== lineId &&
      target.type !== 'line' &&
      Number.isFinite(Number(target.x)) &&
      Number.isFinite(Number(target.y)) &&
      Number.isFinite(Number(target.width)) &&
      Number.isFinite(Number(target.height))
  )
}

function anchorFractions(anchor) {
  switch (anchor) {
    case 'n': return [0.5, 0]
    case 'ne': return [1, 0]
    case 'e': return [1, 0.5]
    case 'se': return [1, 1]
    case 's': return [0.5, 1]
    case 'sw': return [0, 1]
    case 'w': return [0, 0.5]
    case 'nw': return [0, 0]
    default: return [0.5, 0.5]
  }
}

function getConnectorAnchorPoint(element, anchor) {
  if (!isValidTarget(element)) return null
  const x = Number(element.x)
  const y = Number(element.y)
  const width = Number(element.width)
  const height = Number(element.height)
  const [fractionX, fractionY] = anchorFractions(anchor)
  const pointX = x + width * fractionX
  const pointY = y + height * fractionY
  const radians = (finite(element.rotation, 0) * Math.PI) / 180
  if (radians === 0) return { x: pointX, y: pointY }
  const centerX = x + width / 2
  const centerY = y + height / 2
  const dx = pointX - centerX
  const dy = pointY - centerY
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return { x: centerX + dx * cos - dy * sin, y: centerY + dx * sin + dy * cos }
}

/**
 * Resolve every line in one indexed pass. `patches` only contains endpoints whose
 * persisted fallback needs to follow a currently available target. A deleted
 * target is explicitly detached while preserving its last finite fallback.
 */
function resolveConnectorGeometry(elements, { deletedTargetIds = [] } = {}) {
  const items = Array.isArray(elements) ? elements : []
  const index = new Map()
  for (const element of items) {
    if (element?.id != null) index.set(element.id, element)
  }
  const deleted = new Set(deletedTargetIds)
  const patches = []
  const effectiveLines = new Map()

  for (const sourceLine of items) {
    if (sourceLine?.type !== 'line') continue
    const line = normalizeLineElement(sourceLine)
    const fallback = lineFallbackCoordinates(line)
    const connections = line.connections
    let nextConnections = connections
    let changedConnections = false
    const effective = { ...fallback }

    for (const endpointName of ['start', 'end']) {
      const endpoint = connections?.[endpointName]
      if (!endpoint) continue
      if (deleted.has(endpoint.targetId)) {
        const { [endpointName]: _removed, ...remaining } = nextConnections || {}
        nextConnections = Object.keys(remaining).length ? remaining : undefined
        changedConnections = true
        continue
      }
      const target = index.get(endpoint.targetId)
      if (!isValidTarget(target, line.id)) continue
      const point = getConnectorAnchorPoint(target, endpoint.anchor)
      if (!point) continue
      if (endpointName === 'start') {
        effective.x1 = point.x - finite(line.x, 0)
        effective.y1 = point.y - finite(line.y, 0)
      } else {
        effective.x2 = point.x - finite(line.x, 0)
        effective.y2 = point.y - finite(line.y, 0)
      }
    }

    effectiveLines.set(line.id, { ...line, ...effective })
    const patch = { id: line.id }
    for (const key of ['x1', 'y1', 'x2', 'y2']) {
      if (line[key] !== effective[key]) patch[key] = effective[key]
    }
    if (changedConnections && !sameConnections(connections, nextConnections)) {
      patch.connections = nextConnections
    }
    if (Object.keys(patch).length > 1) patches.push(patch)
  }

  return { effectiveLines, patches, elementIndex: index }
}

/** Normalize malformed metadata and reject unavailable, self, and line targets on load. */
function normalizeSlideConnectorConnections(elements) {
  const normalized = (Array.isArray(elements) ? elements : []).map(normalizeLineElement)
  const index = new Map(normalized.filter((element) => element?.id != null).map((element) => [element.id, element]))
  const valid = normalized.map((element) => {
    if (element?.type !== 'line' || !element.connections) return element
    const connections = {}
    for (const endpointName of ['start', 'end']) {
      const endpoint = element.connections[endpointName]
      if (endpoint && isValidTarget(index.get(endpoint.targetId), element.id)) connections[endpointName] = endpoint
    }
    if (sameConnections(element.connections, connections)) return element
    const next = { ...element }
    if (Object.keys(connections).length) next.connections = connections
    else delete next.connections
    return next
  })
  const { patches } = resolveConnectorGeometry(valid)
  if (!patches.length) return valid
  const patchesById = new Map(patches.map((patch) => [patch.id, patch]))
  return valid.map((element) => (patchesById.has(element.id) ? { ...element, ...patchesById.get(element.id) } : element))
}

module.exports = {
  CONNECTOR_ANCHORS,
  getConnectorAnchorPoint,
  lineFallbackCoordinates,
  normalizeLineConnections,
  normalizeLineElement,
  normalizeSlideConnectorConnections,
  resolveConnectorGeometry,
}
