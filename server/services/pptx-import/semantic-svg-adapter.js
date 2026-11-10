const { createHash } = require('node:crypto')
const { parseSvgSource } = require('./ooxml-semantic-svg')
const { resolveTarget } = require('./package-store/raw-zip')
const { A_URIS, attr, decodeXml } = require('./ooxml-text-run-xml')
const { PARAMETERS, primitiveGeometry } = require('../../../shared/src/pptx-vector-primitives')
const SVG_NS = 'http://www.w3.org/2000/svg'
const R_URIS = new Set([
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships',
])
function readSemanticSvgPicture(context, blip, fill, fail) {
  const reject = (detail) => fail(context.source, `SVG picture ${detail}`)
  if (!blip || !fill || !A_URIS.has(blip.uri)) reject('missing image relationship')
  const embedded = blip.attrs.filter((entry) => entry.name.endsWith(':embed') &&
    R_URIS.has(blip.namespaces[entry.name.split(':')[0]]))
  if (embedded.length !== 1) reject('ambiguous embedded relationship')
  const relationshipId = decodeXml(embedded[0].value)
  const candidates = context.relationships(context.source.partUri).filter((item) =>
    attr(item, 'Id') === relationshipId && /\/image$/.test(attr(item, 'Type') || '') &&
    ['', 'Internal'].includes(attr(item, 'TargetMode') || ''))
  if (candidates.length !== 1) reject('missing or ambiguous internal image relationship')
  const target = decodeXml(attr(candidates[0], 'Target') || '')
  if (!target || /[?#]/.test(target)) reject('query or fragment in relationship target')
  let partUri
  try { partUri = resolveTarget(context.source.partUri, target) } catch { reject('unsafe relationship target') }
  if (!/\.svg$/i.test(partUri)) reject('source is not an SVG part')
  const part = context.inventory.parts.find((item) => item.partUri === partUri)
  const entry = context.zip.file(partUri)
  if (!part || !entry) reject('missing inventoried SVG part')
  const contentTypes = context.parts.get('[Content_Types].xml')?.roots || []
  const nodes = contentTypes.flatMap((root) => root.children).filter((node) =>
    node.uri === 'http://schemas.openxmlformats.org/package/2006/content-types')
  const override = nodes.filter((node) => node.local === 'Override' &&
    decodeXml(attr(node, 'PartName') || '') === `/${partUri}`)
  const defaults = nodes.filter((node) => node.local === 'Default' &&
    decodeXml(attr(node, 'Extension') || '').toLowerCase() === 'svg')
  const declarations = override.length ? override : defaults
  if (declarations.length !== 1 || decodeXml(attr(declarations[0], 'ContentType') || '') !== 'image/svg+xml')
    reject('invalid SVG content type')
  return entry.async('nodebuffer').then((bytes) => {
    const hash = createHash('sha256').update(bytes).digest('hex')
    if (hash !== part.preconditionHash || bytes.length !== part.byteLength) reject('changed source bytes')
    let parsed
    try { parsed = parseSvgSource(bytes) } catch { reject('invalid or unsupported source') }
    const root = context.parts.get(partUri)?.roots?.[0]
    if (!root || root.uri !== SVG_NS || root.local !== 'svg') reject('missing parsed source root')
    const pathDefinitions = context.inventory.definitions.filter((item) =>
      item.partUri === partUri && item.kind === 'vector-component' &&
      ['path', ...Object.keys(PARAMETERS)].includes(item.localName))
    if (pathDefinitions.length !== parsed.paths.length) reject('path inventory mismatch')
    const ownerPath = context.source.componentLocators?.[0]?.path
    const fillIndex = context.node.children.indexOf(fill)
    if (!ownerPath || fillIndex < 0) reject('missing picture fill locator')
    const fillPath = [...ownerPath, fillIndex]
    const rootComponentId = `${context.source.partUri}#svg-root:${fillPath.join('.')}`
    const rootComponent = { id: rootComponentId, kind: 'property', locator: {
      path: fillPath, preconditionHash: context.source.preconditionHash,
    } }
    const paths = parsed.paths.map((path) => {
      const locator = [0, path.sourceOrdinal]
      const definition = pathDefinitions.find((item) =>
        item.componentLocators.some((source) => JSON.stringify(source.path) === JSON.stringify(locator)))
      const node = definition && context.nodes.get(definition.id)
      if (!definition || !node || node.local !== (path.primitive?.kind ?? 'path') || node.uri !== SVG_NS)
        reject('unbound vector source')
      const pathId = `${partUri}#svg-path:${locator.join('.')}`
      const digest = createHash('sha256').update(`${partUri}:${locator.join('.')}`).digest('hex').slice(0, 24)
      const commands = path.commands.map((command, commandIndex) => ({
        ...command,
        ...(command.points ? { points: command.points.map((point, pointIndex) => ({
          componentId: `svg-point:${digest}:${commandIndex}:${pointIndex}`, x: point.x, y: point.y,
        })) } : {}),
      }))
      const geometry = {
        schemaVersion: 1, componentId: `svg-geometry:${digest}`, kind: 'custom',
        width: parsed.viewBox.width, height: parsed.viewBox.height,
        style: {
          fill: { color: path.fill === 'none' ? { kind: 'none' } : { kind: 'srgb', value: path.fill.slice(1).toUpperCase() } },
          stroke: { color: path.stroke === 'none' ? { kind: 'none' } : { kind: 'srgb', value: path.stroke.slice(1).toUpperCase() }, width: path.strokeWidth },
        },
        paths: [{ componentId: `svg-draw-path:${digest}`, fill: path.fill === 'none' ? 'none' : 'norm',
          stroke: path.stroke !== 'none', commands }],
      }
      return {
        componentId: pathId,
        source: { partUri, preconditionHash: part.preconditionHash, path: locator,
          ...(path.primitive ? { element: path.primitive.kind } : { attribute: 'd' }), ordinal: path.sourceOrdinal },
        geometry: path.primitive ? primitiveGeometry(geometry, path.primitive) : geometry,
        ...(path.primitive ? { primitive: path.primitive } : {}),
        ...(path.transform ? { transform: path.transform } : {}),
        component: { id: pathId, kind: 'path', partUri, locator: { path: locator, preconditionHash: part.preconditionHash } },
        mappedDefinitionId: definition.id,
      }
    })
    return {
      document: { schemaVersion: 1, componentId: rootComponentId,
        source: { partUri, preconditionHash: part.preconditionHash, byteLength: bytes.length, path: [0] },
        ...(parsed.preserveAspectRatio === undefined ? {} : { preserveAspectRatio: parsed.preserveAspectRatio }),
        viewBox: parsed.viewBox, paths: paths.map(({ component: _component, mappedDefinitionId: _mapped, ...path }) => path) },
      components: [rootComponent, ...paths.map((path) => path.component)],
      mappedDefinitionIds: context.inventory.definitions.filter((item) => item.partUri === partUri &&
        item.kind === 'vector-component' && ['svg', 'path', ...Object.keys(PARAMETERS)].includes(item.localName))
        .map((item) => item.id),
      partUri,
      relationshipId,
    }
  })
}
module.exports = { readSemanticSvgPicture }
