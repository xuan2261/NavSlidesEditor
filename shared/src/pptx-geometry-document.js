// DrawingML coordinates and angles remain native units. SVG is derived data.
const { multiply, IDENTITY } = require('./pptx-affine')
const { GEOMETRY_COLOR_KINDS, resolveGeometryColorPaint } = require('./pptx-geometry-color')
const { gradientColors, gradientPaintId } = require('./pptx-geometry-gradient')
const { patternPaint, patternPaintId } = require('./pptx-geometry-pattern')
const { blipParameters, blipPatch, blipPaintId } = require('./pptx-geometry-blip')
const { supportsNativeOutline, deriveNativeOutline } = require('./pptx-geometry-outline')
const { validateGeometryEffectProgram } = require('./pptx-geometry-effect-program')
const PRESET_DASH_PATTERNS = Object.freeze({
  solid: [],
  dot: [1, 3],
  dash: [4, 3],
  dashDot: [4, 3, 1, 3],
  lgDash: [8, 3],
  lgDashDot: [8, 3, 1, 3],
  lgDashDotDot: [8, 3, 1, 3, 1, 3],
  sysDot: [1, 1],
  sysDash: [3, 1],
  sysDashDot: [3, 1, 1, 1],
  sysDashDotDot: [3, 1, 1, 1, 1, 1],
})
const LINE_END_TYPES = Object.freeze(['none', 'triangle', 'stealth', 'diamond', 'oval', 'arrow'])
const LINE_END_SIZES = Object.freeze(['sm', 'med', 'lg'])
const GLOW_RANGES = Object.freeze({ rad: [0, 27273042316900] })
const SOFT_EDGE_RANGES = Object.freeze({ rad: [0, 27273042316900] })
const BLUR_RANGES = Object.freeze({ rad: [0, 27273042316900] })
const INNER_SHADOW_RANGES = Object.freeze({
  blurRad: [0, 27273042316900],
  dist: [0, 27273042316900],
  dir: [0, 21599999],
})
const OUTER_SHADOW_RANGES = Object.freeze({
  ...INNER_SHADOW_RANGES,
  sx: [-2147483648, 2147483647],
  sy: [-2147483648, 2147483647],
  kx: [-5399999, 5399999],
  ky: [-5399999, 5399999],
})
const OUTER_SHADOW_ALIGNMENTS = Object.freeze(['tl', 't', 'tr', 'l', 'ctr', 'r', 'bl', 'b', 'br'])
const fail = (detail) => {
  throw new TypeError(`Invalid PPTX geometry: ${detail}`)
}
const finite = (value) => typeof value === 'number' && Number.isFinite(value)
const name = (value) =>
  typeof value === 'string' &&
  /^[A-Za-z0-9_][A-Za-z0-9_-]{0,255}$/.test(value) &&
  !/^\d+$/.test(value) &&
  !['__proto__', 'prototype', 'constructor'].includes(value)
