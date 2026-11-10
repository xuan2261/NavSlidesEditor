const { createHash } = require('node:crypto')
const { attr, decodeXml, A_URIS, P_URIS } = require('./ooxml-text-run-xml')
const { extractGeometryImageMetadata } = require('./geometry-image-metadata')
const { pictureParameters } = require('../../../shared/src/pptx-picture-document')
const R = new Set([
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships',
])
function readPictureSource(context, media, fail) {
  const { source, node, xml } = context
  const reject = (reason) => fail(source, `picture ${reason}`)
  function check(n, attributes, children, uris = A_URIS, childUris = A_URIS) {
    if (!n || !uris.has(n.uri) ||
        n.attrs.some((a) => !/^xmlns(?::|$)/.test(a.name) &&
          (!attributes.includes(a.name) || a.value === '')) ||
        n.children.some((c) => !childUris.has(c.uri) || !children.includes(c.local)))
      reject('unsupported/malformed source')
    if (!n.selfClosing) {
      let cursor = n.end + 1
      for (const c of n.children) {
        if (xml.slice(cursor, c.start).trim()) reject('unexpected text')
        cursor = c.closeEnd + 1
      }
      if (xml.slice(cursor, n.closeStart).trim()) reject('unexpected text')
    }
  }
  const fills = node.children.filter((c) => P_URIS.has(c.uri) && c.local === 'blipFill')
  const properties = node.children.find((c) => P_URIS.has(c.uri) && c.local === 'spPr')
  // Only the linked geometry lane has a checked, source-bound effect program.
  // Legacy geometry must still reject rather than silently drop authored paint.
  if (context.geometryDeclarations === undefined && properties?.children.some((c) =>
    A_URIS.has(c.uri) && ['effectLst', 'effectDag'].includes(c.local) && c.children.length))
    reject('shape effects require linked geometry')
  if (fills.length !== 1) reject('missing/ambiguous fill')
  const fill = fills[0]
  check(fill, ['dpi', 'rotWithShape'], ['blip', 'srcRect', 'tile', 'stretch'], P_URIS)
  const single = (n, key) => {
    const children = n.children.filter((c) => c.local === key)
    if (children.length > 1) reject(`ambiguous ${key}`)
    return children[0]
  }
  const blip = single(fill, 'blip')
  const embed = blip?.attrs.filter((a) =>
    a.name.endsWith(':embed') && R.has(blip.namespaces[a.name.split(':')[0]]))
  if (embed?.length !== 1) reject('embedded relationship')
  check(blip, [embed[0].name, 'cstate'], ['alphaModFix', 'inv', 'lum', 'extLst'])
  const raw = (n, key) => attr(n, key)
  const number = (n, key) => {
    const value = decodeXml(raw(n, key))
    if (!/^[+-]?\d+$/.test(value)) reject(`native ${key}`)
    return Number(value)
  }
  const numbers = (n, keys) => Object.fromEntries(keys.filter((key) => raw(n, key) !== null)
    .map((key) => [key, number(n, key)]))
  const rectangle = (n) => {
    check(n, ['l', 't', 'r', 'b'], [])
    return numbers(n, ['l', 't', 'r', 'b'])
  }
  const componentId = `picture:${source.id}`
  const picture = {
    schemaVersion: 1, componentId,
    mediaBinding: { partUri: media.partUri, relationshipId: media.relationshipId, sha256: media.sha256 },
    alpha: blip.children.filter((effect) => effect.local === 'alphaModFix').map((effect) => {
      check(effect, ['amt'], [])
      return { kind: 'alphaModFix', ...numbers(effect, ['amt']) }
    }),
    ...numbers(fill, ['dpi']),
  }
  const extensionList = single(blip, 'extLst')
  let dpiComponent
  if (extensionList && (fill.children.indexOf(blip) !== 0 || blip.children.at(-1) !== extensionList))
    reject('local compression declaration order')
  if (extensionList) {
    check(extensionList, [], ['ext'])
    if (extensionList.children.length !== 1) reject('unsupported blip extension list')
    const extension = extensionList.children[0]
    const dpiNamespace = new Set(['http://schemas.microsoft.com/office/drawing/2010/main'])
    // The wrapper GUID is case-insensitive; the extension QName is not.
    check(extension, ['uri'], ['useLocalDpi'], A_URIS, dpiNamespace)
    if (decodeXml(attr(extension, 'uri')).toUpperCase() !== '{28A0092B-C50C-407E-A947-70E740481C1C}' ||
        extension.children.length !== 1) reject('unsupported blip extension')
    const declaration = extension.children[0]
    check(declaration, ['val'], [], dpiNamespace)
    const lexical = attr(declaration, 'val')
    if (lexical !== null && !['0', '1', 'true', 'false'].includes(decodeXml(lexical)))
      reject('local compression flag')
    const path = [...source.componentLocators[0].path, node.children.indexOf(fill),
      fill.children.indexOf(blip), blip.children.indexOf(extensionList), 0, 0]
    const mapped = context.components.filter((entry) => context.nodes.get(entry.id) === declaration)
    if (mapped.length !== 1 || mapped[0].kind !== 'unknown-extension' ||
        mapped[0].partUri !== source.partUri || mapped[0].preconditionHash !== source.preconditionHash ||
        mapped[0].componentLocators.length !== 1 ||
        JSON.stringify(mapped[0].componentLocators[0].path) !== JSON.stringify(path))
      reject('local compression source binding')
    dpiComponent = { id: mapped[0].id, kind: 'property', locator: {
      path, preconditionHash: source.preconditionHash,
    } }
    // This overrides the document's compression preference, not image placement.
    // An omitted val defaults to true; preserve the authored omission separately.
    picture.useLocalDpi = { componentId: dpiComponent.id,
      ...(lexical === null ? {} : { value: ['1', 'true'].includes(decodeXml(lexical)) }) }
  }
  // These filters operate on straight RGB only, so alpha and color stages
  // commute. Keep both channel orders without duplicating mutable stage data.
  const filters = blip.children.filter((effect) => !['alphaModFix', 'extLst'].includes(effect.local)).map((effect) => {
    if (effect.local === 'inv') {
      check(effect, [], [])
      return { kind: 'inv' }
    }
    if (effect.local === 'lum') {
      check(effect, ['bright', 'contrast'], [])
      return { kind: 'lum', ...numbers(effect, ['bright', 'contrast']) }
    }
    reject(`unsupported color filter ${effect.local}`)
  })
  if (filters.length) picture.filters = filters
  if (raw(blip, 'cstate') !== null) picture.cstate = decodeXml(raw(blip, 'cstate'))
  if (raw(fill, 'rotWithShape') !== null) {
    const flag = decodeXml(raw(fill, 'rotWithShape'))
    if (!['0', '1', 'true', 'false'].includes(flag)) reject('rotation flag')
    picture.rotWithShape = ['1', 'true'].includes(flag)
  }
  const crop = single(fill, 'srcRect'), tile = single(fill, 'tile'), stretch = single(fill, 'stretch')
  if (crop) picture.srcRect = rectangle(crop)
  if (tile) {
    check(tile, ['tx', 'ty', 'sx', 'sy', 'flip', 'algn'], [])
    picture.tile = numbers(tile, ['tx', 'ty', 'sx', 'sy'])
    for (const key of ['flip', 'algn'])
      if (raw(tile, key) !== null) picture.tile[key] = decodeXml(raw(tile, key))
  }
  if (stretch) {
    check(stretch, [], ['fillRect'])
    const rect = single(stretch, 'fillRect')
    picture.stretch = rect ? { fillRect: rectangle(rect) } : {}
  }
  try { pictureParameters(picture) } catch (error) { reject(error.message) }
  return {
    picture,
    ...(dpiComponent ? { dpiComponent } : {}),
    component: { id: componentId, kind: 'property', locator: {
      path: [...source.componentLocators[0].path, node.children.indexOf(fill)],
      preconditionHash: source.preconditionHash,
    } },
  }
}
async function pictureMedia(context, partUri, relationshipId, src, convertedBuffer = null) {
  const sourceBuffer = await context.zip.file(partUri).async('nodebuffer')
  const { width, height, format } = extractGeometryImageMetadata(convertedBuffer || sourceBuffer)
  if (convertedBuffer && format !== 'png') throw new TypeError('Vector conversion requires PNG preview')
  return { partUri, relationshipId, src, width, height,
    sha256: createHash('sha256').update(sourceBuffer).digest('hex') }
}
module.exports = { readPictureSource, pictureMedia }
