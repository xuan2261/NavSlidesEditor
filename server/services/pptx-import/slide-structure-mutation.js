const JSZip = require('jszip')
const { inspectPresentationStructure, relationships } = require('./presentation-structure')

const SLIDE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'
const q = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const relPath = (part) => `${part.slice(0, part.lastIndexOf('/'))}/_rels/${part.split('/').pop()}.rels`

async function text(zip, path) {
  const entry = zip.file(path)
  return entry ? entry.async('text') : null
}

function replaceList(xml, tags) {
  const body = tags.join('')
  if (/<(?:\w+:)?sldIdLst\b[^>]*>[\s\S]*?<\/(?:\w+:)?sldIdLst>/.test(xml)) {
    return xml.replace(/(<(?:\w+:)?sldIdLst\b[^>]*>)[\s\S]*?(<\/(?:\w+:)?sldIdLst>)/,
      `$1${body}$2`)
  }
  return xml.replace(/(<(?:\w+:)?presentation\b[^>]*>)/, `$1<p:sldIdLst>${body}</p:sldIdLst>`)
}

function removeRelationship(xml, id) {
  return xml.replace(new RegExp(`<(?:\\w+:)?Relationship\\b(?=[^>]*\\bId=["']${q(id)}["'])[^>]*/>`, 'g'), '')
}

function nextPart(model, zip) {
  const used = new Set(model.slides.map((slide) => slide.partUri))
  let index = 1
  while (used.has(`ppt/slides/slide${index}.xml`) || zip.file(`ppt/slides/slide${index}.xml`)) index += 1
  return `ppt/slides/slide${index}.xml`
}

function nextRel(model) {
  const used = new Set(model.slides.map((slide) => slide.relationshipId))
  let index = 1
  while (used.has(`rId${index}`)) index += 1
  return `rId${index}`
}

function addContentType(xml, part) {
  if (xml.includes(`PartName="/${part}"`)) return xml
  const value = `<Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
  return xml.replace(/<\/(?:\w+:)?Types>/, `${value}</Types>`)
}

async function referencesTo(zip, targetPart) {
  const found = []
  for (const path of Object.keys(zip.files).filter((name) => name.endsWith('.rels'))) {
    const xml = await text(zip, path)
    const source = path === 'ppt/_rels/presentation.xml.rels' ? 'ppt/presentation.xml'
      : path.replace('/_rels/', '/').replace(/\.rels$/, '')
    for (const rel of relationships(xml, source)) {
      if (!rel.external && rel.partUri === targetPart) found.push({ path, id: rel.id })
    }
  }
  return found
}

async function applyDelete(zip, model, operation, changed) {
  if (model.slides.length === 1) throw new Error('Cannot delete the final slide')
  const slide = model.slides.find((item) => item.partUri === operation.slidePartUri)
  if (!slide) throw new Error('Slide part is missing')
  const refs = (await referencesTo(zip, slide.partUri))
    .filter((ref) => ref.path !== 'ppt/_rels/presentation.xml.rels')
  const presentation = await text(zip, 'ppt/presentation.xml')
  const customReferenced = new RegExp(`<(?:\\w+:)?sld\\b[^>]*\\br:id=["']${q(slide.relationshipId)}["']`).test(presentation)
  if ((refs.length || customReferenced) && operation.referencePolicy !== 'repair') {
    throw new Error('Slide is referenced by an internal hyperlink or custom show')
  }
  for (const ref of refs) {
    zip.file(ref.path, removeRelationship(await text(zip, ref.path), ref.id))
    changed.add(ref.path)
  }
  const cleaned = presentation.replace(new RegExp(`<(?:\\w+:)?sld\\b[^>]*\\br:id=["']${q(slide.relationshipId)}["'][^>]*/>`, 'g'), '')
  const remaining = model.slides.filter((item) => item !== slide)
  zip.file('ppt/presentation.xml', replaceList(cleaned, remaining.map(tag)))
  const relsPath = 'ppt/_rels/presentation.xml.rels'
  zip.file(relsPath, removeRelationship(await text(zip, relsPath), slide.relationshipId))
  zip.remove(slide.partUri)
  if (zip.file(relPath(slide.partUri))) zip.remove(relPath(slide.partUri))
  changed.add('ppt/presentation.xml').add(relsPath).add(slide.partUri)
}

const tag = (slide) => `<p:sldId id="${slide.nativeId}" r:id="${slide.relationshipId}"/>`

module.exports = { mutateSlideStructure: async function mutateSlideStructure(bytes, operation) {
  const zip = await JSZip.loadAsync(bytes)
  const model = await inspectPresentationStructure(bytes)
  const changed = new Set()
  if (operation.kind === 'slide-delete') await applyDelete(zip, model, operation, changed)
  else {
    let slides = [...model.slides]
    if (operation.kind === 'slide-reorder') {
      if (operation.slidePartUris.length !== slides.length ||
          new Set(operation.slidePartUris).size !== slides.length ||
          operation.slidePartUris.some((part) => !slides.some((slide) => slide.partUri === part))) {
        throw new Error('Reorder must contain every slide exactly once')
      }
      slides = operation.slidePartUris.map((part) => slides.find((slide) => slide.partUri === part))
    } else if (operation.kind === 'slide-add' || operation.kind === 'slide-duplicate') {
      const source = slides.find((slide) => slide.partUri === operation.slidePartUri)
      if (operation.kind === 'slide-duplicate' && !source) throw new Error('Source slide is missing')
      const created = { partUri: nextPart(model, zip), relationshipId: nextRel(model),
        nativeId: String(Math.max(255, ...slides.map((slide) => Number(slide.nativeId))) + 1) }
      const at = source ? slides.indexOf(source) + 1 : (operation.index ?? slides.length)
      slides.splice(at, 0, created)
      zip.file(created.partUri, source ? await text(zip, source.partUri)
        : '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree/></p:cSld></p:sld>')
      if (source && zip.file(relPath(source.partUri))) {
        zip.file(relPath(created.partUri), await text(zip, relPath(source.partUri)))
      }
      const types = '[Content_Types].xml'
      zip.file(types, addContentType(await text(zip, types), created.partUri))
      const relsPath = 'ppt/_rels/presentation.xml.rels'
      const rel = `<Relationship Id="${created.relationshipId}" Type="${SLIDE_REL}" Target="${created.partUri.slice(4)}"/>`
      zip.file(relsPath, (await text(zip, relsPath)).replace(/<\/(?:\w+:)?Relationships>/,
        `${rel}</Relationships>`))
      changed.add(created.partUri).add(types).add(relsPath)
    } else throw new Error(`Unsupported slide structure operation: ${operation.kind}`)
    const path = 'ppt/presentation.xml'
    const original = await text(zip, path)
    const updated = replaceList(original, slides.map(tag))
    if (updated !== original) {
      zip.file(path, updated)
      changed.add(path)
    }
  }
  const output = await zip.generateAsync({ type: 'nodebuffer' })
  await inspectPresentationStructure(output)
  const preservedParts = Object.keys(zip.files).filter((path) =>
    /notesSlides|comments/.test(path) && !changed.has(path))
  return Object.freeze({ bytes: output, changedParts: Object.freeze([...changed].sort()),
    preservedParts: Object.freeze(preservedParts.sort()) })
} }
