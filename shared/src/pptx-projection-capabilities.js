const {
  normalizePptxSemanticDocument,
  PptxSemanticValidationError,
} = require('./pptx-semantic-document.js')
const { materializeGeometry } = require('./pptx-geometry-style-resolution.js')
const { familyOperationType } = require('./pptx-family-operations.js')
const { familyOperationAvailable } = require('./pptx-family-operations-command.js')
const { PICTURE_EDIT, pictureOperationAvailable } = require('./pptx-picture-operations.js')
const { MEDIA_EDIT, mediaOperationAvailable } = require('./pptx-media-operations.js')
const { INHERITANCE_EDIT } = require('./pptx-inheritance-operations')
const { semanticInstances } = require('./pptx-semantic-records.js')
function sameJson(left, right) {
  if (left === right) return true
  if (
    !left ||
    !right ||
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    Array.isArray(left) !== Array.isArray(right)
  )
    return false
  const keys = Object.keys(left)
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => Object.hasOwn(right, key) && sameJson(left[key], right[key]))
  )
}

const SERIES_VALUES = 'chart.series.set-values'
const GEOMETRY_EDIT = 'geometry.edit'
const GROUP_FILL_EDIT = 'group.fill.edit'
const CHART_TYPES = new Set(['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'])
function reject(message) {
  throw new TypeError(`Invalid projection operation: ${message}`)
}
function chartProjection(document, instanceId) {
  const instance = document.instances[instanceId]
  if (!instance || instance.lineage?.tombstone || instance.lineage?.paintOnly)
    reject('inactive chart occurrence')
  const definition = document.definitions[instance.definitionId]
  const projection = definition.content.chartProjection
  if (
    definition.kind !== 'chart' ||
    !projection ||
    projection.schemaVersion !== 1 ||
    !['literal', 'formula'].includes(projection.dataMode)
  )
    reject('unsupported chart projection')
  const data = projection.chartData
  if (
    !data ||
    !Array.isArray(data.labels) ||
    !data.labels.length ||
    data.labels.some((label) => typeof label !== 'string') ||
    !Array.isArray(data.datasets) ||
    !data.datasets.length
  )
    reject('invalid chart data')
  const ids = new Set()
  for (const series of data.datasets) {
    const component = definition.components.find((item) => item.id === series.componentId)
    if (!component || component.kind !== 'series' || ids.has(series.componentId))
      reject('unbound or duplicate series')
    ids.add(series.componentId)
    assertSeriesValues(series.data, data.labels.length)
  }
  return { instance, definition, projection }
}
function assertSeriesValues(values, length) {
  if (
    !Array.isArray(values) ||
    values.length !== length ||
    values.some((value) => typeof value !== 'number' || !Number.isFinite(value))
  )
    reject('series values must be finite numbers with the authored cardinality')
}
function projectChartData(input, instanceId) {
  return projectNormalizedChartData(normalizePptxSemanticDocument(input), instanceId)
}
function projectNormalizedChartData(document, instanceId) {
  const { instance, projection } = chartProjection(document, instanceId)
  const data = structuredClone(projection.chartData)
  for (const series of data.datasets) {
    const override = instance.overrides.components?.[series.componentId]
    if (override === undefined) continue
    if (
      projection.dataMode !== 'literal' ||
      !override ||
      Object.keys(override).length !== 1 ||
      !Object.hasOwn(override, 'values')
    )
      reject('unsupported series override')
    assertSeriesValues(override.values, data.labels.length)
    series.data = [...override.values]
  }
  return data
}
function getProjectionCapabilities(input, instanceId) {
  try {
    return normalizedProjectionCapabilities(normalizePptxSemanticDocument(input), instanceId)
  } catch (error) {
    if (!(error instanceof TypeError) && !(error instanceof PptxSemanticValidationError))
      throw error
    return { operations: [] }
  }
}
// No normalized-model argument crosses the public validation boundary.
function getProjectionCapabilitiesForInstances(input) {
  const document = normalizePptxSemanticDocument(input)
  const domains = []
  for (const [instanceId] of semanticInstances(document)) {
    const { operations } = normalizedProjectionCapabilities(document, instanceId)
    if (operations.length) domains.push({ instanceId, operations })
  }
  return domains
}
function normalizedProjectionCapabilities(document, instanceId) {
  try {
    const geometryInstance = document.instances[instanceId]
    const definition = document.definitions[geometryInstance?.definitionId]
    if (definition?.content.pictureDocument)
      return { modelVersion: document.schemaVersion,
        operations: pictureOperationAvailable(document, instanceId) ? [PICTURE_EDIT] : [] }
    if (definition?.content.mediaDocument)
      return { modelVersion: document.schemaVersion,
        operations: mediaOperationAvailable(document, instanceId) ? [MEDIA_EDIT] : [] }
    const familyType = familyOperationType(definition)
    if (familyType)
      return {
        modelVersion: document.schemaVersion,
        operations:
          familyOperationAvailable(document, instanceId) &&
          !definition.content.frameProperties?.locks?.noSelect
            ? [familyType]
            : [],
      }
    if (
      document.schemaVersion === 2 &&
      geometryInstance &&
      !geometryInstance.lineage?.tombstone &&
      !geometryInstance.lineage?.paintOnly &&
      document.definitions[geometryInstance.definitionId].kind === 'group' &&
      document.definitions[geometryInstance.definitionId].origin !== 'project' &&
      document.styles[geometryInstance.sourceBinding?.contextId]?.kind === 'group-fill-context'
    ) {
      let current = geometryInstance
      while (current) {
        if (current.overrides.locked)
          return { modelVersion: document.schemaVersion, operations: [] }
        current = current.parentInstanceId ? document.instances[current.parentInstanceId] : null
      }
      return { modelVersion: document.schemaVersion, operations: [GROUP_FILL_EDIT] }
    }
    if (
      geometryInstance &&
      !geometryInstance.lineage?.tombstone &&
      !geometryInstance.lineage?.paintOnly &&
      document.definitions[geometryInstance.definitionId].kind === 'shape'
    ) {
      let current = geometryInstance
      while (current) {
        if (current.overrides.locked)
          return { modelVersion: document.schemaVersion, operations: [] }
        current = current.parentInstanceId ? document.instances[current.parentInstanceId] : null
      }
      const operations = []
      if (materializeGeometry(document, instanceId)?.schemaVersion === 1) {
        operations.push(GEOMETRY_EDIT)
      }
      if (
        geometryInstance.sourceBinding?.contextId ||
        geometryInstance.textSourceBinding?.contextId
      ) {
        operations.push(INHERITANCE_EDIT)
      }
      if (operations.length) {
        return { modelVersion: document.schemaVersion, operations }
      }
    }
    if (
      geometryInstance &&
      !geometryInstance.lineage?.tombstone &&
      !geometryInstance.lineage?.paintOnly &&
      (geometryInstance.sourceBinding?.contextId || geometryInstance.textSourceBinding?.contextId)
    ) {
      let current = geometryInstance
      while (current) {
        if (current.overrides.locked)
          return { modelVersion: document.schemaVersion, operations: [] }
        current = current.parentInstanceId ? document.instances[current.parentInstanceId] : null
      }
      return {
        modelVersion: document.schemaVersion,
        operations: [INHERITANCE_EDIT],
      }
    }
    const { instance, projection } = chartProjection(document, instanceId)
    projectNormalizedChartData(document, instanceId)
    return {
      modelVersion: document.schemaVersion,
      operations:
        projection.dataMode === 'literal' &&
        CHART_TYPES.has(projection.chartType) &&
        !instance.overrides.locked
          ? [SERIES_VALUES]
          : [],
    }
  } catch (error) {
    if (!(error instanceof TypeError) && !(error instanceof PptxSemanticValidationError))
      throw error
    return { operations: [] }
  }
}
function assertProjectionChartBinding(input, element) {
  const document = normalizePptxSemanticDocument(input)
  const instance = document.instances[element.pptxInstanceId]
  if (
    !instance ||
    element.type !== 'chart' ||
    element.chartType !==
      document.definitions[instance.definitionId].content.chartProjection?.chartType ||
    !sameJson(element.chartData, projectChartData(document, instance.id))
  )
    reject('derived chart data differs from its canonical occurrence')
}

module.exports = {
  SERIES_VALUES,
  GEOMETRY_EDIT,
  GROUP_FILL_EDIT,
  PICTURE_EDIT,
  MEDIA_EDIT,
  INHERITANCE_EDIT,
  assertSeriesValues,
  projectChartData,
  getProjectionCapabilities,
  getProjectionCapabilitiesForInstances,
  assertProjectionChartBinding,
}
