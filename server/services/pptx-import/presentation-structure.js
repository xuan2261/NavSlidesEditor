const crypto = require('node:crypto')
const JSZip = require('jszip')
const { resolveTarget } = require('./package-store/raw-zip')
const capabilities = require('./presentation-capabilities')

const attr = (tag, name) => tag.match(new RegExp(`(?:\\w+:)?${name}=(?:"([^"]*)"|'([^']*)')`))?.slice(1)
  .find((value) => value !== undefined)
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex')

function relationships(xml, source) {
  return [...xml.matchAll(/<(?:\w+:)?Relationship\b[^>]*\/?>/g)].map((match) => {
    const id = attr(match[0], 'Id')
    const target = attr(match[0], 'Target')
    const external = attr(match[0], 'TargetMode') === 'External'
    return { id, target, external, partUri: external ? null : resolveTarget(source, target) }
  })
}

function descriptors(zip, slide, slideXml, rels) {
  const candidates = [
    ['hidden-state', /\bshow=(?:"0"|'0')/],
    ['transitions', /<(?:\w+:)?transition\b/],
    ['timing-trees', /<(?:\w+:)?timing\b/],
    ['media-behavior', /<(?:\w+:)?(?:audio|video|cmd)\b/],
  ]
  const rows = candidates.filter(([, pattern]) => pattern.test(slideXml))
    .map(([id]) => ({ id, sourcePartUri: slide.partUri, editable: false }))
  for (const rel of rels) {
    const feature = rel.external ? 'external-hyperlinks'
      : rel.partUri?.includes('/notesSlides/') ? 'rich-notes'
        : rel.partUri?.includes('/comments/') ? 'comments'
          : rel.partUri?.includes('/slides/') ? 'internal-hyperlinks' : null
    if (feature) rows.push({ id: feature, sourcePartUri: rel.external ? slide.partUri : rel.partUri,
      editable: false })
  }
  return rows
}

async function inspectPresentationStructure(bytes) {
  const zip = await JSZip.loadAsync(bytes)
  const presentationXml = await zip.file('ppt/presentation.xml').async('text')
  const relsXml = await zip.file('ppt/_rels/presentation.xml.rels').async('text')
  const rels = relationships(relsXml, 'ppt/presentation.xml')
  const byId = new Map(rels.map((rel) => [rel.id, rel]))
  const slides = []
  const preserveOnly = []
  for (const match of presentationXml.matchAll(/<(?:\w+:)?sldId\b[^>]*\/?>/g)) {
    const relationshipId = match[0].match(/\br:id=(?:"([^"]*)"|'([^']*)')/)?.slice(1)
      .find((value) => value !== undefined)
    const nativeId = match[0].match(/(?:^|\s)id=(?:"([^"]*)"|'([^']*)')/)?.slice(1)
      .find((value) => value !== undefined)
    const partUri = byId.get(relationshipId)?.partUri
    if (!partUri || !zip.file(partUri)) throw new Error(`Dangling presentation slide: ${relationshipId}`)
    const slideXml = await zip.file(partUri).async('text')
    const relPath = `${partUri.slice(0, partUri.lastIndexOf('/'))}/_rels/${partUri.split('/').pop()}.rels`
    const slideRels = zip.file(relPath) ? relationships(await zip.file(relPath).async('text'), partUri) : []
    const dangling = slideRels.find((rel) => !rel.external && !zip.file(rel.partUri))
    if (dangling) throw new Error(`Dangling slide relationship: ${dangling.id}`)
    const slide = { partUri, relationshipId, nativeId }
    slides.push(Object.freeze(slide))
    preserveOnly.push(...descriptors(zip, slide, slideXml, slideRels))
  }
  for (const [id, pattern] of [['sections', /<(?:\w+:)?sectionLst\b/],
    ['custom-shows', /<(?:\w+:)?customShowLst\b/],
    ['presentation-settings', /<(?:\w+:)?showPr\b|<(?:\w+:)?presentationPr\b/]]) {
    if (pattern.test(presentationXml)) preserveOnly.push({ id, sourcePartUri: 'ppt/presentation.xml',
      editable: false })
  }
  return Object.freeze({ schemaVersion: 1, slides: Object.freeze(slides),
    preserveOnly: Object.freeze(preserveOnly), capabilities, packageHash: hash(bytes) })
}

module.exports = { inspectPresentationStructure, relationships }
