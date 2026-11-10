// Inert, source-bound DrawingML appearance, deliberately not a 3D renderer.
// This admitted grammar retains the Bai_2_2 camera/light/bevel/material programs.
// Other presets/children remain explicit unsupported-input errors, not opaque bags.
const { normalizeTextProperties } = require('./pptx-text-document.js')
const integer = (min, max) => (v) => Number.isSafeInteger(v) && v >= min && v <= max
const one = (...values) => (v) => values.includes(v)
const coordinate = integer(-27273042329600, 27273042329600)
const positiveCoordinate = integer(0, 27273042329600)
const angle = integer(0, 21599999)
const spec = (attributes, required, children = [], requiredChildren = []) =>
  Object.freeze({ attributes: Object.freeze(attributes), required, children, requiredChildren })
// Native units are preserved: EMU coordinates, 1/60000-degree angles,
// 1/1000-percent camera zoom. No defaults are invented for absent attributes.
const SHAPE_3D_GRAMMAR = Object.freeze({
  scene3d: spec({}, [], ['camera', 'lightRig'], ['camera', 'lightRig']),
  camera: spec({ prst: one('orthographicFront'), fov: integer(0, 10800000), zoom: integer(0, 2147483647) }, ['prst'], ['rot']),
  lightRig: spec({ rig: one('soft'), dir: one('tl', 't', 'tr', 'l', 'r', 'bl', 'b', 'br') }, ['rig', 'dir'], ['rot']),
  rot: spec({ lat: angle, lon: angle, rev: angle }, ['lat', 'lon', 'rev']),
  sp3d: spec({ z: coordinate, extrusionH: positiveCoordinate, contourW: positiveCoordinate,
    prstMaterial: one('matte') }, [], ['bevelT', 'bevelB', 'extrusionClr', 'contourClr']),
  bevelT: spec({ w: positiveCoordinate, h: positiveCoordinate, prst: one('artDeco') }, []),
  bevelB: spec({ w: positiveCoordinate, h: positiveCoordinate, prst: one('artDeco') }, []),
  extrusionClr: spec({}, []),
  contourClr: spec({}, []),
})
const CHILD_FIELDS = Object.freeze({ camera: 'camera', lightRig: 'lightRig', rot: 'rotation',
  bevelT: 'bevelTop', bevelB: 'bevelBottom', extrusionClr: 'extrusionColor', contourClr: 'contourColor' })
const record = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const keys = (v, allowed, required = allowed) => record(v) &&
  required.every((key) => Object.hasOwn(v, key)) && Object.keys(v).every((key) => allowed.includes(key))
const samePath = (a, b) => Array.isArray(a) && Array.isArray(b) &&
  a.length === b.length && a.every((entry, i) => Number.isSafeInteger(entry) && entry >= 0 && entry === b[i])
const fail = () => { throw new TypeError('Invalid source 3D appearance') }

function validateShape3dAppearance(definition) {
  const appearance = definition.content.shape3dAppearance
  if (appearance === undefined) return
  if (!keys(appearance, ['schemaVersion', 'scene', 'shape'], ['schemaVersion']) ||
      appearance.schemaVersion !== 1 || (!appearance.scene && !appearance.shape) ||
      definition.origin === 'project' || !['shape', 'text', 'line', 'image', 'svg'].includes(definition.kind)) fail()
  const owner = definition.source
  const ownerPath = owner?.componentLocator?.path
  if (!ownerPath || !owner.nativeId) fail()
  const used = new Set()
  function node(entry, kind, parent, ordinal, root = false) {
    if (!keys(entry, root ? ['componentId', 'source', 'value'] : ['source', 'value']) ||
        !keys(entry.source, ['partUri', 'preconditionHash', 'componentLocator']) ||
        !keys(entry.source.componentLocator, ['path', 'preconditionHash']) ||
        entry.source.partUri !== owner.partUri || entry.source.preconditionHash !== owner.preconditionHash ||
        entry.source.componentLocator.preconditionHash !== owner.preconditionHash ||
        !samePath(entry.source.componentLocator.path, [...parent, ordinal])) fail()
    const path = entry.source.componentLocator.path
    const token = path.join('.')
    if (used.has(token)) fail()
    used.add(token)
    if (root) {
      const component = definition.components.find((c) => c.id === entry.componentId)
      if (!component || component.kind !== 'property' || component.partUri !== undefined ||
          component.locator.preconditionHash !== owner.preconditionHash ||
          !samePath(component.locator.path, path) ||
          entry.componentId !== `${owner.partUri}#property:${path.join('.')}`) fail()
    }
    const grammar = SHAPE_3D_GRAMMAR[kind]
    const value = entry.value
    const color = ['extrusionClr', 'contourClr'].includes(kind)
    const fields = ['kind', ...Object.keys(grammar.attributes), ...grammar.children.map((c) => CHILD_FIELDS[c]), ...(color ? ['color'] : [])]
    if (!keys(value, fields, ['kind', ...grammar.required, ...grammar.requiredChildren.map((c) => CHILD_FIELDS[c]), ...(color ? ['color'] : [])]) || value.kind !== kind) fail()
    for (const [name, check] of Object.entries(grammar.attributes))
      if (Object.hasOwn(value, name) && !check(value[name])) fail()
    if (color) {
      try { normalizeTextProperties({ color: value.color }, 'run') } catch { fail() }
    }
    let index = 0
    for (const child of grammar.children) {
      const field = CHILD_FIELDS[child]
      if (Object.hasOwn(value, field)) node(value[field], child, path, index++)
    }
  }
  let previous = -1
  for (const [field, kind] of [['scene', 'scene3d'], ['shape', 'sp3d']]) {
    if (!Object.hasOwn(appearance, field)) continue
    const root = appearance[field], path = root?.source?.componentLocator?.path
    // A root is a direct child of this native object's spPr; do not bind a
    // declaration to an arbitrary descendant or a sibling source definition.
    if (!Array.isArray(path) || path.length !== ownerPath.length + 2 ||
        !samePath(path.slice(0, ownerPath.length), ownerPath) ||
        !Number.isSafeInteger(path.at(-2)) || path.at(-2) < 0 ||
        !Number.isSafeInteger(path.at(-1)) || path.at(-1) <= previous) fail()
    if (appearance.scene && appearance.shape &&
        appearance.scene.source.componentLocator.path.at(-2) !== appearance.shape.source.componentLocator.path.at(-2)) fail()
    node(root, kind, path.slice(0, -1), path.at(-1), true)
    previous = path.at(-1)
  }
}
function isShape3dSourceComponent(definition, componentId) {
  const a = definition.content.shape3dAppearance
  return !!a && [a.scene, a.shape].some((entry) => entry?.componentId === componentId)
}
function validateShape3dOverride(definition, overrides) {
  if (Object.hasOwn(overrides, 'shape3dAppearance') ||
      Object.keys(overrides.components || {}).some((id) => isShape3dSourceComponent(definition, id)) ||
      Object.values(overrides.components || {}).some((value) => record(value) && Object.hasOwn(value, 'shape3dAppearance')))
    throw new TypeError('Source 3D appearance is immutable')
}
module.exports = { SHAPE_3D_GRAMMAR, CHILD_FIELDS, validateShape3dAppearance, validateShape3dOverride }
