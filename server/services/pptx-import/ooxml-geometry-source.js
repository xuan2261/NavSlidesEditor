const { readFileSync } = require('node:fs')
const path = require('node:path')
const { parseXml, attr, decodeXml, A_URIS } = require('./ooxml-text-run-xml')
const {
  normalizeGeometryDocument,
  normalizeGeometryTemplate,
} = require('../../../shared/src/pptx-geometry-document')
let presets
const fail = (detail) => {
  throw new TypeError(`Unsupported DrawingML geometry source: ${detail}`)
}
const value = (node, key) => (node ? decodeXml(attr(node, key) ?? '') : '')
function children(node, names) {
  if (node.children.some((entry) => !A_URIS.has(entry.uri) || !names.includes(entry.local)))
    fail('element')
  return node.children
}
function attributes(node, names) {
  if (node.attrs.some((entry) => !/^xmlns(?::|$)/.test(entry.name) && !names.includes(entry.name)))
    fail('attribute')
}
function single(node, local) {
  const found = node.children.filter((entry) => entry.local === local && A_URIS.has(entry.uri))
  if (found.length > 1) fail(`duplicate ${local}`)
  return found[0]
}
function guides(node) {
  if (!node) return []
  attributes(node, [])
  return children(node, ['gd']).map((entry) => {
    attributes(entry, ['name', 'fmla'])
    children(entry, [])
    return { name: value(entry, 'name'), formula: value(entry, 'fmla') }
  })
}
function sourceBody(node, { componentId, width, height, componentIdFor, template }) {
  children(node, ['avLst', 'gdLst', 'ahLst', 'cxnLst', 'rect', 'pathLst'])
  const position = (entry) => {
    attributes(entry, ['x', 'y'])
    children(entry, [])
    return { x: value(entry, 'x'), y: value(entry, 'y') }
  }
  const list = (local, names) => {
    const entry = single(node, local)
    if (!entry) return []
    attributes(entry, [])
    return children(entry, names)
  }
  const document = {
    schemaVersion: template === true ? 2 : 1,
    componentId,
    kind: 'custom',
    ...(template === true ? {} : { width, height }),
    adjustments: guides(single(node, 'avLst')),
    guides: guides(single(node, 'gdLst')),
    handles: list('ahLst', ['ahXY', 'ahPolar']).map((entry, index) => {
      const keys =
        entry.local === 'ahXY'
          ? ['gdRefX', 'gdRefY', 'minX', 'maxX', 'minY', 'maxY']
          : ['gdRefR', 'gdRefAng', 'minR', 'maxR', 'minAng', 'maxAng']
      attributes(entry, keys)
      children(entry, ['pos'])
      const pos = single(entry, 'pos')
      if (!pos) fail('handle position')
      return {
        componentId: `${componentId}:handle:${index}`,
        kind: entry.local === 'ahXY' ? 'xy' : 'polar',
        position: position(pos),
        ...Object.fromEntries(
          keys.filter((key) => attr(entry, key) !== null).map((key) => [key, value(entry, key)])
        ),
      }
    }),
    connections: list('cxnLst', ['cxn']).map((entry, index) => {
      attributes(entry, ['ang'])
      children(entry, ['pos'])
      const pos = single(entry, 'pos')
      if (!pos) fail('connection position')
      return {
        componentId: `${componentId}:site:${index}`,
        angle: value(entry, 'ang'),
        position: position(pos),
      }
    }),
    paths: list('pathLst', ['path']).map((entry, pathIndex) => {
      attributes(entry, ['w', 'h', 'fill', 'stroke', 'extrusionOk'])
      const flag = (key) => {
        const raw = value(entry, key)
        if (!['0', '1', 'false', 'true'].includes(raw)) fail('path boolean')
        return ['1', 'true'].includes(raw)
      }
      return {
        componentId: `${componentId}:path:${pathIndex}`,
        ...Object.fromEntries(
          ['w', 'h']
            .filter((key) => attr(entry, key) !== null)
            .map((key) => [key === 'w' ? 'width' : 'height', Number(value(entry, key))])
        ),
        ...(attr(entry, 'fill') !== null ? { fill: value(entry, 'fill') } : {}),
        ...Object.fromEntries(
          ['stroke', 'extrusionOk']
            .filter((key) => attr(entry, key) !== null)
            .map((key) => [key, flag(key)])
        ),
        commands: children(entry, [
          'moveTo',
          'lnTo',
          'quadBezTo',
          'cubicBezTo',
          'arcTo',
          'close',
        ]).map((command, commandIndex) => {
          if (command.local === 'arcTo') {
            const keys = ['wR', 'hR', 'stAng', 'swAng']
            attributes(command, keys)
            children(command, [])
            return {
              kind: 'arcTo',
              ...Object.fromEntries(keys.map((key) => [key, value(command, key)])),
            }
          }
          attributes(command, [])
          if (command.local === 'close') {
            children(command, [])
            return { kind: 'close' }
          }
          return {
            kind: command.local,
            points: children(command, ['pt']).map((point, pointIndex) => ({
              componentId:
                componentIdFor?.(point) ??
                `${componentId}:path:${pathIndex}:point:${commandIndex}:${pointIndex}`,
              ...position(point),
            })),
          }
        }),
      }
    }),
  }
  const rect = single(node, 'rect')
  if (rect) {
    attributes(rect, ['l', 't', 'r', 'b'])
    children(rect, [])
    document.textRect = Object.fromEntries(
      ['l', 't', 'r', 'b'].map((key) => [key, value(rect, key)])
    )
  }
  return document
}
function readGeometrySource(node, options) {
  if (options.template === true && ['width', 'height'].some((key) => Object.hasOwn(options, key)))
    fail('template dimensions')
  const normalize =
    options.template === true ? normalizeGeometryTemplate : normalizeGeometryDocument
  if (!node || !A_URIS.has(node.uri)) fail('namespace')
  if (node.local === 'custGeom') {
    attributes(node, [])
    return normalize(sourceBody(node, options))
  }
  if (node.local !== 'prstGeom') fail('kind')
  attributes(node, ['prst'])
  children(node, ['avLst'])
  if (!presets) {
    const root = parseXml(
      readFileSync(
        path.join(__dirname, 'resources/drawingml-presets/drawingml-preset-shapes.xml'),
        'utf8'
      )
    )[0]
    presets = new Map(root.children.map((entry) => [entry.local, entry]))
  }
  const preset = value(node, 'prst'),
    body = presets.get(preset)
  if (!body) fail(`preset ${preset}`)
  const document = { ...sourceBody(body, options), kind: 'preset', preset }
  // POI's pinned circular-arrow definitions carry eight extra trailing zeros.
  // Its evaluator consumes only the first three +- operands. Normalize only
  // these exact trusted-catalog records; authored input keeps strict arity.
  if (['circularArrow', 'leftCircularArrow', 'leftRightCircularArrow'].includes(preset)) {
    const errata = {
      xB: '+- xH 0 dxB 0',
      yB: '+- yH 0 dyB 0',
      xJ: '+- xI 0 dxJ 0',
      yJ: '+- yI 0 dyJ 0',
    }
    for (const guide of document.guides)
      if (Object.hasOwn(errata, guide.name) && guide.formula === errata[guide.name])
        guide.formula = guide.formula.slice(0, -2)
  }
  const overrides = guides(single(node, 'avLst')),
    seen = new Set()
  for (const override of overrides) {
    const index = document.adjustments.findIndex((entry) => entry.name === override.name)
    if (index < 0 || seen.has(override.name)) fail('preset adjustment')
    seen.add(override.name)
    document.adjustments[index] = override
  }
  return normalize(document)
}
module.exports = { readGeometrySource }
