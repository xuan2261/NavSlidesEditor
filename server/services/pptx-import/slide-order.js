const { parseXml, descendants, attr, decodeXml, P_URIS } = require('./ooxml-text-run-xml')
const { resolveTarget } = require('./package-store/raw-zip')
const { PptxImportError } = require('./diagnostics')
const { compareParserParts, relationshipPart } = require('./parser-part-names')

function numericSlideOrder(parts) {
  return [...parts].sort(compareParserParts)
}

async function readSlideOrder(zip) {
  const fallback = numericSlideOrder(
    Object.keys(zip?.files || {}).filter((part) => /^ppt\/slides\/slide\d+\.xml$/i.test(part))
  )
  const presentation = zip?.file?.('ppt/presentation.xml')
  if (!presentation) return fallback
  const roots = parseXml(await presentation.async('string'))
  const root = roots.find((node) => node.local === 'presentation' && P_URIS.has(node.uri))
  const lists =
    root?.children.filter((node) => node.local === 'sldIdLst' && P_URIS.has(node.uri)) || []
  // Synthetic mapper fixtures can omit the presentation list.
  if (!lists.length) return fallback
  const ids = lists[0].children.filter((node) => node.local === 'sldId' && P_URIS.has(node.uri))
  const relFile = zip.file('ppt/_rels/presentation.xml.rels')
  const rels = relFile
    ? descendants(
        { children: parseXml(await relFile.async('string')) },
        (node) => node.local === 'Relationship'
      )
    : []
  const parts = ids.map((node) => {
    const idAttribute = node.attrs.find(
      (item) =>
        item.name.includes(':') &&
        item.name.split(':')[1] === 'id' &&
        /\/relationships$/.test(node.namespaces[item.name.split(':')[0]] || '')
    )
    const id = decodeXml(idAttribute?.value || '')
    const matches = rels.filter(
      (rel) => attr(rel, 'Id') === id && /\/slide$/.test(attr(rel, 'Type') || '')
    )
    const rel = matches.length === 1 ? matches[0] : null
    const part =
      rel && attr(rel, 'TargetMode') !== 'External'
        ? resolveTarget('ppt/presentation.xml', decodeXml(attr(rel, 'Target') || ''))
        : null
    if (!part || !zip.file(part))
      throw new PptxImportError('Presentation slide relationship is unavailable')
    return part
  })
  if (new Set(parts).size !== parts.length)
    throw new PptxImportError('Presentation contains duplicate slide relationships')
  return parts
}

async function orderParserSlides(output, zip) {
  const types = parseXml(await zip.file('[Content_Types].xml').async('string'))
  const parserParts = numericSlideOrder(
    descendants(
      { children: types },
      (node) =>
        node.local === 'Override' &&
        attr(node, 'ContentType') ===
          'application/vnd.openxmlformats-officedocument.presentationml.slide+xml'
    ).map((node) => decodeXml(attr(node, 'PartName')).replace(/^\//, ''))
  )
  if (parserParts.length !== output.slides.length)
    throw new PptxImportError('Parser slide identities are unavailable')
  const byPart = new Map(parserParts.map((part, index) => [part, output.slides[index]]))
  output.slides = (await readSlideOrder(zip)).map((part) => {
    const slide = byPart.get(part)
    if (!slide) throw new PptxImportError('Presentation slide is missing from parser output')
    return slide
  })
}

module.exports = { readSlideOrder, orderParserSlides, relationshipPart }
