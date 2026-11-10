const { attr, decodeXml, textContent, descendants, P_URIS, A_URIS } = require('./ooxml-text-run-xml')
const { resolveTarget } = require('./package-store/raw-zip')
const { relationshipPart } = require('./slide-order')
const { SOURCE_PART_IDENTITIES } = require('../../../shared/src/pptx-source-part-identities')

const R = new Set([
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships',
])
const ROOTS = new Set(['sld', 'sldLayout', 'sldMaster', 'notes', 'notesMaster'])
const RELATIONS = new Set(['slideLayout', 'slideMaster', 'theme', 'notesSlide', 'notesMaster'])
const value = (node, name) => decodeXml(attr(node, name) ?? '')
const attributes = (node) => Object.fromEntries((node?.attrs || [])
  .filter((entry) => !/^xmlns(?::|$)/.test(entry.name))
  .map((entry) => [entry.name, decodeXml(entry.value)]))
const notesText = (node, xml) => {
  if (A_URIS.has(node.uri) && node.local === 't') return textContent(xml, node)
  if (A_URIS.has(node.uri) && node.local === 'br') return '\n'
  return node.children.map((child) => notesText(child, xml)).join('')
}

// These immutable source records preserve authored metadata, not browser-rendered
// approximations. A relationship reference always retains its authenticated hash.
function projectSlideMetadata({ inventory, parts, relationships, semantic, dispositions, sourceGuideIds, fail }) {
  const records = new Map(inventory.parts.map((part) => [part.partUri, part]))
  const definitions = new Map()
  const noteParts = new Set()
  const active = new Set()
  const completed = new Set()
  const reject = (partUri, detail) => fail({ partUri }, `slide metadata ${detail}`)
  const one = (partUri, node, local, uris = P_URIS) => {
    const found = (node?.children || []).filter((entry) => entry.local === local)
    if (found.length > 1 || found.some((entry) => !uris.has(entry.uri)))
      reject(partUri, `ambiguous ${local}`)
    return found[0]
  }
  function receipt(partUri, node) {
    const part = parts.get(partUri)
    const source = records.get(partUri)
    if (!part || !source) reject(partUri, 'missing authenticated part')
    let path
    const locate = (candidate, at) => {
      if (candidate === node) path = at
      else candidate.children.forEach((child, index) => locate(child, [...at, index]))
    }
    part.roots.forEach((root, index) => locate(root, [index]))
    if (!path) reject(partUri, 'missing source node')
    return {
      source: { partUri, preconditionHash: source.preconditionHash,
        componentLocator: { path, preconditionHash: source.preconditionHash } },
      attributes: attributes(node),
      xml: part.xml.slice(node.start, node.selfClosing ? node.end + 1 : node.closeEnd + 1),
    }
  }
  function visit(partUri) {
    if (active.has(partUri)) reject(partUri, 'dependency cycle')
    if (completed.has(partUri)) return
    const part = parts.get(partUri)
    const root = part?.roots[0]
    if (!root || part.roots.length !== 1 || !records.has(partUri))
      reject(partUri, 'missing/ambiguous authenticated root')
    active.add(partUri)
    const dependencies = []
    const seen = new Set()
    for (const relation of relationships(partUri)) {
      const type = value(relation, 'Type')
      const kind = [...RELATIONS].find((name) => [...R].some((uri) => type === `${uri}/${name}`))
      // A master enumerates layouts; it does not inherit from them. A notes
      // slide's required back-reference to its slide is not an inheritance edge.
      if (!kind || (root.local === 'sldMaster' && kind === 'slideLayout')) continue
      if (seen.has(kind)) reject(partUri, `ambiguous ${kind} relationship`)
      seen.add(kind)
      if (!['', 'Internal'].includes(value(relation, 'TargetMode')))
        reject(partUri, 'external dependency')
      let targetPartUri
      try { targetPartUri = resolveTarget(partUri, value(relation, 'Target')) }
      catch { reject(partUri, 'unsafe dependency') }
      visit(targetPartUri)
      const expected = { slideLayout: 'sldLayout', slideMaster: 'sldMaster',
        theme: 'theme', notesSlide: 'notes', notesMaster: 'notesMaster' }[kind]
      const target = parts.get(targetPartUri)?.roots[0]
      if (target?.local !== expected || !(kind === 'theme' ? A_URIS : P_URIS).has(target.uri))
        reject(partUri, 'dependency target kind')
      dependencies.push({ relationshipId: value(relation, 'Id'), type, targetPartUri,
        preconditionHash: records.get(targetPartUri).preconditionHash,
        ...(definitions.has(targetPartUri) ? { definitionId: definitions.get(targetPartUri) } : {}),
        relationshipSource: receipt(relationshipPart(partUri), relation).source })
    }
    if (P_URIS.has(root.uri) && ROOTS.has(root.local)) {
      const common = one(partUri, root, 'cSld')
      const background = one(partUri, common, 'bg')
      const headerFooter = one(partUri, root, 'hf')
      const colorMap = one(partUri, root, 'clrMap')
      const colorMapOverride = one(partUri, root, 'clrMapOvr')
      const notes = ['notes', 'notesMaster'].includes(root.local)
      const flags = attributes(root)
      if (!background && !headerFooter && !colorMap && !colorMapOverride && !notes &&
          !Object.keys(flags).length && !dependencies.some((edge) => edge.definitionId)) {
        active.delete(partUri)
        completed.add(partUri)
        return
      }
      const id = `${partUri}#slide-metadata:0`
      const source = receipt(partUri, root).source
      const metadata = { kind: root.local, flags, dependencies,
        ...(background ? { background: receipt(partUri, background) } : {}),
        ...(headerFooter ? { headerFooter: receipt(partUri, headerFooter) } : {}),
        ...(colorMap ? { colorMap: receipt(partUri, colorMap) } : {}),
        ...(colorMapOverride ? { colorMapOverride: receipt(partUri, colorMapOverride) } : {}) }
      if (notes) {
        noteParts.add(partUri)
        metadata.notes = receipt(partUri, root)
        const bodies = descendants(root, (node) => P_URIS.has(node.uri) && node.local === 'sp')
          .filter((shape) => descendants(shape, (node) => P_URIS.has(node.uri) &&
            node.local === 'ph' && value(node, 'type') === 'body').length)
        metadata.notesText = bodies.flatMap((shape) => descendants(shape,
          (node) => A_URIS.has(node.uri) && node.local === 'p')
          .map((paragraph) => notesText(paragraph, part.xml))).join('\n')
      }
      const constituents = notes ? inventory.definitions.filter((entry) => entry.partUri === partUri) : []
      if (notes) metadata.notesDefinitions = constituents.map((entry) => ({
        id: entry.id, kind: entry.kind, nativeId: entry.nativeId,
        parentDefinitionId: entry.parentDefinitionId, locator: entry.componentLocators[0],
      }))
      if (semantic.definitions[id]) reject(partUri, 'duplicate definition')
      semantic.definitions[id] = { id, kind: 'unknown', source,
        content: { slideMetadata: metadata },
        components: constituents.map((entry) => ({ id: entry.id, kind: 'property', locator: entry.componentLocators[0] })) }
      definitions.set(partUri, id)
    }
    active.delete(partUri)
    completed.add(partUri)
  }
  inventory.slides.forEach((slide) => visit(slide.partUri))
  for (const [partUri, part] of parts) {
    const root = part.roots[0]
    if (P_URIS.has(root?.uri) && ['notes', 'notesMaster'].includes(root.local)) visit(partUri)
  }
  // Notes are not slide paint occurrences. Their complete authored source and
  // constituent identities belong to the notes metadata definition instead.
  for (const entry of inventory.definitions.filter((entry) => noteParts.has(entry.partUri))) {
    if (Object.values(SOURCE_PART_IDENTITIES).some((spec) =>
      spec.namespaceUri === entry.namespaceUri && spec.localName === entry.localName)) continue
    if (sourceGuideIds?.has(entry.id)) {
      const mapped = dispositions.get(entry.id)
      if (!mapped || mapped.disposition !== 'semantically-mapped' ||
        mapped.definitionId !== entry.id || mapped.partUri !== entry.partUri ||
        mapped.locator.preconditionHash !== entry.preconditionHash ||
        JSON.stringify(mapped.locator.path) !== JSON.stringify(entry.componentLocators[0].path))
        reject(entry.partUri, 'invalid guide disposition')
      continue
    }
    if (entry.kind === 'unknown-extension') {
      continue
    }
    if (dispositions.has(entry.id)) reject(entry.partUri, 'duplicate notes disposition')
    dispositions.set(entry.id, { definitionId: entry.id, partUri: entry.partUri,
      locator: entry.componentLocators[0], disposition: entry.disposition === 'owner-excluded-preserved'
        ? 'owner-excluded-preserved' : 'semantically-mapped' })
  }
  const slideSources = inventory.slides.map(({ partUri }) => {
    const definitionIds = new Set()
    const collect = (uri) => {
      const id = definitions.get(uri)
      if (!id || definitionIds.has(id)) return
      definitionIds.add(id)
      semantic.definitions[id].content.slideMetadata.dependencies.forEach((edge) => collect(edge.targetPartUri))
    }
    collect(partUri)
    return { definitionIds: [...definitionIds] }
  })
  const slideNotes = inventory.slides.map(({ partUri }) => {
    const metadata = semantic.definitions[definitions.get(partUri)]?.content.slideMetadata
    const edge = metadata?.dependencies.find((entry) => entry.type.endsWith('/notesSlide'))
    return edge && semantic.definitions[edge.definitionId].content.slideMetadata.notesText
  })
  return { slideSources, slideNotes, noteParts }
}

module.exports = { projectSlideMetadata }