function cloneData(input) {
  const ancestors = new Set()
  let nodes = 0,
    bytes = 0
  function clone(value, depth) {
    if (++nodes > 100000 || depth > 32) fail('data budget')
    if (value === null || typeof value === 'boolean' || finite(value)) return value
    if (typeof value === 'string') {
      bytes += value.length * 2
      if (bytes > 8388608) fail('byte budget')
      return value
    }
    if (!value || typeof value !== 'object' || ancestors.has(value)) fail('plain JSON')
    const list = Array.isArray(value)
    if (Object.getPrototypeOf(value) !== (list ? Array.prototype : Object.prototype))
      fail('prototype')
    const keys = Reflect.ownKeys(value)
    if (list && keys.length !== value.length + 1) fail('dense array')
    const result = list ? [] : {}
    ancestors.add(value)
    for (const key of keys) {
      if (list && key === 'length') continue
      if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key))
        fail('key')
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) fail('data descriptor')
      if (list && !/^(0|[1-9]\d*)$/.test(key)) fail('array key')
      result[key] = clone(descriptor.value, depth + 1)
    }
    ancestors.delete(value)
    return result
  }
  return clone(input, 0)
}
function record(value, fields, required = []) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    required.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => !fields.includes(key))
  )
    fail('record fields')
}
function list(value, max) {
  if (!Array.isArray(value) || value.length > max) fail('array budget')
  return value
}
function extent(value, allowZero = false) {
  if (!finite(value) || (allowZero ? value < 0 : value <= 0) || value > 1e12) fail('extent')
}
function colorPaint(color, detail) {
  record(color, ['kind', 'value'], ['kind'])
  if (color.kind !== 'none' && typeof color.value !== 'string') fail(detail)
  if (
    (color.kind === 'srgb' && !/^[\da-f]{6}$/i.test(color.value)) ||
    (color.kind === 'token' && !/^var\(--ns-[a-z0-9-]+\)$/.test(color.value)) ||
    (color.kind === 'none' && Object.hasOwn(color, 'value')) ||
    !['srgb', 'token', 'none'].includes(color.kind)
  )
    fail(detail)
  return color.kind === 'srgb' ? `#${color.value}` : color.kind === 'none' ? 'none' : color.value
}
function geometryFillPaint(geometry) {
  if (!geometry.style || !Object.hasOwn(geometry.style, 'fill')) return null
  const fill = geometry.style?.fill
  if (Object.hasOwn(fill, 'blip')) {
    record(fill, ['blip'], ['blip'])
    blipParameters(fill.blip)
    return { fill: `url(#${blipPaintId(geometry)})` }
  }
  if (Object.hasOwn(fill, 'pattern')) {
    record(fill, ['pattern'], ['pattern'])
    patternPaint(fill.pattern)
    return { fill: `url(#${patternPaintId(geometry)})` }
  }
  if (Object.hasOwn(fill, 'gradient')) {
    record(fill, ['gradient'], ['gradient'])
    gradientColors(fill.gradient)
    return { fill: `url(#${gradientPaintId(geometry)})` }
  }
  // Earlier geometry records retained unresolved source scheme declarations.
  // Keep those declarations intact until the relationship-bound style resolver
  // supplies paint; they are not an occurrence's explicit color override.
  if (fill?.kind === 'scheme' && !Object.hasOwn(fill, 'color')) {
    record(fill, ['kind', 'value'], ['kind', 'value'])
    if (!/^(dk[12]|lt[12]|bg[12]|tx[12]|accent[1-6]|hlink|folHlink|phClr)$/.test(fill.value))
      fail('fill scheme')
    return null
  }
  record(fill, ['color'], ['color'])
  if (
    GEOMETRY_COLOR_KINDS.includes(fill.color?.kind) &&
    (fill.color.kind !== 'srgb' || Object.hasOwn(fill.color, 'transforms'))
  ) {
    const resolved = resolveGeometryColorPaint(fill.color)
    return { fill: `#${resolved.rgb}`, fillOpacity: resolved.alpha }
  }
  return { fill: colorPaint(fill.color, 'fill color') }
}
function geometryStrokePaint(geometry) {
  const stroke = geometry.style?.stroke
  if (!stroke || !Object.hasOwn(stroke, 'color')) return null
  const resolved =
    GEOMETRY_COLOR_KINDS.includes(stroke.color?.kind) &&
    (stroke.color.kind !== 'srgb' || Object.hasOwn(stroke.color, 'transforms'))
      ? resolveGeometryColorPaint(stroke.color)
      : null
  const paint = resolved ? `#${resolved.rgb}` : colorPaint(stroke.color, 'stroke color')
  if (Object.hasOwn(stroke, 'width') || stroke.color.kind !== 'none') extent(stroke.width, true)
  for (const field of ['headEnd', 'tailEnd']) {
    if (!Object.hasOwn(stroke, field)) continue
    record(stroke[field], ['type', 'w', 'len'])
    for (const [attribute, value] of Object.entries(stroke[field])) {
      if (!(attribute === 'type' ? LINE_END_TYPES : LINE_END_SIZES).includes(value))
        fail('stroke line end')
    }
  }
  if (stroke.cap !== undefined && !['flat', 'rnd', 'sq'].includes(stroke.cap)) fail('stroke cap')
  if (
    Object.hasOwn(stroke, 'compound') &&
    !['sng', 'dbl', 'thinThick', 'thickThin', 'tri'].includes(stroke.compound)
  )
    fail('stroke compound')
  if (Object.hasOwn(stroke, 'alignment') && !['ctr', 'in'].includes(stroke.alignment))
    fail('stroke alignment')
  if (stroke.join !== undefined) {
    record(stroke.join, ['kind', 'limit'], ['kind'])
    if (!['round', 'bevel', 'miter'].includes(stroke.join.kind)) fail('stroke join')
    if (
      Object.hasOwn(stroke.join, 'limit') &&
      (stroke.join.kind !== 'miter' ||
        !Number.isInteger(stroke.join.limit) ||
        stroke.join.limit < 0 ||
        stroke.join.limit > 2147483647)
    )
      fail('stroke miter limit')
  }
  if (stroke.dash && typeof stroke.dash === 'object') {
    if (stroke.dash.kind === 'preset') {
      record(stroke.dash, ['kind', 'value'], ['kind', 'value'])
      if (
        typeof stroke.dash.value !== 'string' ||
        !Object.hasOwn(PRESET_DASH_PATTERNS, stroke.dash.value)
      )
        fail('stroke preset dash')
    } else {
      record(stroke.dash, ['kind', 'stops'], ['kind', 'stops'])
      if (stroke.dash.kind !== 'custom' || !list(stroke.dash.stops, 256).length) fail('stroke dash')
      for (const stop of stroke.dash.stops) {
        record(stop, ['dash', 'space'], ['dash', 'space'])
        extent(stop.dash, true)
        extent(stop.space, true)
      }
    }
  }
  if (
    ((stroke.compound ?? 'sng') !== 'sng' || (stroke.alignment ?? 'ctr') !== 'ctr') &&
    !supportsNativeOutline({
      ...stroke,
      compound: stroke.compound ?? 'sng',
      alignment: stroke.alignment ?? 'ctr',
    })
  )
    fail('stroke compound/alignment profile')
  return {
    stroke: paint,
    strokeWidth: (stroke.width ?? 0) / 9525,
    ...(resolved ? { strokeOpacity: resolved.alpha } : {}),
  }
}
function geometryShadow(geometry) {
  const effects = geometry.style?.effects
  // The pre-existing geometry contract retains opaque effect arrays. Only the
  // typed native list introduced here participates in derived effect painting.
  if (effects === undefined || Array.isArray(effects)) return null
  validateGeometryEffectProgram(effects, {
    fill: (fill) => {
      geometryFillPaint({ ...geometry, style: { fill } })
      return true
    },
  })
  return effects.kind === 'list' && effects.effects.length === 1 ? effects.effects[0] : null
}
function geometryOuterShadow(geometry) {
  const shadow = geometryShadow(geometry)
  return shadow?.kind === 'outerShdw' ? shadow : null
}
function geometryInnerShadow(geometry) {
  const shadow = geometryShadow(geometry)
  return shadow?.kind === 'innerShdw' ? shadow : null
}
function geometryGlow(geometry) {
  const effect = geometryShadow(geometry)
  return effect?.kind === 'glow' ? effect : null
}
function geometrySoftEdge(geometry) {
  const effect = geometryShadow(geometry)
  return effect?.kind === 'softEdge' ? effect : null
}
function geometryBlur(geometry) {
  const effect = geometryShadow(geometry)
  return effect?.kind === 'blur' ? effect : null
}
const unresolvedExtent = Symbol('unresolved source extent')
function builtins(width, height, template = false) {
  const values = Object.assign(Object.create(null), {
    w: template ? unresolvedExtent : width,
    h: template ? unresolvedExtent : height,
    l: 0,
    t: 0,
    r: template ? unresolvedExtent : width,
    b: template ? unresolvedExtent : height,
    hc: template ? unresolvedExtent : width / 2,
    vc: template ? unresolvedExtent : height / 2,
    ss: template ? unresolvedExtent : Math.min(width, height),
    ls: template ? unresolvedExtent : Math.max(width, height),
    cd2: 10800000,
    cd3: 7200000,
    cd4: 5400000,
    cd8: 2700000,
    '3cd4': 16200000,
    '3cd8': 8100000,
    '5cd8': 13500000,
    '7cd8': 18900000,
  })
  for (const divisor of [2, 3, 4, 5, 6, 8, 10, 12, 16, 32]) {
    values[`wd${divisor}`] = template ? unresolvedExtent : width / divisor
    values[`hd${divisor}`] = template ? unresolvedExtent : height / divisor
    values[`ssd${divisor}`] = template ? unresolvedExtent : Math.min(width, height) / divisor
  }
  return values
}
const radians = (angle) => (angle * Math.PI) / 10800000
function boundedCoordinate(value) {
  if (value !== unresolvedExtent && (!finite(value) || Math.abs(value) > 1e15))
    fail('coordinate bound')
  return value
}
function resolve(value, env) {
  if (finite(value)) return boundedCoordinate(value)
  if (typeof value !== 'string' || value.length > 256) fail('coordinate')
  if (Object.hasOwn(env, value)) return env[value]
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) && Number.isFinite(Number(value)))
    return boundedCoordinate(Number(value))
  fail(`unknown guide ${value}`)
}
const formulas = {
  '*/': [3, (a, b, c) => (a * b) / c],
  '+-': [3, (a, b, c) => a + b - c],
  '+/': [3, (a, b, c) => (a + b) / c],
  '?:': [3, (a, b, c) => (a > 0 ? b : c)],
  abs: [1, Math.abs],
  at2: [2, (a, b) => (Math.atan2(b, a) * 10800000) / Math.PI],
  cat2: [3, (a, b, c) => a * Math.cos(Math.atan2(c, b))],
  sat2: [3, (a, b, c) => a * Math.sin(Math.atan2(c, b))],
  cos: [2, (a, b) => a * Math.cos(radians(b))],
  sin: [2, (a, b) => a * Math.sin(radians(b))],
  tan: [2, (a, b) => a * Math.tan(radians(b))],
  max: [2, Math.max],
  min: [2, Math.min],
  mod: [3, Math.hypot],
  pin: [3, (a, b, c) => Math.max(a, Math.min(b, c))],
  sqrt: [1, Math.sqrt],
  val: [1, (a) => a],
}
function commonDegree(operands) {
  const nonzero = operands.filter((operand) => !operand.zero)
  if (!nonzero.length) return 0
  const degree = nonzero[0].degree
  return nonzero.every((operand) => operand.degree === degree) ? degree : null
}
function formulaDegree(operator, operands) {
  if (operands.some((operand) => operand.degree === null)) return null
  const [a, b, c] = operands.map((operand) => operand.degree)
  let degree
  switch (operator) {
    case 'val':
    case 'abs':
      degree = a
      break
    case '*/':
      degree = a + b - c
      break
    case '+/': {
      const sum = commonDegree(operands.slice(0, 2))
      degree = sum === null ? null : sum - c
      break
    }
    case '+-':
    case 'min':
    case 'max':
    case 'mod':
    case 'pin':
      degree = commonDegree(operands)
      break
    case 'sqrt':
      degree = a % 2 === 0 ? a / 2 : null
      break
    case '?:':
      degree = commonDegree(operands.slice(1))
      break
    case 'at2':
      degree = commonDegree(operands) === null ? null : 0
      break
    case 'sin':
    case 'cos':
    case 'tan':
      degree = b === 0 ? a : null
      break
    case 'cat2':
    case 'sat2':
      degree = commonDegree(operands.slice(1)) === null ? null : a
      break
  }
  return Number.isInteger(degree) && degree >= 0 && degree <= 4 ? degree : null
}
function evaluate(document, template = false) {
  const env = builtins(document.width, document.height, template)
  const reserved = new Set(Object.keys(env))
  // This proof is derived from formulas each time, never persisted or granted by a preset name.
  const degrees = Object.create(null)
  for (const key of reserved) {
    const length = /^(w|h|r|b|hc|vc|ss|ls|wd\d+|hd\d+|ssd\d+)$/.test(key)
    degrees[key] = { degree: length ? 1 : 0, constant: !length, zero: !length && env[key] === 0 }
  }
  const adjustmentNames = new Set()
  for (const guide of [...(document.adjustments || []), ...(document.guides || [])]) {
    record(guide, ['name', 'formula'], ['name', 'formula'])
    if (
      !name(guide.name) ||
      reserved.has(guide.name) ||
      typeof guide.formula !== 'string' ||
      guide.formula.length > 512
    )
      fail('guide')
    if ((document.adjustments || []).includes(guide)) {
      if (adjustmentNames.has(guide.name)) fail('duplicate adjustment')
      adjustmentNames.add(guide.name)
    } else if (adjustmentNames.has(guide.name)) fail('guide shadows adjustment')
    const [operator, ...operands] = guide.formula.trim().split(/\s+/)
    if (!Object.hasOwn(formulas, operator) || operands.length !== formulas[operator][0])
      fail('guide operator or arity')
    const values = operands.map((operand) => resolve(operand, env))
    if (['*/', '+/'].includes(operator) && values[2] === 0) fail('division by zero')
    const result =
      template && values.includes(unresolvedExtent)
        ? unresolvedExtent
        : formulas[operator][1](...values)
    const operandsMetadata = operands.map((operand, index) =>
      Object.hasOwn(degrees, operand)
        ? degrees[operand]
        : { degree: 0, constant: true, zero: values[index] === 0 }
    )
    const constant = operandsMetadata.every((operand) => operand.constant)
    const degree = constant ? 0 : formulaDegree(operator, operandsMetadata)
    const limit =
      !template && degree >= 2 && degree <= 4
        ? 1e15 * Math.max(1, document.width, document.height) ** degree
        : 1e15
    if (result !== unresolvedExtent && (!finite(result) || Math.abs(result) > limit))
      fail('guide result')
    env[guide.name] = result
    degrees[guide.name] = { degree, constant, zero: constant && result === 0 }
  }
  return env
}
function validate(document, template = false) {
  record(
    document,
    [
      'schemaVersion',
      'componentId',
      'kind',
      'preset',
      'width',
      'height',
      'adjustments',
      'guides',
      'handles',
      'connections',
      'textRect',
      'connector',
      'style',
      'paths',
    ].filter((field) => !template || !['width', 'height', 'style'].includes(field)),
    template
      ? ['schemaVersion', 'componentId', 'kind', 'paths']
      : ['schemaVersion', 'componentId', 'kind', 'width', 'height', 'paths']
  )
  if (
    document.schemaVersion !== (template ? 2 : 1) ||
    !['custom', 'preset'].includes(document.kind) ||
    (document.kind === 'preset' && !name(document.preset)) ||
    (document.kind === 'custom' && document.preset !== undefined)
  )
    fail('schema/kind')
  if (!template) {
    extent(document.width, true)
    extent(document.height, true)
  }
  for (const field of ['adjustments', 'guides'])
    if (document[field] !== undefined) list(document[field], 4096)
  const env = evaluate(document, template),
    ids = new Set()
  function identify(id) {
    if (typeof id !== 'string' || !id || id.length > 256 || ids.has(id)) fail('component identity')
    ids.add(id)
  }
  identify(document.componentId)
  const coordinate = (value) => boundedCoordinate(resolve(value, env))
  const position = (point) => {
    record(point, ['x', 'y'], ['x', 'y'])
    coordinate(point.x)
    coordinate(point.y)
  }
  for (const path of list(document.paths, 256)) {
    record(
      path,
      ['componentId', 'width', 'height', 'fill', 'stroke', 'extrusionOk', 'commands'],
      ['componentId', 'commands']
    )
    identify(path.componentId)
    for (const field of ['width', 'height']) if (path[field] !== undefined) extent(path[field])
    if (
      path.fill !== undefined &&
      !['none', 'norm', 'lighten', 'lightenLess', 'darken', 'darkenLess'].includes(path.fill)
    )
      fail('path fill')
    for (const field of ['stroke', 'extrusionOk'])
      if (path[field] !== undefined && typeof path[field] !== 'boolean') fail('path flag')
    const commands = list(path.commands, 16384)
    if (!commands.length || commands[0].kind !== 'moveTo') fail('path start')
    for (const command of commands) {
      if (['moveTo', 'lnTo', 'quadBezTo', 'cubicBezTo'].includes(command.kind)) {
        record(command, ['kind', 'points'], ['kind', 'points'])
        const count = { moveTo: 1, lnTo: 1, quadBezTo: 2, cubicBezTo: 3 }[command.kind]
        if (list(command.points, 3).length !== count) fail('point count')
        for (const point of command.points) {
          record(point, ['componentId', 'x', 'y', 'localOffset'], ['componentId', 'x', 'y'])
          identify(point.componentId)
          const x = coordinate(point.x),
            y = coordinate(point.y)
          if (point.localOffset !== undefined) {
            record(point.localOffset, ['x', 'y'], ['x', 'y'])
            if (!finite(point.localOffset.x) || !finite(point.localOffset.y)) fail('point offset')
            boundedCoordinate(point.localOffset.x)
            boundedCoordinate(point.localOffset.y)
          }
          for (const [axis, value] of [
            ['x', x],
            ['y', y],
          ]) {
            const grid = path[axis === 'x' ? 'width' : 'height']
            const scale =
              grid === undefined
                ? 1
                : template
                  ? unresolvedExtent
                  : document[axis === 'x' ? 'width' : 'height'] / grid
            if (value !== unresolvedExtent && scale !== unresolvedExtent)
              boundedCoordinate(value * scale + (point.localOffset?.[axis] ?? 0))
          }
        }
      } else if (command.kind === 'arcTo') {
        record(
          command,
          ['kind', 'wR', 'hR', 'stAng', 'swAng'],
          ['kind', 'wR', 'hR', 'stAng', 'swAng']
        )
        for (const radius of [coordinate(command.wR), coordinate(command.hR)])
          if (radius !== unresolvedExtent && (radius < 0 || radius > 1e12)) fail('arc radius')
        coordinate(command.stAng)
        const sweep = coordinate(command.swAng)
        if (sweep !== unresolvedExtent && Math.abs(sweep) > 21600000) fail('arc sweep')
      } else if (command.kind === 'close') record(command, ['kind'], ['kind'])
      else fail('path command')
    }
  }
  const adjustmentNames = new Set((document.adjustments || []).map((entry) => entry.name))
  for (const handle of list(document.handles || [], 256)) {
    record(
      handle,
      [
        'componentId',
        'kind',
        'position',
        'gdRefX',
        'gdRefY',
        'minX',
        'maxX',
        'minY',
        'maxY',
        'gdRefR',
        'gdRefAng',
        'minR',
        'maxR',
        'minAng',
        'maxAng',
      ],
      ['componentId', 'kind', 'position']
    )
    identify(handle.componentId)
    position(handle.position)
    if (!['xy', 'polar'].includes(handle.kind)) fail('handle kind')
    for (const [key, value] of Object.entries(handle)) {
      if (key.startsWith('gdRef') && !adjustmentNames.has(value)) fail('handle adjustment')
      if (/^(min|max)/.test(key)) coordinate(value)
    }
  }
  for (const connection of list(document.connections || [], 256)) {
    record(connection, ['componentId', 'angle', 'position'], ['componentId', 'angle', 'position'])
    identify(connection.componentId)
    coordinate(connection.angle)
    position(connection.position)
  }
  if (document.textRect !== undefined) {
    record(document.textRect, ['l', 't', 'r', 'b'], ['l', 't', 'r', 'b'])
    Object.values(document.textRect).forEach(coordinate)
  }
  if (document.connector !== undefined) {
    record(document.connector, ['start', 'end'])
    for (const endpoint of Object.values(document.connector)) {
      record(
        endpoint,
        ['shapeId', 'index', 'targetDefinitionId', 'componentId'],
        ['shapeId', 'index']
      )
      if (Object.hasOwn(endpoint, 'targetDefinitionId') || Object.hasOwn(endpoint, 'componentId')) {
        if (
          ![endpoint.targetDefinitionId, endpoint.componentId].every(
            (value) => typeof value === 'string' && value.length > 0 && value.length <= 1024
          )
        )
          fail('connector scope')
      }
      if (
        typeof endpoint.shapeId !== 'string' ||
        !endpoint.shapeId ||
        endpoint.shapeId.length > 256 ||
        !Number.isSafeInteger(endpoint.index) ||
        endpoint.index < 0 ||
        endpoint.index > 255
      )
        fail('connector')
    }
  }
  // Derived paint validation does not establish native pixel qualification.
  if (document.style !== undefined) record(document.style, ['fill', 'stroke', 'effects'])
  geometryFillPaint(document)
  geometryStrokePaint(document)
  geometryOuterShadow(document)
  return env
}
// Retain only the last successful value, never a mutable geometry or paint result.
// Every call still clones and validates its input; any edit changes the proof key.
let lastNativeOutlineValidation
function normalizeGeometryDocument(input) {
  const document = cloneData(input)
  validate(document)
  const stroke = document.style?.stroke
  if (
    stroke?.color &&
    ((stroke.compound ?? 'sng') !== 'sng' || (stroke.alignment ?? 'ctr') !== 'ctr')
  ) {
    let negativeZero = false
    const key = JSON.stringify(document, (_key, value) => {
      if (Object.is(value, -0)) negativeZero = true
      return value
    })
    if (!negativeZero && key === lastNativeOutlineValidation) return document
    const profile = {
      ...stroke,
      compound: stroke.compound ?? 'sng',
      alignment: stroke.alignment ?? 'ctr',
    }
    for (const path of geometryPaths(document, {
      projectToLocal: true,
      localScale: [1 / 9525, 1 / 9525],
    }).paths)
      deriveNativeOutline(path, profile, (stroke.width ?? 0) / 9525)
    if (!negativeZero) lastNativeOutlineValidation = key
  }
  return document
}
function normalizeGeometryTemplate(input) {
  const document = cloneData(input)
  validate(document, true)
  return document
}
function evaluateGeometryGuides(input) {
  const document = normalizeGeometryDocument(input)
  return evaluate(document)
}
function deriveGeometryPaths(input, options = {}) {
  return geometryPaths(normalizeGeometryDocument(input), options)
}
function geometryPaths(
  document,
  { transform = IDENTITY, projectToLocal = false, localScale = [1, 1] } = {}
) {
  const env = evaluate(document)
  if (!document.paths.length) fail('render requires authored paths')
  if (!Array.isArray(transform) || transform.length !== 6 || !transform.every(finite))
    fail('transform')
  if (
    !Array.isArray(localScale) ||
    localScale.length !== 2 ||
    !localScale.every((value) => finite(value) && value > 0)
  )
    fail('local scale')
  const number = (value) => {
    boundedCoordinate(value)
    return String(Math.abs(value) < 1e-12 ? 0 : value)
  }
  const position = (point) => ({ x: resolve(point.x, env), y: resolve(point.y, env) })
  const paths = document.paths.map((path) => {
    const scaleX = (path.width === undefined ? 1 : document.width / path.width) * localScale[0]
    const scaleY = (path.height === undefined ? 1 : document.height / path.height) * localScale[1]
    const checkNativePosition = (point) => {
      boundedCoordinate((point.x * (projectToLocal ? 1 : scaleX)) / localScale[0])
      boundedCoordinate((point.y * (projectToLocal ? 1 : scaleY)) / localScale[1])
    }
    const parts = [],
      segments = [],
      current = { x: 0, y: 0 },
      start = { x: 0, y: 0 }
    for (const command of path.commands) {
      if (command.points) {
        const points = command.points.map((point) => {
          const raw = position(point)
          return projectToLocal
            ? {
                x: raw.x * scaleX + (point.localOffset?.x ?? 0) * localScale[0],
                y: raw.y * scaleY + (point.localOffset?.y ?? 0) * localScale[1],
              }
            : raw
        })
        segments.push({
          kind: command.kind,
          points: command.kind === 'moveTo' ? points : [{ ...current }, ...points],
        })
        parts.push(
          { moveTo: 'M', lnTo: 'L', quadBezTo: 'Q', cubicBezTo: 'C' }[command.kind],
          ...points.flatMap((point) => [number(point.x), number(point.y)])
        )
        Object.assign(current, points.at(-1))
        if (command.kind === 'moveTo') Object.assign(start, current)
      } else if (command.kind === 'close') {
        segments.push({ kind: 'close', points: [{ ...current }, { ...start }] })
        parts.push('Z')
        Object.assign(current, start)
      } else {
        const rx = resolve(command.wR, env),
          ry = resolve(command.hR, env)
        extent(rx * (path.width === undefined ? 1 : document.width / path.width), true)
        extent(ry * (path.height === undefined ? 1 : document.height / path.height), true)
        const angle = radians(resolve(command.stAng, env)),
          sweep = radians(resolve(command.swAng, env))
        if (rx === 0 || ry === 0 || sweep === 0) continue
        // DrawingML angles describe radial direction, not ellipse parameter.
        const polar = (theta) => {
          const parameter = Math.atan2(rx * Math.sin(theta), ry * Math.cos(theta))
          return { x: rx * Math.cos(parameter), y: ry * Math.sin(parameter) }
        }
        const projectedPolar = (theta) => {
          const raw = polar(theta)
          return projectToLocal ? { x: raw.x * scaleX, y: raw.y * scaleY } : raw
        }
        const offset = projectedPolar(angle),
          center = { x: current.x - offset.x, y: current.y - offset.y }
        checkNativePosition(center)
        if (projectToLocal && (scaleX === 0 || scaleY === 0)) {
          // Preserve traversal and dash distance when an ellipse projects onto
          // a line. Its extrema, not just its end, define that traversal.
          const endAngle = angle + sweep
          const low = Math.min(angle, endAngle),
            high = Math.max(angle, endAngle)
          const cuts = []
          for (
            let k = Math.floor(low / (Math.PI / 2)) + 1;
            k < Math.ceil(high / (Math.PI / 2));
            k++
          )
            cuts.push((k * Math.PI) / 2)
          cuts.sort((a, b) => (sweep > 0 ? a - b : b - a))
          cuts.push(endAngle)
          for (const theta of cuts) {
            const end = projectedPolar(theta)
            segments.push({
              kind: 'lnTo',
              points: [{ ...current }, { x: center.x + end.x, y: center.y + end.y }],
            })
            current.x = center.x + end.x
            current.y = center.y + end.y
            checkNativePosition(current)
            parts.push('L', number(current.x), number(current.y))
          }
          continue
        }
        const segmentCount = Math.ceil(Math.abs(sweep) / (Math.PI / 2))
        for (let index = 1; index <= segmentCount; index++) {
          const end = projectedPolar(angle + (sweep * index) / segmentCount)
          const radiusX = projectToLocal ? rx * scaleX : rx
          const radiusY = projectToLocal ? ry * scaleY : ry
          const startParameter = Math.atan2(
            (current.y - center.y) / radiusY,
            (current.x - center.x) / radiusX
          )
          const endParameter = Math.atan2(end.y / radiusY, end.x / radiusX)
          let parameterSweep = endParameter - startParameter
          if (sweep > 0 && parameterSweep < 0) parameterSweep += 2 * Math.PI
          if (sweep < 0 && parameterSweep > 0) parameterSweep -= 2 * Math.PI
          segments.push({
            kind: 'arcTo',
            points: [{ ...current }, { x: center.x + end.x, y: center.y + end.y }],
            center,
            radii: [radiusX, radiusY],
            angle: startParameter,
            sweep: parameterSweep,
          })
          current.x = center.x + end.x
          current.y = center.y + end.y
          checkNativePosition(current)
          parts.push(
            'A',
            number(radiusX),
            number(radiusY),
            '0',
            '0',
            sweep > 0 ? '1' : '0',
            number(current.x),
            number(current.y)
          )
        }
      }
    }
    return {
      ...path,
      segments,
      d: parts.join(' '),
      transform: projectToLocal
        ? [...transform]
        : multiply(transform, [scaleX, 0, 0, scaleY, 0, 0]),
    }
  })
  return {
    paths,
    handles: (document.handles || []).map((handle) => ({
      ...handle,
      position: position(handle.position),
    })),
    connections: (document.connections || []).map((connection) => ({
      ...connection,
      angle: resolve(connection.angle, env),
      position: position(connection.position),
    })),
    ...(document.textRect
      ? {
          textRect: Object.fromEntries(
            Object.entries(document.textRect).map(([key, value]) => [key, resolve(value, env)])
          ),
        }
      : {}),
    ...(document.connector ? { connector: document.connector } : {}),
    ...(document.style ? { style: document.style } : {}),
  }
}
function editGeometryDocument(input, inputCommand) {
  const document = normalizeGeometryDocument(input),
    command = cloneData(inputCommand)
  if (command.type === 'control-point') {
    record(command, ['type', 'componentId', 'x', 'y', 'localOffset'], ['type', 'componentId'])
    if (!['x', 'y', 'localOffset'].some((field) => Object.hasOwn(command, field)))
      fail('point edit')
    for (const axis of ['x', 'y'])
      if (Object.hasOwn(command, axis) && !finite(command[axis])) fail('point edit')
    const point = document.paths
      .flatMap((path) => path.commands)
      .flatMap((entry) => entry.points || [])
      .find((entry) => entry.componentId === command.componentId)
    if (!point) fail('unknown point')
    for (const axis of ['x', 'y']) if (Object.hasOwn(command, axis)) point[axis] = command[axis]
    if (Object.hasOwn(command, 'localOffset')) point.localOffset = command.localOffset
  } else if (command.type === 'extent') {
    record(command, ['type', 'width', 'height'], ['type'])
    if (!['width', 'height'].some((axis) => Object.hasOwn(command, axis))) fail('extent edit')
    for (const axis of ['width', 'height'])
      if (Object.hasOwn(command, axis)) {
        extent(command[axis], true)
        document[axis] = command[axis]
      }
  } else if (command.type === 'arc-parameter') {
    const fields = ['type', 'pathId', 'commandIndex', 'parameter', 'value']
    record(command, fields, fields)
    if (
      typeof command.pathId !== 'string' ||
      !Number.isSafeInteger(command.commandIndex) ||
      command.commandIndex < 0 ||
      !['wR', 'hR', 'stAng', 'swAng'].includes(command.parameter) ||
      !finite(command.value)
    )
      fail('arc edit')
    const arc = document.paths.find((path) => path.componentId === command.pathId)?.commands[
      command.commandIndex
    ]
    if (arc?.kind !== 'arcTo') fail('arc target')
    arc[command.parameter] = command.value
  } else if (command.type === 'adjustment') {
    record(command, ['type', 'name', 'value'], ['type', 'name', 'value'])
    if (!finite(command.value)) fail('adjustment value')
    const adjustment = document.adjustments?.find((entry) => entry.name === command.name)
    if (!adjustment) fail('unknown adjustment')
    adjustment.formula = `val ${command.value}`
  } else if (command.type === 'fill-gradient') {
    record(command, ['type', 'gradient'], ['type', 'gradient'])
    document.style = { ...document.style, fill: { gradient: command.gradient } }
  } else if (command.type === 'fill-pattern') {
    record(command, ['type', 'pattern'], ['type', 'pattern'])
    record(command.pattern, ['preset', 'foreground', 'background'])
    const pattern = { ...document.style?.fill?.pattern }
    for (const [field, value] of Object.entries(command.pattern)) {
      if (value === null) delete pattern[field]
      else pattern[field] = value
    }
    document.style = { ...document.style, fill: { pattern } }
  } else if (command.type === 'fill-blip') {
    record(command, ['type', 'blip'], ['type', 'blip'])
    blipPatch(command.blip)
    if (!document.style?.fill?.blip) fail('missing source image fill')
    const blip = { ...document.style.fill.blip }
    for (const [field, value] of Object.entries(command.blip)) {
      if (value === null) delete blip[field]
      else blip[field] = value
    }
    document.style = { ...document.style, fill: { blip } }
  } else if (command.type === 'effects') {
    record(command, ['type', 'effects'], ['type', 'effects'])
    document.style = {
      ...document.style,
      effects: command.effects === null ? { kind: 'list', effects: [] } : command.effects,
    }
  } else if (command.type === 'blur') {
    record(command, ['type', 'blur'], ['type', 'blur'])
    if (command.blur !== null && command.blur?.kind !== 'blur') fail('blur command kind')
    document.style = {
      ...document.style,
      effects: { kind: 'list', effects: command.blur === null ? [] : [command.blur] },
    }
  } else if (command.type === 'soft-edge') {
    record(command, ['type', 'softEdge'], ['type', 'softEdge'])
    if (command.softEdge !== null && command.softEdge?.kind !== 'softEdge')
      fail('soft-edge command kind')
    document.style = {
      ...document.style,
      effects: { kind: 'list', effects: command.softEdge === null ? [] : [command.softEdge] },
    }
  } else if (command.type === 'glow') {
    record(command, ['type', 'glow'], ['type', 'glow'])
    if (command.glow !== null && command.glow?.kind !== 'glow') fail('glow command kind')
    document.style = {
      ...document.style,
      effects: { kind: 'list', effects: command.glow === null ? [] : [command.glow] },
    }
  } else if (['outer-shadow', 'inner-shadow'].includes(command.type)) {
    record(command, ['type', 'shadow'], ['type', 'shadow'])
    if (
      command.shadow !== null &&
      command.shadow?.kind !== (command.type === 'inner-shadow' ? 'innerShdw' : 'outerShdw')
    )
      fail('shadow command kind')
    document.style = {
      ...document.style,
      effects: { kind: 'list', effects: command.shadow === null ? [] : [command.shadow] },
    }
  } else if (command.type === 'fill-paint') {
    record(command, ['type', 'color'], ['type', 'color'])
    document.style = { ...document.style, fill: { color: command.color } }
  } else if (command.type === 'stroke-paint') {
    record(command, ['type', 'color', 'width'], ['type', 'color', 'width'])
    document.style = {
      ...document.style,
      stroke: {
        ...document.style?.stroke,
        color: command.color,
        width: command.width,
      },
    }
  } else if (command.type === 'stroke-color') {
    record(command, ['type', 'color'], ['type', 'color'])
    if (!geometryStrokePaint(document)) fail('missing native stroke')
    document.style.stroke.color = command.color
  } else if (command.type === 'stroke-dash') {
    record(command, ['type', 'dash'], ['type', 'dash'])
    record(command.dash, ['kind', 'value', 'stops'], ['kind'])
    if (!geometryStrokePaint(document)) fail('missing native stroke')
    document.style.stroke.dash = command.dash
  } else if (['stroke-cap', 'stroke-join'].includes(command.type)) {
    const field = command.type === 'stroke-cap' ? 'cap' : 'join'
    record(command, ['type', field], ['type', field])
    if (!geometryStrokePaint(document)) fail('missing native stroke')
    if (command[field] === null) delete document.style.stroke[field]
    else {
      if (field === 'cap' && !['flat', 'rnd', 'sq'].includes(command.cap)) fail('stroke cap')
      if (field === 'join') record(command.join, ['kind', 'limit'], ['kind'])
      document.style.stroke[field] = command[field]
    }
  } else if (command.type === 'stroke-end') {
    record(command, ['type', 'end', 'value'], ['type', 'end', 'value'])
    if (!['headEnd', 'tailEnd'].includes(command.end)) fail('stroke end')
    if (!geometryStrokePaint(document)) fail('missing native stroke')
    if (command.value === null) delete document.style.stroke[command.end]
    else {
      record(command.value, ['type', 'w', 'len'])
      document.style.stroke[command.end] = command.value
    }
  } else if (command.type === 'connector') {
    record(command, ['type', 'end', 'shapeId', 'index'], ['type', 'end', 'shapeId', 'index'])
    if (!document.connector || !['start', 'end'].includes(command.end)) fail('connector edit')
    document.connector[command.end] = { shapeId: command.shapeId, index: command.index }
  } else fail('unknown edit')
  return normalizeGeometryDocument(document)
}
module.exports = {
  normalizeGeometryDocument,
  normalizeGeometryTemplate,
  evaluateGeometryGuides,
  deriveGeometryPaths,
  editGeometryDocument,
  geometryStrokePaint,
  geometryFillPaint,
  geometryOuterShadow,
  geometryInnerShadow,
  geometryGlow,
  GLOW_RANGES,
  geometrySoftEdge,
  SOFT_EDGE_RANGES,
  geometryBlur,
  BLUR_RANGES,
  INNER_SHADOW_RANGES,
  OUTER_SHADOW_RANGES,
  OUTER_SHADOW_ALIGNMENTS,
  PRESET_DASH_PATTERNS,
  LINE_END_TYPES,
  LINE_END_SIZES,
}
module.exports.default = module.exports
