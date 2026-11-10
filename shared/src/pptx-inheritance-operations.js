const { cloneTextData, normalizeTextDocument } = require('./pptx-text-document')
const { geometryProvider } = require('./pptx-geometry-style-records')
const { semanticDefinition, semanticStyles, semanticInstance,
  replaceSemanticRecords } = require('./pptx-semantic-records')
const { fail, previewNormalized, mergeFill } = require('./pptx-inheritance-targets')

const INHERITANCE_EDIT = 'inheritance.edit'
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right)

function envelope(input) {
  const operation = cloneTextData(input)
  if (!operation || operation.type !== INHERITANCE_EDIT || typeof operation.instanceId !== 'string' ||
      !operation.command || Object.keys(operation).some((key) =>
        !['type', 'instanceId', 'command', 'scope', 'sourceDefinitionId', 'preview'].includes(key)) ||
      !['selected', 'all'].includes(operation.scope ?? 'selected')) fail('invalid operation')
  return operation
}


function previewInheritanceEdit(input, intent) {
  const { normalizeSemanticPresentation } = require('./pptx-semantic-presentation')
  return previewNormalized(normalizeSemanticPresentation(input), envelope(intent))
}
function mergeTextDocumentDelta(base, next, target) {
  const result = cloneTextData(target)
  if (next.body && base?.body) {
    for (const [key, val] of Object.entries(next.body)) {
      if (JSON.stringify(val) !== JSON.stringify(base.body[key])) {
        result.body = { ...result.body, [key]: cloneTextData(val) }
      }
    }
  } else if (next.body && !base?.body) {
    result.body = { ...result.body, ...cloneTextData(next.body) }
  }

  const baseParaMap = new Map((base?.paragraphs || []).map((p) => [p.componentId, p]))
  const nextParaMap = new Map((next.paragraphs || []).map((p) => [p.componentId, p]))

  for (const targetPara of result.paragraphs || []) {
    const nextPara = nextParaMap.get(targetPara.componentId)
    const basePara = baseParaMap.get(targetPara.componentId)
    if (!nextPara) continue
    if (nextPara.properties && basePara?.properties) {
      for (const [key, val] of Object.entries(nextPara.properties)) {
        if (JSON.stringify(val) !== JSON.stringify(basePara.properties[key])) {
          targetPara.properties = { ...targetPara.properties, [key]: cloneTextData(val) }
        }
      }
    } else if (nextPara.properties && !basePara?.properties) {
      targetPara.properties = { ...targetPara.properties, ...cloneTextData(nextPara.properties) }
    }
    if (nextPara.defaultRunProperties && basePara?.defaultRunProperties) {
      for (const [key, val] of Object.entries(nextPara.defaultRunProperties)) {
        if (JSON.stringify(val) !== JSON.stringify(basePara.defaultRunProperties[key])) {
          targetPara.defaultRunProperties = { ...targetPara.defaultRunProperties, [key]: cloneTextData(val) }
        }
      }
    } else if (nextPara.defaultRunProperties && !basePara?.defaultRunProperties) {
      targetPara.defaultRunProperties = { ...targetPara.defaultRunProperties, ...cloneTextData(nextPara.defaultRunProperties) }
    }
    const baseRunMap = new Map((basePara?.runs || []).map((r) => [r.componentId, r]))
    const nextRunMap = new Map((nextPara.runs || []).map((r) => [r.componentId, r]))

    for (const targetRun of targetPara.runs || []) {
      const nextRun = nextRunMap.get(targetRun.componentId)
      const baseRun = baseRunMap.get(targetRun.componentId)
      if (!nextRun) continue
      if (nextRun.text !== undefined && (baseRun === undefined || nextRun.text !== baseRun.text)) {
        targetRun.text = nextRun.text
      }
      if (nextRun.properties && baseRun?.properties) {
        for (const [key, val] of Object.entries(nextRun.properties)) {
          if (JSON.stringify(val) !== JSON.stringify(baseRun.properties[key])) {
            targetRun.properties = { ...targetRun.properties, [key]: cloneTextData(val) }
          }
        }
      } else if (nextRun.properties && !baseRun?.properties) {
        targetRun.properties = { ...targetRun.properties, ...cloneTextData(nextRun.properties) }
      }
      if (nextRun.field !== undefined && (baseRun === undefined || JSON.stringify(nextRun.field) !== JSON.stringify(baseRun.field))) {
        targetRun.field = cloneTextData(nextRun.field)
      }
    }
  }
  return normalizeTextDocument(result)
}

