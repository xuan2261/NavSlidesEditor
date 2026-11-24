const { resolveGeometryColorPaint } = require('./pptx-geometry-color')

const coordinate = [0, 27273042316900]
const angle = [0, 21599999]
const shadow = { blurRad: coordinate, dist: coordinate, dir: angle }
const affine = {
  ...shadow,
  sx: [-2147483648, 2147483647], sy: [-2147483648, 2147483647],
  kx: [-5399999, 5399999], ky: [-5399999, 5399999],
}
const EFFECT_RANGES = Object.freeze({
  blur: { rad: coordinate }, softEdge: { rad: coordinate }, glow: { rad: coordinate },
  innerShdw: shadow, outerShdw: affine,
  prstShdw: { dist: coordinate, dir: angle },
  reflection: {
    ...affine, stA: [0, 100000], stPos: [0, 100000],
    endA: [0, 100000], endPos: [0, 100000], fadeDir: angle,
  },
  fillOverlay: {},
})
const EFFECT_LIST_ORDER = Object.freeze([
  'blur', 'fillOverlay', 'glow', 'innerShdw', 'outerShdw', 'prstShdw', 'reflection', 'softEdge',
])
const EFFECT_INPUTS = Object.freeze(['fill', 'line', 'fillLine', 'children'])
const ALIGNMENTS = ['tl', 't', 'tr', 'l', 'ctr', 'r', 'bl', 'b', 'br']
const BLENDS = ['over', 'mult', 'screen', 'darken', 'lighten']
const token = (v) => typeof v === 'string' && v.length > 0 && v.length <= 1024 &&
  !/[\t\r\n]|^ | $| {2}/.test(v)
const integer = (min, max) => (v) => Number.isSafeInteger(v) && v >= min && v <= max
const plainWrap = (check) => (v) => check(v, plainWrap)
const fields = (v, checks, required = []) => v && typeof v === 'object' &&
  !Array.isArray(v) && required.every((k) => Object.hasOwn(v, k)) &&
  Object.entries(v).every(([k, x]) => Object.hasOwn(checks, k) && checks[k](x))

