const { parseXml, decodeXml } = require('./ooxml-text-run-xml')
const { PARAMETERS, normalizePrimitive, primitiveCommands } = require('../../../shared/src/pptx-vector-primitives')
const { svgNumbers, svgTransform } = require('../../../shared/src/pptx-vector-transform')
const MAX_PATH_LENGTH = 1_048_576
const MAX_PATH_COMMANDS = 16_384
const MAX_COORDINATE = 1e12
const COMMANDS = Object.freeze({ M: 2, L: 2, C: 6, Q: 4, A: 7 })
const fail = () => { throw new TypeError('Invalid SVG path data') }

function tokenizePath(source) {
  if (typeof source !== 'string' || source.length === 0 || source.length > MAX_PATH_LENGTH) fail()
  const tokens = []
  let index = 0
  let previousWasNumber = false
  while (index < source.length) {
    const gap = /^[\s,]*/u.exec(source.slice(index))[0]
    const hasComma = gap.includes(',')
    if (hasComma && (gap.match(/,/gu).length !== 1 || !previousWasNumber)) fail()
    index += gap.length
    if (index === source.length) {
      if (hasComma) fail()
      break
    }
    const command = /^[A-Za-z]/u.exec(source.slice(index))
    if (command) {
      if (hasComma) fail()
      tokens.push(command[0])
      index += 1
      previousWasNumber = false
    } else {
      if (previousWasNumber && gap.length === 0 && !/^[+-]/u.test(source[index])) fail()
      const number = /^[+-]?(?:(?:\d+\.?(?:\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?/u.exec(source.slice(index))
      if (!number) fail()
      const value = Number(number[0])
      if (!Number.isFinite(value) || Math.abs(value) > MAX_COORDINATE) fail()
      tokens.push(value)
      index += number[0].length
      previousWasNumber = true
    }
    if (tokens.length > MAX_PATH_COMMANDS * 7) fail()
  }
  return tokens
}

function circularArc(current, values, relative) {
  const [rawRadiusX, rawRadiusY, rotation, largeArc, sweep, dx, dy] = values
  const radiusX = Math.abs(rawRadiusX)
  const radiusY = Math.abs(rawRadiusY)
  if (![0, 1].includes(largeArc) || ![0, 1].includes(sweep) || rotation % 360 !== 0)
    fail()
  const end = { x: relative ? current.x + dx : dx, y: relative ? current.y + dy : dy }
  if ([end.x, end.y].some((value) => !Number.isFinite(value) || Math.abs(value) > MAX_COORDINATE)) fail()
  if (radiusX === 0 || radiusY === 0)
    return { end, command: { kind: 'lnTo', points: [end] } }
  if (radiusX !== radiusY) fail()
  if (current.x === end.x && current.y === end.y) return { end, command: null }
  let radius = Math.abs(rawRadiusX)
  const halfX = (current.x - end.x) / 2
  const halfY = (current.y - end.y) / 2
  const scale = Math.hypot(halfX, halfY) / radius
  if (scale > 1) radius *= scale
  if (radius > MAX_COORDINATE) fail()
  const chordSquared = halfX * halfX + halfY * halfY
  const denominator = radius * radius * chordSquared
  const numerator = Math.max(0, radius ** 4 - radius * radius * chordSquared)
  const sign = largeArc === sweep ? -1 : 1
  const factor = denominator === 0 ? 0 : sign * Math.sqrt(numerator / denominator)
  const center = {
    x: (current.x + end.x) / 2 + factor * halfY,
    y: (current.y + end.y) / 2 - factor * halfX,
  }
  const startAngle = Math.atan2(current.y - center.y, current.x - center.x)
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x)
  let sweepAngle = endAngle - startAngle
  if (sweep && sweepAngle < 0) sweepAngle += 2 * Math.PI
  if (!sweep && sweepAngle > 0) sweepAngle -= 2 * Math.PI
  if (largeArc && Math.abs(sweepAngle) < Math.PI) sweepAngle += sweep ? 2 * Math.PI : -2 * Math.PI
  if (!largeArc && Math.abs(sweepAngle) > Math.PI) sweepAngle += sweep ? -2 * Math.PI : 2 * Math.PI
  const start = Math.round((startAngle * 180 * 60000) / Math.PI)
  const span = Math.round((sweepAngle * 180 * 60000) / Math.PI)
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(span) || Math.abs(span) > 21_600_000)
    fail()
  return {
    end,
    command: { kind: 'arcTo', wR: radius, hR: radius, stAng: start, swAng: span },
  }
}

function parseSvgPathData(source) {
  const tokens = tokenizePath(source)
  const commands = []
  let index = 0
  let active = null
  let x = 0
  let y = 0
  let subpathX = 0
  let subpathY = 0
  let moved = false
  while (index < tokens.length) {
    if (typeof tokens[index] === 'string') {
      active = tokens[index++]
      if (!'MLCQAZmlcqaz'.includes(active)) fail()
      if (active === 'Z' || active === 'z') {
        if (!moved) fail()
        commands.push({ kind: 'close' })
        if (commands.length > MAX_PATH_COMMANDS) fail()
        x = subpathX
        y = subpathY
        active = null
        continue
      }
    } else if (!active) fail()
    const upper = active.toUpperCase()
    const arity = COMMANDS[upper]
    if (!arity) fail()
    const values = []
    while (index < tokens.length && typeof tokens[index] === 'number') values.push(tokens[index++])
    if (!values.length || values.length % arity !== 0) fail()
    for (let offset = 0; offset < values.length; offset += arity) {
      const relative = active !== upper
      const point = (dx, dy) => {
        const next = { x: relative ? x + dx : dx, y: relative ? y + dy : dy }
        if ([next.x, next.y].some((value) => !Number.isFinite(value) || Math.abs(value) > MAX_COORDINATE)) fail()
        return next
      }
      if (upper === 'M' || upper === 'L') {
        const next = point(values[offset], values[offset + 1])
        if (upper === 'M' && offset === 0) {
          commands.push({ kind: 'moveTo', points: [next] })
          moved = true
          subpathX = next.x
          subpathY = next.y
        } else commands.push({ kind: 'lnTo', points: [next] })
        x = next.x
        y = next.y
      } else if (upper === 'Q') {
        if (!moved) fail()
        const control = point(values[offset], values[offset + 1])
        const end = point(values[offset + 2], values[offset + 3])
        commands.push({ kind: 'quadBezTo', points: [control, end] })
        x = end.x
        y = end.y
      } else if (upper === 'C') {
        if (!moved) fail()
        const control1 = point(values[offset], values[offset + 1])
        const control2 = point(values[offset + 2], values[offset + 3])
        const end = point(values[offset + 4], values[offset + 5])
        commands.push({ kind: 'cubicBezTo', points: [control1, control2, end] })
        x = end.x
        y = end.y
      } else if (upper === 'A') {
        if (!moved) fail()
        const arc = circularArc({ x, y }, values.slice(offset, offset + 7), relative)
        if (arc.command) commands.push(arc.command)
        x = arc.end.x
        y = arc.end.y
      }
      if (commands.length > MAX_PATH_COMMANDS) fail()
    }
    if (upper === 'M') active = active === 'm' ? 'l' : 'L'
  }
  if (!commands.length || commands[0].kind !== 'moveTo') fail()
  return commands
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const MAX_SVG_BYTES = 1_048_576
const MAX_SVG_PATHS = 256
const NUMBER = /^[+-]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:[eE][+-]?\d+)?$/u

function decodedAttribute(node, name, required = false) {
  const matches = node.attrs.filter((entry) => entry.name === name)
  if (matches.length > 1 || (required && matches.length !== 1)) throw new TypeError('Invalid SVG source attribute')
  if (!matches.length) return null
  const value = decodeXml(matches[0].value)
  if (value === null) throw new TypeError('Invalid SVG source entity')
  return value
}

function numericAttribute(node, name, fallback) {
  const raw = decodedAttribute(node, name)
  if (raw === null) return fallback
  if (!NUMBER.test(raw)) throw new TypeError('Invalid SVG source number')
  const value = Number(raw)
  if (!Number.isFinite(value) || Math.abs(value) > MAX_COORDINATE) throw new TypeError('Invalid SVG source number')
  return value
}

function paintAttribute(node, name, fallback) {
  const raw = decodedAttribute(node, name)
  if (raw === null) return fallback
  if (raw === 'none') return raw
  if (/^#[\da-f]{3}$/iu.test(raw)) return `#${[...raw.slice(1)].map((digit) => digit + digit).join('').toLowerCase()}`
  if (/^#[\da-f]{6}$/iu.test(raw)) return raw.toLowerCase()
  throw new TypeError('Unsupported SVG source paint')
}

function preflightSvgXml(xml) {
  let depth = 0
  let elements = 0
  for (let index = 0; index < xml.length;) {
    const start = xml.indexOf('<', index)
    if (start < 0) break
    if (xml.startsWith('<?', start)) {
      const end = xml.indexOf('?>', start + 2)
      if (end < 0) throw new TypeError('Unterminated SVG processing instruction')
      index = end + 2
      continue
    }
    if (xml.startsWith('<!', start)) throw new TypeError('Unsupported SVG declaration')
    let quote = ''
    let end = start + 1
    for (; end < xml.length; end += 1) {
      const character = xml[end]
      if (quote) {
        if (character === quote) quote = ''
      } else if (character === '"' || character === "'") quote = character
      else if (character === '>') break
    }
    if (end === xml.length || quote) throw new TypeError('Malformed SVG tag')
    const closing = xml[start + 1] === '/'
    if (closing) depth -= 1
    else {
      elements += 1
      if (elements > 4096) throw new TypeError('SVG element budget exceeded')
      const selfClosing = /\/\s*>$/u.test(xml.slice(start, end + 1))
      if (!selfClosing && ++depth > 32) throw new TypeError('SVG depth budget exceeded')
    }
    if (end - start > 8192) throw new TypeError('SVG tag byte budget exceeded')
    if (depth < 0) throw new TypeError('Malformed SVG nesting')
    index = end + 1
  }
  if (depth !== 0) throw new TypeError('Malformed SVG nesting')
}

function parseSvgSource(input) {
  try {
    if (!Buffer.isBuffer(input) || input.length === 0 || input.length > MAX_SVG_BYTES)
      throw new TypeError('Invalid SVG source size')
    let xml = new TextDecoder('utf-8', { fatal: true }).decode(input)
    if (xml.includes('\u0000') || /<!--|<!\[CDATA\[|<!DOCTYPE|<!ENTITY/iu.test(xml))
      throw new TypeError('Unsupported SVG source markup')
    const declaration = /^<\?xml\s+version\s*=\s*(["'])1\.0\1(?:\s+encoding\s*=\s*(["'])UTF-8\2)?(?:\s+standalone\s*=\s*(["'])(?:yes|no)\3)?\s*\?>/u.exec(xml)
    if (declaration) xml = `${' '.repeat(declaration[0].length)}${xml.slice(declaration[0].length)}`
    if (xml.includes('<?')) throw new TypeError('Unsupported SVG processing instruction')
    preflightSvgXml(xml)
    const roots = parseXml(xml)
    if (roots.length !== 1) throw new TypeError('SVG source must have one root')
    const root = roots[0]
    if (root.uri !== SVG_NAMESPACE || root.local !== 'svg' || root.selfClosing)
      throw new TypeError('Invalid SVG source root')
    const end = root.closeEnd + 1
    if (xml.slice(0, root.start).trim() || xml.slice(end).trim())
      throw new TypeError('Unexpected SVG source text')
    const rootAttributes = new Set(['xmlns', 'viewBox', 'preserveAspectRatio'])
    if (root.attrs.some((entry) => !rootAttributes.has(entry.name)) ||
        new Set(root.attrs.map((entry) => entry.name)).size !== root.attrs.length ||
        decodedAttribute(root, 'xmlns', true) !== SVG_NAMESPACE)
      throw new TypeError('Unsupported SVG root attributes')
    const rawViewBox = decodedAttribute(root, 'viewBox', true)
    const viewValues = svgNumbers(rawViewBox)
    if (viewValues.length !== 4) throw new TypeError('Invalid SVG viewBox')
    const [x, y, width, height] = viewValues
    if (![x, y, width, height].every(Number.isFinite) ||
        Math.max(Math.abs(x), Math.abs(y), Math.abs(width), Math.abs(height)) > MAX_COORDINATE ||
        width <= 0 || height <= 0)
      throw new TypeError('Invalid SVG viewBox')
    const preserveAspectRatio = decodedAttribute(root, 'preserveAspectRatio')
    if (preserveAspectRatio !== null && !/^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?: (?:meet|slice))?)$/.test(preserveAspectRatio))
      throw new TypeError('Unsupported SVG viewport alignment')
    const paths = []
    let cursor = root.end + 1
    for (let ordinal = 0; ordinal < root.children.length; ordinal += 1) {
      const node = root.children[ordinal]
      if (xml.slice(cursor, node.start).trim() || node.uri !== SVG_NAMESPACE ||
          !['path', ...Object.keys(PARAMETERS)].includes(node.local) || node.children.length || !node.selfClosing &&
          xml.slice(node.end + 1, node.closeStart).trim() || paths.length >= MAX_SVG_PATHS)
        throw new TypeError('Unsupported SVG source structure')
      const primitiveNames = PARAMETERS[node.local]
      const allowed = new Set([...(primitiveNames ?? ['d']), 'fill', 'stroke', 'stroke-width', 'transform'])
      if (node.attrs.some((entry) => !allowed.has(entry.name)) ||
          new Set(node.attrs.map((entry) => entry.name)).size !== node.attrs.length)
        throw new TypeError('Unsupported SVG component attributes')
      let primitive
      if (primitiveNames) {
        const parameters = {}
        for (const name of primitiveNames) {
          const raw = decodedAttribute(node, name)
          if (raw === null) continue
          if (name === 'points') {
            const values = svgNumbers(raw)
            if (values.length % 2) throw new TypeError('Invalid SVG primitive points')
            parameters.points = []
            for (let at = 0; at < values.length; at += 2) parameters.points.push({ x: values[at], y: values[at + 1] })
          } else parameters[name] = numericAttribute(node, name)
        }
        primitive = normalizePrimitive({ kind: node.local, parameters })
      }
      const transform = decodedAttribute(node, 'transform')
      const strokeWidth = numericAttribute(node, 'stroke-width', 1)
      if (strokeWidth < 0) throw new TypeError('Invalid SVG stroke width')
      paths.push({
        sourceOrdinal: ordinal,
        commands: primitive ? primitiveCommands(primitive) : parseSvgPathData(decodedAttribute(node, 'd', true)),
        ...(primitive ? { primitive } : {}),
        ...(transform === null ? {} : { transform: svgTransform(transform) }),
        fill: paintAttribute(node, 'fill', '#000000'),
        stroke: paintAttribute(node, 'stroke', 'none'),
        strokeWidth,
      })
      cursor = node.selfClosing ? node.end + 1 : node.closeEnd + 1
    }
    if (xml.slice(cursor, root.closeStart).trim() || paths.length === 0)
      throw new TypeError('Invalid SVG source content')
    return { viewBox: { x, y, width, height }, paths,
      ...(preserveAspectRatio === null ? {} : { preserveAspectRatio }) }
  } catch {
    throw new TypeError('Invalid or unsupported SVG source')
  }
}

module.exports = { parseSvgPathData, parseSvgSource }
