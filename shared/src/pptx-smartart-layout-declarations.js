const { cloneTextData } = require('./pptx-text-document')

const selector = {
  axis: ['self', 'ch', 'des', 'desOrSelf'],
  ptType: ['all', 'node', 'doc', 'asst'],
}
const scope = ['self', 'ch']
const dimension = ['w', 'h', 'l', 't', 'sp']
// The executable subset is deliberately closed. Unsupported constructs are
// rejected even inside a branch/iteration that would currently select no data.
const LAYOUT_ATTRIBUTES = {
  layoutDef: { uniqueId: 'string', minVer: 'string', defStyle: 'string' },
  layoutNode: { name: 'string', styleLbl: 'string' },
  alg: { type: ['composite', 'comp', 'lin', 'sp'] },
  param: { type: ['linDir', 'vertAlign', 'horzAlign'], val: 'string' },
  constrLst: {},
  constr: {
    type: dimension,
    for: scope,
    forName: 'string',
    refFor: scope,
    refForName: 'string',
    refType: dimension,
    fact: 'number',
    val: 'number',
    op: ['equ'],
  },
  forEach: { ...selector, name: 'string' },
  presOf: selector,
  shape: { type: ['rect', 'ellipse', 'none'] },
  choose: { name: 'string' },
  if: {
    name: 'string',
    func: ['cnt'],
    op: ['equ', 'neq', 'gt', 'lt', 'gte', 'lte'],
    val: 'string',
  },
  else: { name: 'string' },
}
const LAYOUT_CHILDREN = {
  layoutDef: ['layoutNode'],
  layoutNode: ['alg', 'constrLst', 'forEach', 'layoutNode', 'presOf', 'shape', 'choose'],
  alg: ['param'],
  constrLst: ['constr'],
  forEach: ['forEach', 'layoutNode', 'choose'],
  choose: ['if', 'else'],
  if: ['forEach', 'layoutNode', 'choose'],
  else: ['forEach', 'layoutNode', 'choose'],
  param: [],
  constr: [],
  presOf: [],
  shape: [],
}
function layoutFailure(declaration, detail) {
  const error = new TypeError(`Unsupported PPTX SmartArt layout: ${detail}`)
  error.code = 'PPTX_SMARTART_LAYOUT_UNSUPPORTED'
  error.status = 422
  error.componentId = declaration?.componentId
  error.sourceLocation = {
    ...declaration?.source,
    definitionId: declaration?.componentId,
    localName: declaration?.type,
  }
  throw error
}
function freezeLayout(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeLayout)
    Object.freeze(value)
  }
  return value
}
function validateLayoutDeclaration(d) {
  const spec = LAYOUT_ATTRIBUTES[d.type]
  if (!Object.hasOwn(LAYOUT_ATTRIBUTES, d.type)) layoutFailure(d, `construct ${d.type}`)
  for (const [key, value] of Object.entries(d.attributes)) {
    const type = spec[key]
    if (
      !Object.hasOwn(spec, key) ||
      (Array.isArray(type)
        ? !type.includes(value)
        : type === 'number'
          ? typeof value !== 'number' || !Number.isFinite(value)
          : typeof value !== 'string' || !value.length)
    )
      layoutFailure(d, `attribute ${d.type}.${key}`)
  }
  const required =
    { alg: ['type'], param: ['type', 'val'], constr: ['type'], shape: ['type'] }[d.type] || []
  if (required.some((key) => !Object.hasOwn(d.attributes, key)))
    layoutFailure(d, 'missing attribute')
  if (d.type === 'choose' && (!d.children || !d.children.length))
    layoutFailure(d, 'choose construct requires branch declarations')
  const a = d.attributes
  if (
    d.type === 'if' &&
    (a.func !== 'cnt' ||
      !Object.hasOwn(a, 'op') ||
      !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(a.val ?? '') ||
      !Number.isFinite(Number(a.val)))
  )
    layoutFailure(d, 'count condition requires func, op and a finite numeric val')
  if (
    d.type === 'param' &&
    !{
      linDir: ['fromL', 'fromR', 'fromT', 'fromB'],
      vertAlign: ['t', 'mid', 'b'],
      horzAlign: ['l', 'ctr', 'r'],
    }[a.type].includes(a.val)
  )
    layoutFailure(d, 'parameter value')
  if (
    d.type === 'constr' &&
    (Object.hasOwn(a, 'val') === Object.hasOwn(a, 'refType') ||
      (Object.hasOwn(a, 'val') &&
        ['fact', 'refFor', 'refForName'].some((k) => Object.hasOwn(a, k))))
  )
    layoutFailure(d, 'constraint requires either literal val or refType with optional fact')
}
function normalizeSmartArtLayout(input, relationship) {
  const layout = cloneTextData(input)
  const fail = (detail) => layoutFailure(layout.declarations?.[0], detail)
  const record = (v, keys) =>
    v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.keys(v).length === keys.length &&
    keys.every((k) => Object.hasOwn(v, k))
  if (
    !record(layout, ['schemaVersion', 'source', 'rootId', 'declarations']) ||
    layout.schemaVersion !== 1 ||
    !record(layout.source, ['partUri', 'preconditionHash']) ||
    layout.source.partUri !== relationship.partUri ||
    layout.source.preconditionHash !== relationship.preconditionHash
  )
    fail('layout source identity')
  if (
    !Array.isArray(layout.declarations) ||
    !layout.declarations.length ||
    layout.declarations.length > 100000
  )
    fail('declaration budget')
  const ids = new Map(),
    paths = new Set()
  for (const d of layout.declarations) {
    if (
      !record(d, ['componentId', 'type', 'attributes', 'children', 'source']) ||
      typeof d.componentId !== 'string' ||
      !d.componentId ||
      ids.has(d.componentId) ||
      !record(d.source, ['partUri', 'preconditionHash', 'path']) ||
      d.source.partUri !== layout.source.partUri ||
      d.source.preconditionHash !== layout.source.preconditionHash ||
      !Array.isArray(d.source.path) ||
      !d.source.path.length ||
      d.source.path.some((n) => !Number.isSafeInteger(n) || n < 0) ||
      !d.attributes ||
      typeof d.attributes !== 'object' ||
      Array.isArray(d.attributes) ||
      !Array.isArray(d.children)
    )
      fail('declaration identity/record')
    const path = d.source.path.join('.')
    if (paths.has(path)) layoutFailure(d, 'duplicate declaration path')
    paths.add(path)
    ids.set(d.componentId, d)
    validateLayoutDeclaration(d)
  }
  const root = ids.get(layout.rootId),
    seen = new Set()
  if (!root || root.type !== 'layoutDef' || root.source.path.join('.') !== '0') fail('layout root')
  const pending = [root]
  while (pending.length) {
    const d = pending.pop()
    if (seen.has(d.componentId)) layoutFailure(d, 'declaration cycle/shared child')
    seen.add(d.componentId)
    const types = new Set()
    d.children.forEach((id, index) => {
      const child = ids.get(id)
      const childPath = child?.source.path
      const expectedPath = [...d.source.path, index]
      const layoutNodePath =
        d.type === 'layoutDef' && child?.type === 'layoutNode' &&
        childPath.length === 2 && childPath[0] === 0 &&
        Number.isSafeInteger(childPath[1]) && childPath[1] >= 0 && childPath[1] <= 2
      if (
        !child ||
        !LAYOUT_CHILDREN[d.type].includes(child.type) ||
        (!layoutNodePath && childPath.join('.') !== expectedPath.join('.'))
      )
        layoutFailure(d, 'child declaration/locator')
      if (
        d.type === 'choose' && child.type === 'else' &&
        (index === 0 || index !== d.children.length - 1)
      )
        layoutFailure(child, 'else must follow if branches and be last')
      if (
        types.has(child.type) &&
        !['forEach', 'layoutNode', 'constr', 'param', 'if'].includes(child.type)
      )
        layoutFailure(child, 'duplicate declaration')
      types.add(child.type)
      pending.push(child)
    })
  }
  if (seen.size !== ids.size) fail('unreachable declaration')
  return freezeLayout(layout)
}
module.exports = {
  LAYOUT_ATTRIBUTES,
  LAYOUT_CHILDREN,
  validateLayoutDeclaration,
  normalizeSmartArtLayout,
  layoutFailure,
  freezeLayout,
}