// Wrapping is supplied by the style-record boundary so every authored scalar
// keeps its own checked source locator, including nested containers and fills.
function geometryEffectProgramFields(program, wrap, { color, fill }) {
  let count = 0
  function node(v, w, depth, root = false) {
    if (++count > 256 || depth > 16 || !v) return false
    const container = ['list', 'dag', 'cont'].includes(v.kind)
    if (container) {
      if ((root && v.kind === 'cont') || (!root && v.kind !== 'cont')) return false
      return fields(v, {
        kind: () => true,
        ...(v.kind === 'list' ? {} : {
          name: w(token), type: w((x) => ['sib', 'tree'].includes(x)),
        }),
        effects: (entries) => Array.isArray(entries) && entries.length <= 256 &&
          entries.every(w((entry, childWrap) => node(entry, childWrap, depth + 1))),
      }, ['kind', 'effects'])
    }
    if (root) return false
    if (v.kind === 'effect')
      return fields(v, { kind: () => true, ref: w(token) }, ['kind', 'ref'])
    if (!Object.hasOwn(EFFECT_RANGES, v.kind)) return false
    const colored = ['outerShdw', 'innerShdw', 'glow', 'prstShdw'].includes(v.kind)
    return fields(v, {
      kind: () => true,
      ...Object.fromEntries(Object.entries(EFFECT_RANGES[v.kind])
        .map(([k, range]) => [k, w(integer(...range))])),
      ...(colored ? { color: w(color) } : {}),
      ...(['outerShdw', 'reflection'].includes(v.kind) ? {
        algn: w((x) => ALIGNMENTS.includes(x)),
        rotWithShape: w((x) => typeof x === 'boolean'),
      } : {}),
      ...(v.kind === 'blur' ? { grow: w((x) => typeof x === 'boolean') } : {}),
      ...(v.kind === 'prstShdw' ? { prst: w((x) => /^shdw(?:[1-9]|1\d|20)$/.test(x)) } : {}),
      ...(v.kind === 'fillOverlay' ? {
        blend: w((x) => BLENDS.includes(x)), fill: w(fill),
      } : {}),
    }, ['kind', ...(colored ? ['color'] : []),
      ...(v.kind === 'prstShdw' ? ['prst'] : []),
      ...(v.kind === 'fillOverlay' ? ['blend', 'fill'] : [])])
  }
  if (!node(program, wrap, 0, true)) return false
  const unwrapped = unwrapGeometryEffectValue(program)
  try {
    validateGeometryEffectGraph(unwrapped)
    return true
  } catch {
    return false
  }
}
function unwrapGeometryEffectValue(value) {
  if (Array.isArray(value)) return value.map(unwrapGeometryEffectValue)
  if (!value || typeof value !== 'object') return value
  if (Object.hasOwn(value, 'source') && Object.hasOwn(value, 'value'))
    return unwrapGeometryEffectValue(value.value)
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, unwrapGeometryEffectValue(v)]))
}
function compileGeometryEffectGraph(program) {
  const names = new Map(EFFECT_INPUTS.map((name) => [name, { kind: 'source', name }]))
  const nodes = []
  let count = 0
  function build(node, input, depth = 0) {
    if (++count > 256 || depth > 16) throw new TypeError('Effect program budget')
    const result = { kind: 'container' }
    if (node.name !== undefined) {
      if (names.has(node.name)) throw new TypeError('Duplicate effect container name')
      names.set(node.name, result)
    }
    if (node.kind === 'effect') Object.assign(result, { kind: 'reference', ref: node.ref })
    else if (!node.effects) Object.assign(result, { kind: 'leaf', effect: node, input })
    else if (node.kind === 'list') {
      let previous = -1
      for (const child of node.effects) {
        const index = EFFECT_LIST_ORDER.indexOf(child.kind)
        if (index <= previous) throw new TypeError('Invalid effect list order or duplicate')
        previous = index
      }
      result.output = { kind: 'list', inputs: node.effects.map((child) => build(child, input, depth + 1)) }
    } else if ((node.type ?? 'sib') === 'tree') {
      result.output = input
      for (const child of node.effects) result.output = build(child, result.output, depth + 1)
    } else {
      result.output = { kind: 'merge', inputs: node.effects.map((child) => build(child, input, depth + 1)) }
    }
    nodes.push(result)
    return result
  }
  const root = build(program, names.get('fillLine'))
  const costs = new Map(), active = new Set()
  function visit(node) {
    if (!node) throw new TypeError('Dangling effect reference')
    if (active.has(node)) throw new TypeError('Cyclic effect dependency')
    if (costs.has(node)) return costs.get(node)
    active.add(node)
    let cost
    if (node.kind === 'source') cost = 1
    else if (node.kind === 'reference') cost = visit(names.get(node.ref))
    else if (node.kind === 'container') cost = visit(node.output)
    else if (node.inputs) {
      cost = node.inputs.reduce((sum, child) => sum + visit(child), 0)
      // Conservative support for the fixed list's reused image branches.
      if (node.kind === 'list') cost *= 8
    } else {
      const duplicate = node.effect.kind === 'reflection' ||
        (node.effect.kind === 'prstShdw' && ['shdw13', 'shdw17', 'shdw18'].includes(node.effect.prst))
      cost = visit(node.input) * (duplicate ? 2 : 1) + 1
    }
    if (cost > 4096) throw new TypeError('Effect dependency expansion budget')
    active.delete(node)
    costs.set(node, cost)
    return cost
  }
  visit(root)
  // Check even an output bypassed by a later reference in a tree.
  for (const node of nodes) visit(node)
  return { root, names }
}
function validateGeometryEffectGraph(program) {
  compileGeometryEffectGraph(program)
}
function validateGeometryEffectProgram(program, options = {}) {
  const color = options.color ?? ((value) => { resolveGeometryColorPaint(value); return true })
  const fill = options.fill ?? ((value) => fields(value, { color }, ['color']))
  if (!geometryEffectProgramFields(program, plainWrap, { color, fill }))
    throw new TypeError('Invalid PPTX geometry effect program')
  return program
}
module.exports = {
  EFFECT_RANGES, EFFECT_LIST_ORDER, EFFECT_INPUTS,
  geometryEffectProgramFields, validateGeometryEffectProgram, validateGeometryEffectGraph,
  unwrapGeometryEffectValue, compileGeometryEffectGraph,
}
