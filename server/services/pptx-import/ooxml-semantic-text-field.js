const { A_URIS, decodeXml, textContent } = require('./ooxml-text-run-xml')
const { runProperties } = require('./ooxml-semantic-table-text-properties')
const { normalizeTextProperties } = require('../../../shared/src/pptx-text-document')

// Source extraction only: no evaluated values, inherited proofing or opaque XML.
function readSemanticTextField(node, paragraphId, context, fail) {
  const matches = context.components.filter((item) => context.nodes.get(item.id) === node)
  const source = matches[0] || context.source
  if (
    matches.length !== 1 ||
    source.kind !== 'text-field' ||
    source.parentDefinitionId !== paragraphId ||
    source.partUri !== context.source.partUri ||
    source.preconditionHash !== context.source.preconditionHash
  )
    fail(source, 'invalid field source association')
  const invalid = (detail) => fail(source, `invalid/unsupported field ${detail}`)
  const attributes = (entry, allowed) => {
    const result = {}
    for (const attribute of entry.attrs) {
      if (attribute.name === 'xmlns' || attribute.name.startsWith('xmlns:')) continue
      if (!allowed.includes(attribute.name) || Object.hasOwn(result, attribute.name))
        invalid(`${entry.local} attribute ${attribute.name}`)
      const decoded = decodeXml(attribute.value)
      if (decoded === null) invalid(`${entry.local} attribute entity`)
      result[attribute.name] = decoded
    }
    return result
  }
  const container = (entry) => {
    if (entry.selfClosing) return
    let cursor = entry.end + 1
    for (const child of entry.children) {
      if (context.xml.slice(cursor, child.start).trim()) invalid(`${entry.local} text`)
      cursor = child.closeEnd + 1
    }
    if (context.xml.slice(cursor, entry.closeStart).trim()) invalid(`${entry.local} text`)
  }
  const boolean = (value) => {
    if (!['0', '1', 'false', 'true'].includes(value)) invalid('boolean')
    return value === '1' || value === 'true'
  }
  const field = attributes(node, ['id', 'type'])
  if (!field.id || !field.type) invalid('id/type')
  container(node)
  // Optional rPr, optional empty pPr, then exactly one cached t.
  const names = node.children.map((entry) => entry.local).join(',')
  if (
    !['t', 'pPr,t', 'rPr,t', 'rPr,pPr,t'].includes(names) ||
    node.children.some((entry) => !A_URIS.has(entry.uri))
  )
    invalid('children')
  const parseRunEntry = (entry) => {
    container(entry)
    const resultProps = {}
    let resultProofing
    const authored = attributes(entry, ['sz', 'b', 'i', 'lang', 'altLang', 'smtClean', 'kumimoji', 'cap', 'normalizeH'])
    for (const [name, value] of Object.entries(authored)) {
      if (name === 'smtClean') resultProofing = { smtClean: boolean(value) }
      else if (name === 'sz') {
        if (!/^\d+$/.test(value)) invalid('font size')
        resultProps.fontSizePt = Number(value) / 100
      } else if (name === 'lang') {
        if (!/^[a-zA-Z]{1,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(value)) invalid('language')
        resultProps.language = value
      } else if (name === 'altLang') {
        if (!/^[a-zA-Z]{1,8}(?:-[a-zA-Z0-9]{1,8})*$/.test(value)) invalid('altLanguage')
        resultProps.altLanguage = value
      } else if (name === 'cap') {
        if (!['none', 'small', 'all'].includes(value)) invalid('capitalization')
        resultProps.capitalization = value
      } else if (name === 'kumimoji' || name === 'normalizeH')
        resultProps[name === 'kumimoji' ? 'kumimoji' : 'normalizeHeight'] = boolean(value)
      else resultProps[name === 'b' ? 'bold' : 'italic'] = boolean(value)
    }
    if (
      entry.children.length > 1 ||
      entry.children.some((child) => !A_URIS.has(child.uri) || child.local !== 'latin')
    )
      invalid(`${entry.local} properties`)
    if (entry.children.length) {
      const latin = entry.children[0]
      container(latin)
      if (latin.children.length) invalid('font children')
      const font = attributes(latin, ['typeface'])
      if (!font.typeface) invalid('font typeface')
      resultProps.fontLatin = font
    }
    return { properties: resultProps, ...(resultProofing ? { proofing: resultProofing } : {}) }
  }

  let defaultProperties = {}
  let defaultProofing
  const paragraphProperties = node.children.find((entry) => entry.local === 'pPr')
  if (paragraphProperties) {
    attributes(paragraphProperties, [])
    container(paragraphProperties)
    if (
      paragraphProperties.children.length > 1 ||
      paragraphProperties.children.some((entry) => !A_URIS.has(entry.uri) || entry.local !== 'defRPr')
    )
      invalid('paragraph properties')
    const defRPr = paragraphProperties.children.find((entry) => entry.local === 'defRPr')
    if (defRPr) {
      const parsedDef = parseRunEntry(defRPr)
      defaultProperties = parsedDef.properties
      defaultProofing = parsedDef.proofing
    }
  }
  const textNode = node.children.at(-1)
  const textAttributes = attributes(textNode, ['xml:space'])
  if (
    textNode.children.length ||
    (Object.hasOwn(textAttributes, 'xml:space') &&
      !['default', 'preserve'].includes(textAttributes['xml:space']))
  )
    invalid('cached text')
  const result = { componentId: source.id, kind: 'field', field, properties: {} }
  try {
    result.text = textContent(context.xml, textNode)
  } catch (error) {
    invalid(error.message)
  }

  let directProperties = {}
  let directProofing
  let directHyperlinks
  const run = node.children.find((entry) => entry.local === 'rPr')
  if (run) {
    if (run.children.some((entry) => ['hlinkClick', 'hlinkMouseOver'].includes(entry.local))) {
      const parsedRun = runProperties(run, context, true, source.id)
      directProperties = parsedRun.properties || {}
      directProofing = parsedRun.proofing
      directHyperlinks = parsedRun.hyperlinks
    } else {
      const parsedRun = parseRunEntry(run)
      directProperties = parsedRun.properties
      directProofing = parsedRun.proofing
    }
  }

  result.properties = { ...defaultProperties, ...directProperties }
  const mergedProofing = { ...(defaultProofing || {}), ...(directProofing || {}) }
  if (Object.keys(mergedProofing).length) result.proofing = mergedProofing
  if (directHyperlinks) result.hyperlinks = directHyperlinks

  try {
    normalizeTextProperties(result.properties, 'run')
  } catch (error) {
    invalid(error.message)
  }
  return result
}

module.exports = { readSemanticTextField }
