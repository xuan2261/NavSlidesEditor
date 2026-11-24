const { cloneFamilyData } = require('./pptx-family-operations-data')
const { editGeometryDocument } = require('./pptx-geometry-document')
const { normalizeSvgDocument } = require('./pptx-svg-document')
const { normalizePrimitive, primitiveGeometry } = require('./pptx-vector-primitives')

function applySvgOperation(input, command) {
  const document = normalizeSvgDocument(input)
  command = cloneFamilyData(command)
  const fields = command?.type === 'edit-primitive' ? ['type', 'pathId', 'parameters']
    : command?.type === 'convert-to-path' ? ['type', 'pathId'] : ['type', 'pathId', 'geometryCommand']
  if (!command || typeof command !== 'object' || Array.isArray(command) ||
      Object.keys(command).length !== fields.length || !fields.every((key) => Object.hasOwn(command, key)) ||
      !['edit-path', 'edit-primitive', 'convert-to-path'].includes(command.type) ||
      typeof command.pathId !== 'string' || !command.pathId)
    throw new TypeError('Invalid typed semantic SVG operation')
  const index = document.paths.findIndex((path) => path.componentId === command.pathId)
  if (index < 0) throw new TypeError('Unknown semantic SVG path')
  const paths = [...document.paths]
  const path = paths[index]
  if (command.type === 'convert-to-path') {
    if (!path.primitive) throw new TypeError('SVG component is already a path')
    const { primitive: _primitive, ...converted } = path
    paths[index] = converted
  } else if (command.type === 'edit-primitive') {
    if (!path.primitive || !command.parameters || typeof command.parameters !== 'object' ||
        Array.isArray(command.parameters) || !Object.keys(command.parameters).length)
      throw new TypeError('Invalid SVG primitive parameter edit')
    const parameters = { ...path.primitive.parameters }
    for (const [key, value] of Object.entries(command.parameters)) {
      if (value === null) delete parameters[key]
      else parameters[key] = value
    }
    const primitive = normalizePrimitive({ kind: path.primitive.kind, parameters })
    paths[index] = { ...path, primitive, geometry: primitiveGeometry(path.geometry, primitive) }
  } else {
    if (path.primitive) throw new TypeError('Explicitly convert SVG primitive to path before editing points')
    paths[index] = { ...path, geometry: editGeometryDocument(path.geometry, command.geometryCommand) }
  }
  return normalizeSvgDocument({ ...document, paths })
}
module.exports = { applySvgOperation }
