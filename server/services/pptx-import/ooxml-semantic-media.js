const { attr, decodeXml, A_URIS, P_URIS } = require('./ooxml-text-run-xml')
const { persistMediaBlob, persistZipMediaRef } = require('./media')
const { resolveTarget } = require('./package-store/raw-zip')

const P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main'
const R_URIS = new Set([
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships',
])
const relationValue = (node, name) => decodeXml(attr(node, name) ?? '')
const descendants = (node, accept, result = []) => {
  for (const child of node?.children || []) {
    if (accept(child)) result.push(child)
    descendants(child, accept, result)
  }
  return result
}

function relationshipId(node, local, fail) {
  const attributes = node.attrs.filter((entry) => {
    const separator = entry.name.indexOf(':')
    return (
      separator > 0 &&
      entry.name.slice(separator + 1) === local &&
      R_URIS.has(node.namespaces[entry.name.slice(0, separator)])
    )
  })
  if (attributes.length !== 1) fail(`invalid ${node.local} media relationship`)
  const id = decodeXml(attributes[0].value)
  if (!id) fail(`invalid ${node.local} media relationship`)
  return id
}

function internalRelationship(context, id, kind, fail) {
  const matches = context.relationships(context.source.partUri).filter(
    (relation) => relationValue(relation, 'Id') === id
  )
  if (matches.length !== 1) fail(`missing/ambiguous ${kind} media relationship`)
  const relation = matches[0]
  const mode = relationValue(relation, 'TargetMode')
  if (!['', 'Internal'].includes(mode)) fail(`external ${kind} media relationship`)
  const type = relationValue(relation, 'Type')
  if (!type.endsWith(`/${kind}`)) fail(`wrong ${kind} media relationship type`)
  try {
    return {
      id,
      partUri: resolveTarget(context.source.partUri, relationValue(relation, 'Target')),
    }
  } catch {
    fail(`unsafe ${kind} media relationship`)
  }
}

function parseTrim(media, fail) {
  const trims = media.children.filter((entry) => entry.uri === P14 && entry.local === 'trim')
  if (trims.length > 1 || media.children.some((entry) => entry.uri !== P14 || entry.local !== 'trim')) {
    fail('unsupported media trim declarations')
  }
  if (!trims.length) return undefined
  const trim = trims[0]
  if (trim.children.length || trim.attrs.some((entry) => !/^xmlns(?::|$)/.test(entry.name) && !['st', 'end'].includes(entry.name))) {
    fail('invalid media trim')
  }
  const result = {}
  for (const [attribute, field] of [
    ['st', 'startMs'],
    ['end', 'endMs'],
  ]) {
    const raw = attr(trim, attribute)
    if (raw === null) continue
    const decoded = decodeXml(raw)
    const amount = Number(decoded)
    if (decoded === '' || !Number.isFinite(amount) || amount < 0) fail('invalid media trim')
    result[field] = amount
  }
  return result
}

function componentId(context, node, fail) {
  const matches = context.components.filter(
    (entry) => entry.kind === 'media-segment' && context.nodes.get(entry.id) === node
  )
  if (matches.length !== 1) fail('missing/ambiguous media component identity')
  return matches[0].id
}

async function readSemanticMedia(context, failSource) {
  const reject = (detail) => failSource(context.source, detail)
  const declarations = descendants(
    context.node,
    (entry) => A_URIS.has(entry.uri) && ['audioFile', 'videoFile'].includes(entry.local)
  )
  if (declarations.length !== 1) reject('missing/ambiguous media declaration')
  const declaration = declarations[0]
  if (declaration.children.length || declaration.attrs.some((entry) => !/^xmlns(?::|$)/.test(entry.name) && !entry.name.endsWith(':link'))) {
    reject('invalid media declaration')
  }
  const mediaType = declaration.local === 'audioFile' ? 'audio' : 'video'
  const modern = descendants(context.node, (entry) => entry.uri === P14 && entry.local === 'media')
  if (modern.length !== 1) reject('missing/ambiguous embedded media declaration')
  if (modern[0].attrs.some((entry) => !/^xmlns(?::|$)/.test(entry.name) && !entry.name.endsWith(':embed'))) {
    reject('invalid embedded media declaration')
  }

  const legacyId = relationshipId(declaration, 'link', reject)
  const embeddedId = relationshipId(modern[0], 'embed', reject)
  const legacy = internalRelationship(context, legacyId, mediaType, reject)
  const embedded = internalRelationship(context, embeddedId, 'media', reject)
  if (legacy.partUri !== embedded.partUri) reject('media relationship targets disagree')

  const mediaPart = context.inventory.parts.find((part) => part.partUri === embedded.partUri)
  if (!mediaPart) reject('missing inventoried media part')
  const media = await persistMediaBlob(
    context.mediaIndex,
    embedded.partUri,
    context.uploadsDir,
    context.mediaOptions
  )
  if (!media.url) reject(`media admission ${media.warning?.code || 'failed'}`)

  const blipFills = context.node.children.filter(
    (entry) => P_URIS.has(entry.uri) && entry.local === 'blipFill'
  )
  const blips = blipFills.length === 1
    ? blipFills[0].children.filter((entry) => A_URIS.has(entry.uri) && entry.local === 'blip')
    : []
  if (blips.length !== 1) reject('missing/ambiguous media poster')
  const posterId = relationshipId(blips[0], 'embed', reject)
  const posterRelationship = internalRelationship(context, posterId, 'image', reject)
  const posterPart = context.inventory.parts.find(
    (part) => part.partUri === posterRelationship.partUri
  )
  if (!posterPart) reject('missing inventoried media poster')
  const poster = await persistZipMediaRef(
    context.mediaIndex,
    posterRelationship.partUri,
    context.uploadsDir,
    context.mediaOptions
  )
  if (!poster.url || poster.unsupportedBrowserImage) {
    reject(`media poster admission ${poster.warning?.code || 'failed'}`)
  }
  const trim = parseTrim(modern[0], reject)

  return {
    mediaType,
    compatibility: {
      type: mediaType,
      src: media.url,
      poster: poster.url,
      autoplay: false,
      loop: false,
      muted: false,
      ...(trim?.startMs === undefined ? {} : { startTime: trim.startMs / 1000 }),
      ...(trim?.endMs === undefined ? {} : { endTime: trim.endMs / 1000 }),
    },
    document: {
      schemaVersion: 1,
      mediaType,
      legacyComponentId: componentId(context, declaration, reject),
      embeddedComponentId: componentId(context, modern[0], reject),
      asset: {
        partUri: embedded.partUri,
        legacyRelationshipId: legacyId,
        embeddedRelationshipId: embeddedId,
        sha256: mediaPart.preconditionHash,
        src: media.url,
      },
      poster: {
        partUri: posterRelationship.partUri,
        relationshipId: posterId,
        sha256: posterPart.preconditionHash,
        src: poster.url,
      },
      ...(trim === undefined ? {} : { trim }),
    },
  }
}

module.exports = { readSemanticMedia }