function editInstance(document, instance, command, isDependent = false, selectedBaseDoc = null, sourceDefinitionId = null) {
  const definition = semanticDefinition(document, instance.definitionId)
  const overrides = { ...instance.overrides }
  const components = { ...overrides.components }
  if (command.type === 'hidden') {
    if (Object.keys(command).length !== 2 || typeof command.value !== 'boolean') fail('invalid hidden flag')
    overrides.hidden = command.value
  } else if (['label', 'text-style', 'text-document'].includes(command.type)) {
    const targetDef = (sourceDefinitionId && semanticDefinition(document, sourceDefinitionId)) || definition
    const source = definition.content.textDocument ?? targetDef?.content.textDocument
    if (!source) fail('target has no editable source text')
    const previous = components[source.componentId]
    const text = cloneTextData(previous?.textDocument ?? source)
    if (command.type === 'label') {
      if (Object.keys(command).length !== 2 || typeof command.value !== 'string') fail('invalid label')
      const runs = text.paragraphs.flatMap((p) => p.runs).filter((run) => run.kind === 'text')
      if (runs.length !== 1) fail('ambiguous label; edit the canonical rich text instead')
      runs[0].text = command.value
      components[source.componentId] = { ...previous, textDocument: normalizeTextDocument(text) }
    } else if (command.type === 'text-style') {
      if (Object.keys(command).length !== 2 || !command.properties || typeof command.properties !== 'object' ||
          Array.isArray(command.properties)) fail('invalid text style')
      for (const paragraph of text.paragraphs) {
        paragraph.defaultRunProperties = { ...paragraph.defaultRunProperties, ...command.properties }
        for (const run of paragraph.runs) run.properties = { ...run.properties, ...command.properties }
      }
      components[source.componentId] = { ...previous, textDocument: normalizeTextDocument(text) }
    } else {
      if (Object.keys(command).length !== 2 || !command.document || typeof command.document !== 'object')
        fail('invalid text document command')
      const normalizedDoc = normalizeTextDocument(command.document)
      if (normalizedDoc.componentId !== source.componentId)
        fail('text document component mismatch')
      if (isDependent && selectedBaseDoc) {
        components[source.componentId] = {
          ...previous,
          textDocument: mergeTextDocumentDelta(selectedBaseDoc, normalizedDoc, text),
        }
      } else {
        components[source.componentId] = { ...previous, textDocument: normalizedDoc }
      }
    }
    overrides.components = components
  } else if (command.type === 'geometry-style') {
    if (Object.keys(command).length !== 2 || !command.style || typeof command.style !== 'object' ||
        Array.isArray(command.style)) fail('invalid geometry style')
    const geometry = geometryProvider(document, instance).geometry
    if (!geometry) fail('missing source geometry')
    const previous = components[geometry.componentId]
    const prevGeom = previous?.geometryStyle || {}
    const nextGeom = command.style || {}
    components[geometry.componentId] = {
      ...previous,
      geometryStyle: {
        ...prevGeom,
        ...nextGeom,
        ...(prevGeom.stroke || nextGeom.stroke
          ? { stroke: { ...(prevGeom.stroke || {}), ...(nextGeom.stroke || {}) } }
          : {}),
        ...(prevGeom.fill || nextGeom.fill
          ? { fill: mergeFill(prevGeom.fill, nextGeom.fill) }
          : {}),
      },
    }
    overrides.components = components
  } else fail('unsupported command')
  return { ...instance, overrides }
}
function applyInheritancePresentationOperation(input, intent) {
  const { normalizeSemanticPresentation } = require('./pptx-semantic-presentation')
  const presentation = normalizeSemanticPresentation(input)
  const operation = envelope(intent)
  const preview = previewNormalized(presentation, operation)
  if (operation.scope === 'all' && (!operation.preview || !equal(preview, operation.preview)))
    fail('missing or stale impact preview')
  if (preview.occurrences.some((record) => record.locked)) fail('locked occurrence')
  const document = presentation.pptxSemantic
  let next
  if (operation.command.type === 'theme-colors') {
    const command = operation.command
    if (Object.keys(command).length !== 3 || !command.colors || typeof command.colors !== 'object' ||
        Array.isArray(command.colors)) fail('invalid theme colors')
    const existing = [...semanticStyles(document, { kind: 'theme-override' })].find(([, style]) =>
      style.baseStyleId === command.baseStyleId)
    const id = existing?.[0] ?? `project-theme:${command.baseStyleId}`
    next = replaceSemanticRecords(document, { styles: { [id]: {
      kind: 'theme-override', origin: 'project', baseStyleId: command.baseStyleId,
      values: { ...existing?.[1].values, colors: { ...existing?.[1].values.colors, ...command.colors } },
    } } })
  } else if (operation.command.type === 'owner-override') {
    const command = operation.command
    const baseDefinitionId = command.baseDefinitionId ?? operation.sourceDefinitionId
    if (!baseDefinitionId || typeof baseDefinitionId !== 'string') fail('invalid base definition id')
    if (!command.values || typeof command.values !== 'object' || Array.isArray(command.values))
      fail('invalid owner override values')
    const existing = [...semanticStyles(document, { kind: 'inheritance-override' })].find(([, style]) =>
      style.baseDefinitionId === baseDefinitionId)
    const id = existing?.[0] ?? `project-inheritance:${baseDefinitionId}`
    const existingValues = existing?.[1]?.values ?? {}
    const values = { ...existingValues, ...command.values }
    if (existingValues.textStyle || command.values.textStyle) {
      values.textStyle = { ...(existingValues.textStyle || {}), ...(command.values.textStyle || {}) }
    }
    if (existingValues.geometryStyle || command.values.geometryStyle) {
      const prevGeom = existingValues.geometryStyle || {}
      const nextGeom = command.values.geometryStyle || {}
      values.geometryStyle = {
        ...prevGeom,
        ...nextGeom,
        ...(prevGeom.stroke || nextGeom.stroke
          ? { stroke: { ...(prevGeom.stroke || {}), ...(nextGeom.stroke || {}) } }
          : {}),
        ...(prevGeom.fill || nextGeom.fill
          ? { fill: mergeFill(prevGeom.fill, nextGeom.fill) }
          : {}),
      }
    }
    next = replaceSemanticRecords(document, { styles: { [id]: {
      kind: 'inheritance-override', origin: 'project', baseDefinitionId,
      values,
    } } })
  } else {
    const selectedInstance = semanticInstance(document, operation.instanceId)
    const { materializeTextDocument } = require('./pptx-text-materialization')
    const selectedBaseDoc = materializeTextDocument(document, selectedInstance.id)
    const instances = {}
    for (const record of preview.occurrences) {
      const isDependent = operation.scope === 'all' && record.instanceId !== operation.instanceId
      instances[record.instanceId] = editInstance(
        document,
        semanticInstance(document, record.instanceId),
        operation.command,
        isDependent,
        selectedBaseDoc,
        operation.sourceDefinitionId
      )
    }
    next = replaceSemanticRecords(document, { instances })
  }
  return normalizeSemanticPresentation({ ...presentation, pptxSemantic: next })
}

module.exports = { INHERITANCE_EDIT, previewInheritanceEdit, applyInheritancePresentationOperation }
