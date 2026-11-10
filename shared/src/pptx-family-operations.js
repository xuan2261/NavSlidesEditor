const { cloneFamilyData } = require('./pptx-family-operations-data')
const { assertTableOccurrenceIdentity } = require('./pptx-table-operations-identity')
const { applyTableOperation } = require('./pptx-table-operations')
const { applyChartOperation } = require('./pptx-chart-operations')
const { applySmartArtOperation } = require('./pptx-smartart-operations')
const { applyOmmlOperation } = require('./pptx-omml-operations')
const { normalizeTableDocument } = require('./pptx-table-document')
const { normalizeChartDocument } = require('./pptx-chart-document')
const { normalizeSmartArtDocument } = require('./pptx-smartart-document')
const { normalizeOmmlDocument } = require('./pptx-omml-document')
const { expandTextContext } = require('./pptx-semantic-text-context-codec')
const { materializeOmmlFrame } = require('./pptx-omml-source-style')

const { applySvgOperation } = require('./pptx-svg-operations')
const { normalizeSvgDocument } = require('./pptx-svg-document')
const { semanticSvgMarkup } = require('./pptx-svg-render')
const FAMILIES = {
  table: ['tableDocument', 'table', applyTableOperation, normalizeTableDocument],
  chart: ['chartDocument', 'chart', applyChartOperation, normalizeChartDocument],
  smartart: ['smartArtDocument', 'diagram', applySmartArtOperation, normalizeSmartArtDocument],
  omml: ['ommlDocument', 'equation', applyOmmlOperation, normalizeOmmlDocument],
  svg: ['svgDocument', 'svg', applySvgOperation, normalizeSvgDocument],
}
const fail = () => {
  throw new TypeError('Invalid typed semantic family operation')
}
function familyDescriptor(definition) {
  return Object.entries(FAMILIES).find(
    ([, [field, kind]]) => definition?.kind === kind && Object.hasOwn(definition.content, field)
  )
}
function familyOperationType(definition) {
  const descriptor = familyDescriptor(definition)
  return descriptor ? `${descriptor[0]}.edit` : null
}
function familyRootId(definition) {
  const descriptor = familyDescriptor(definition)
  if (!descriptor) return null
  const source = definition.content[descriptor[1][0]]
  return source.componentId ?? source.root?.componentId ?? source.source?.ownerDefinitionId
}
function replay(definition, journal) {
  const descriptor = familyDescriptor(definition)
  if (!descriptor) fail()
  const [family, [field, , reducer]] = descriptor
  if (
    !journal ||
    Object.keys(journal).length !== 2 ||
    journal.family !== family ||
    !Array.isArray(journal.commands) ||
    !journal.commands.length ||
    journal.commands.length > 4096
  )
    fail()
  let effective = definition.content[field]
  // Journal-local ownership includes deleted authored descendants, not just
  // identities still visible in the preceding effective table.
  const tableIdentities = family === 'table' ? new Map() : null
  for (const command of journal.commands) {
    effective = reducer(effective, command)
    if (family === 'table') assertTableOccurrenceIdentity(definition.content[field], effective, tableIdentities)
  }
  return effective
}
function validateFamilyOverride(definition, componentId, input) {
  const rootId = familyRootId(definition)
  if (!rootId) return false
  const owned =
    componentId === rootId ||
    definition.components.some((component) => component.id === componentId)
  if (!owned) return false
  const override = cloneFamilyData(input)
  if (
    componentId !== rootId ||
    !override ||
    Object.keys(override).length !== 1 ||
    !Object.hasOwn(override, 'familyOperations')
  )
    fail()
  replay(definition, override.familyOperations)
  return true
}
function materializeFamilyDocument(definition, instance) {
  const descriptor = familyDescriptor(definition)
  if (!descriptor || instance.definitionId !== definition.id) fail()
  const override = instance.overrides.components?.[familyRootId(definition)]
  if (!override) {
    // Domain normalizers provide the same frozen contract even without edits.
    const [, [field, , , normalize]] = descriptor
    return normalize(definition.content[field])
  }
  validateFamilyOverride(definition, familyRootId(definition), override)
  return replay(definition, override.familyOperations)
}
function tableCompatibilityData(table) {
  return table.rows.map((row) =>
    row.cells.map((cell) =>
      cell.textDocument.paragraphs
        .map((paragraph) =>
          paragraph.runs.map((run) => (run.kind === 'break' ? '\n' : (run.text ?? ''))).join('')
        )
        .join('\n')
    )
  )
}
function familyCompatibilityElement(document, element) {
  const instance = document.instances[element.pptxInstanceId]
  const definition = document.definitions[instance?.definitionId]
  const descriptor = familyDescriptor(definition)
  if (!descriptor) return element
  const effective = materializeFamilyDocument(definition, instance)
  // This is a read-only derived field; commands never consume an element copy.
  const result = {
    ...element,
    [descriptor[1][0]]: effective,
    ...(descriptor[0] === 'table' ? { data: tableCompatibilityData(effective) } : {}),
    ...(descriptor[0] === 'svg' ? { content: semanticSvgMarkup(effective) } : {}),
  }
  // Physical family renderers consume source units, never percentage canvas
  // dimensions or a persisted compatibility copy of the source frame.
  delete result.pptxFamilyBounds
  if (definition.content.extent)
    result.pptxFamilyBounds = {
      x: 0,
      y: 0,
      width: definition.content.extent.cx,
      height: definition.content.extent.cy,
    }
  delete result.mathFrame
  delete result.pptxTextContext
  const payload = document.styles[instance.textSourceBinding?.contextId]?.payload
  const context = payload && expandTextContext(payload, { styles: document.styles })
  if (context) result.pptxTextContext = context
  if (descriptor[0] === 'omml' && definition.content.mathFrame)
    result.mathFrame = materializeOmmlFrame(definition.content.mathFrame, context)
  return result
}
module.exports = {
  FAMILY_OPERATION_TYPES: Object.freeze(Object.keys(FAMILIES).map((family) => `${family}.edit`)),
  familyDescriptor,
  familyOperationType,
  familyRootId,
  validateFamilyOverride,
  materializeFamilyDocument,
  familyCompatibilityElement,
  tableCompatibilityData,
}
