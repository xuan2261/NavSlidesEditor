const { P_URIS, textContent } = require('./ooxml-text-run-xml')
const { child } = require('./ooxml-native-text-style-source')
const { tableSource } = require('./ooxml-semantic-table-source')
const { readSemanticTextBody } = require('./ooxml-semantic-text-body')
const { readSemanticTextListStyle } = require('./ooxml-semantic-text-list-style')
const { listParagraphProperties } = require('./ooxml-semantic-text-list-style-properties')
const { runProperties } = require('./ooxml-semantic-table-text-properties')
const { readSemanticTextField } = require('./ooxml-semantic-text-field')
const { normalizeTextDocument } = require('../../../shared/src/pptx-text-document')
const { isEquationEntry, validateParagraphChildren, createInlineEquationReader } = require('./ooxml-semantic-text-equation')

// Source declarations only. Host-dependent inheritance stays in occurrence contexts.
function readSemanticTextAdmission(context, fail) {
  const { node, source, components, nodes, xml } = context
  const txBody = child(node, 'txBody', P_URIS)
  const body = readSemanticTextBody(txBody, context, fail)
  if (!txBody) return null
  const boundary = tableSource(context)
  boundary.attrs(txBody)
  boundary.children(txBody, ['bodyPr', 'lstStyle', 'p'], ['p'])
  const names = txBody.children.map((n) => n.local).join(',')
  if (!/^(?:bodyPr,)?(?:lstStyle,)?p(?:,p)*$/.test(names))
    boundary.fail(txBody, 'invalid text body sequence')
  const list = source.kind === 'shape' ? readSemanticTextListStyle(context) : undefined
  const otherList = child(txBody, 'lstStyle')
  if (!list && otherList) {
    boundary.attrs(otherList)
    boundary.children(otherList)
  }
  const bindings = [...(list?.components || [])]
  const mapped = new Set(list?.mappedDefinitionIds || [])
  const readEquation = createInlineEquationReader(context, boundary)
  const component = (entry, kind, parentId) => {
    const matches = components.filter((c) => nodes.get(c.id) === entry)
    if (matches.length !== 1) boundary.fail(entry, 'missing/ambiguous text component')
    const item = matches[0]
    mapped.add(item.id)
    return boundary.bind(entry, kind, parentId, kind === 'paragraph' ? 'paragraph' : 'run')
  }
  const properties = (entry, runId) => {
    if (!entry) return {}
    return runProperties(entry, boundary, true, runId)
  }
  const paragraphs = txBody.children
    .filter((n) => n.local === 'p')
    .map((paragraph) => {
      boundary.attrs(paragraph)
      validateParagraphChildren(paragraph, boundary)
      const declaration = child(paragraph, 'pPr')
      const end = child(paragraph, 'endParaRPr')
      if (
        (declaration && paragraph.children[0] !== declaration) ||
        (end && paragraph.children.at(-1) !== end)
      )
        boundary.fail(paragraph, 'invalid paragraph property association')
      const paragraphId = component(paragraph, 'paragraph', source.id)
      const parsed = declaration ? listParagraphProperties(declaration, boundary) : {}
      const runs = paragraph.children
        .filter((n) => ['r', 'br', 'fld'].includes(n.local) || isEquationEntry(n))
        .map((run) => {
          if (isEquationEntry(run)) {
            const equation = readEquation(run, paragraphId)
            bindings.push(...equation.components)
            for (const id of equation.mappedDefinitionIds) mapped.add(id)
            return equation.run
          }
          if (run.local === 'fld') {
            const field = readSemanticTextField(run, paragraphId, boundary, fail)
            component(run, 'text-field', paragraphId)
            return field
          }
          if (run.local === 'br') {
            boundary.attrs(run)
            boundary.children(run, ['rPr'])
            const runId = boundary.component(run, 'run')
            return {
              componentId: runId,
              kind: 'break',
              properties: {},
              ...properties(child(run, 'rPr'), runId),
            }
          }
          boundary.attrs(run)
          boundary.children(run, ['rPr', 't'])
          if (!['t', 'rPr,t'].includes(run.children.map((n) => n.local).join(',')))
            boundary.fail(run, 'invalid run child sequence')
          const text = boundary.required(run, 't')
          const attrs = boundary.attrs(text, ['xml:space'])
          if (
            text.children.length ||
            (attrs['xml:space'] !== undefined &&
              !['default', 'preserve'].includes(attrs['xml:space']))
          )
            boundary.fail(text, 'invalid run text')
          const runId = component(run, 'text-run', paragraphId)
          return {
            componentId: runId,
            kind: 'text',
            text: textContent(xml, text),
            properties: {},
            ...properties(child(run, 'rPr'), runId),
          }
        })
      const endRun = end ? properties(end) : null
      return {
        componentId: paragraphId,
        ...parsed,
        runs,
        ...(endRun
          ? {
              endRunProperties: endRun.properties,
              ...(endRun.proofing ? { endRunProofing: endRun.proofing } : {}),
            }
          : {}),
      }
    })
  const textDocument = boundary.checked(txBody, () =>
    normalizeTextDocument({
      schemaVersion: 1,
      componentId: `${source.nativeId}:body`,
      ...(body ? { body } : {}),
      paragraphs,
    })
  )
  return {
    textDocument,
    ...(list ? { textListStyle: list.listStyle } : {}),
    components: [...bindings, ...boundary.bound().components],
    mappedDefinitionIds: [...new Set([...mapped, ...boundary.bound().mappedDefinitionIds])],
  }
}
module.exports = { readSemanticTextAdmission }
