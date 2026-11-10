const { textContent } = require('./ooxml-text-run-xml')
const { readSemanticTextField } = require('./ooxml-semantic-text-field')
const { normalizeTextDocument } = require('../../../shared/src/pptx-text-document')
const {
  runProperties,
  bodyProperties,
} = require('./ooxml-semantic-table-text-properties')
const { listParagraphProperties } = require('./ooxml-semantic-text-list-style-properties')


function validateFieldChildren(entry, source) {
  // The shared field reader reports its owning field. Preflight its exact
  // supported children here so errors retain the offending descendant locator.
  source.children(entry, ['rPr', 'pPr', 't'])
  const names = entry.children.map((child) => child.local).join(',')
  if (!['t', 'rPr,t', 'pPr,t', 'rPr,pPr,t'].includes(names))
    source.fail(entry, 'invalid field child sequence')
  for (const child of entry.children) {
    if (child.local === 'rPr') {
      source.attrs(child, ['sz', 'b', 'i', 'lang', 'smtClean', 'kumimoji', 'cap', 'normalizeH'])
      source.children(child, ['latin', 'hlinkClick', 'hlinkMouseOver'])
      for (const font of child.children) {
        if (font.local !== 'latin') continue
        source.children(font)
        const attributes = source.attrs(font, ['typeface'])
        if (!attributes.typeface || attributes.typeface.length > 1024)
          source.fail(font, 'invalid field font')
      }
      if (!child.children.some((n) => n.local.startsWith('hlink'))) runProperties(child, source, true)
    } else if (child.local === 'pPr') {
      source.attrs(child)
      source.children(child)
    } else {
      const attributes = source.attrs(child, ['xml:space'])
      if (
        child.children.length ||
        (attributes['xml:space'] !== undefined &&
          !['default', 'preserve'].includes(attributes['xml:space']))
      )
        source.fail(child, 'invalid field cached text')
      source.checked(child, () => textContent(source.xml, child))
    }
  }
}
function tableTextListStyle(node, source) {
  source.attrs(node)
  source.children(node, ['defPPr', ...Array.from({ length: 9 }, (_, index) => `lvl${index + 1}pPr`)])
  const style = { levels: [] }
  for (const entry of node.children) {
    const declaration = listParagraphProperties(entry, source)
    if (entry.local === 'defPPr') style.default = declaration
    else style.levels[Number(entry.local[3]) - 1] = declaration
  }
  return style
}

function applyTableTextListStyle(paragraph, style) {
  if (!style) return paragraph
  const declarations = [style.default, style.levels[paragraph.properties?.level ?? 0]].filter(Boolean)
  for (const key of ['properties', 'defaultRunProperties']) {
    const merged = Object.assign({}, ...declarations.map((entry) => entry[key] ?? {}), paragraph[key] ?? {})
    if (Object.keys(merged).length) paragraph[key] = merged
  }
  return paragraph
}


function readTableText(node, cellId, source) {
  source.attrs(node)
  source.children(node, ['bodyPr', 'lstStyle', 'p'], ['p'])
  const names = node.children.map((entry) => entry.local).join(',')
  if (!/^bodyPr,(?:lstStyle,)?p(?:,p)*$/.test(names))
    source.fail(node, 'invalid text body sequence')
  const body = bodyProperties(source.required(node, 'bodyPr'), source)
  const list = node.children.find((entry) => entry.local === 'lstStyle')
  const listStyle = list ? tableTextListStyle(list, source) : undefined
  const paragraphs = node.children
    .filter((entry) => entry.local === 'p')
    .map((paragraph) => {
      source.attrs(paragraph)
      source.children(paragraph, ['pPr', 'r', 'br', 'fld', 'endParaRPr'], ['r', 'br', 'fld'])
      const componentId = source.bind(paragraph, 'paragraph', cellId, 'paragraph')
      const result = { componentId, runs: [] }
      for (const [index, entry] of paragraph.children.entries()) {
        if (entry.local === 'pPr') {
          if (index !== 0) source.fail(entry, 'paragraph properties out of order')
          Object.assign(result, listParagraphProperties(entry, source))
        } else if (entry.local === 'endParaRPr') {
          if (index !== paragraph.children.length - 1)
            source.fail(entry, 'end properties out of order')
          const endRun = runProperties(entry, source, true)
          result.endRunProperties = endRun.properties
          if (endRun.proofing) result.endRunProofing = endRun.proofing
        } else if (entry.local === 'fld') {
          source.bind(entry, 'text-field', componentId, 'run')
          validateFieldChildren(entry, source)
          const field = source.checked(entry, () =>
            readSemanticTextField(entry, componentId, source, (item, detail) =>
              source.fail(source.nodes.get(item.id) || entry, detail)
            )
          )
          // Validate the public field reader's canonical result at its source node,
          // before whole-body validation would lose the precise failure location.
          source.checked(entry, () =>
            normalizeTextDocument({
              schemaVersion: 1,
              componentId: cellId,
              paragraphs: [{ componentId, runs: [field] }],
            })
          )
          result.runs.push(field)
        } else {
          source.attrs(entry)
          source.children(entry, entry.local === 'br' ? ['rPr'] : ['rPr', 't'])
          const sequence = entry.children.map((child) => child.local).join(',')
          if (entry.local === 'r' && !['t', 'rPr,t'].includes(sequence))
            source.fail(entry, 'invalid run sequence')
          const run = {
            componentId:
              entry.local === 'br'
                ? source.component(entry, 'run')
                : source.bind(entry, 'text-run', componentId, 'run'),
            kind: entry.local === 'br' ? 'break' : 'text',
          }
          const properties = entry.children.find((child) => child.local === 'rPr')
          if (properties) Object.assign(run, runProperties(properties, source, true, run.componentId))
          if (entry.local === 'r') {
            const text = source.required(entry, 't'),
              a = source.attrs(text, ['xml:space'])
            if (
              text.children.length ||
              (a['xml:space'] !== undefined && !['preserve', 'default'].includes(a['xml:space']))
            )
              source.fail(text, 'invalid text content')
            run.text = source.checked(text, () => textContent(source.xml, text))
          }
          result.runs.push(run)
        }
      }
      return applyTableTextListStyle(result, listStyle)
    })
  return source.checked(node, () =>
    normalizeTextDocument({
      schemaVersion: 1,
      componentId: source.component(node, 'property'),
      body,
      paragraphs,
    })
  )
}
module.exports = { readTableText }
