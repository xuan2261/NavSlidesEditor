const { normalizeTextProperties, normalizeTextDocument, cloneTextData } = require('./pptx-text-document')
const { freezeLayout } = require('./pptx-smartart-layout-declarations')

function styleFailure(detail, source, componentId) {
  const error = new TypeError(`Unsupported PPTX SmartArt source paint: ${detail}`)
  error.code = 'PPTX_SMARTART_PAINT_UNSUPPORTED'
  error.componentId = componentId
  error.sourceLocation = source
  throw error
}
function normalizeSmartArtStyles(input, relationships) {
  const styles = cloneTextData(input)
  const fail = (message) => styleFailure(message, styles?.styleSource)
  const record = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) &&
    Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k))
  const location = (s) => record(s, ['partUri', 'preconditionHash', 'path']) &&
    typeof s.partUri === 'string' && s.partUri.length &&
    !/^(?:\/|[a-z]+:)|\\|(?:^|\/)\.\.?(?:\/|$)/i.test(s.partUri) &&
    !/[#?:\s]|%(?:2f|5c|2e)/i.test(s.partUri) &&
    /^[a-f0-9]{64}$/.test(s.preconditionHash) && Array.isArray(s.path) &&
    s.path.length && s.path.every((n) => Number.isSafeInteger(n) && n >= 0)
  if (!record(styles, ['schemaVersion', 'styleSource', 'colorSource', 'themeSource', 'labels']) ||
      styles.schemaVersion !== 1 || ![styles.styleSource, styles.colorSource, styles.themeSource].every(location))
    fail('source style record')
  for (const [key, role] of [['styleSource', 'style'], ['colorSource', 'colors']]) {
    const relationship = relationships.find((r) => r.role === role)
    if (styles[key].partUri !== relationship.partUri ||
        styles[key].preconditionHash !== relationship.preconditionHash) fail('source style relationship mismatch')
  }
  if (!Array.isArray(styles.labels) || !styles.labels.length || styles.labels.length > 100000) fail('style label budget')
  const names = new Set(), ids = new Set()
  for (const label of styles.labels) {
    if (!record(label, ['name', 'componentId', 'source', 'fillColors', 'lineColors', 'lineWidthEmu', 'textColors', 'textDefaults',
      ...(Object.hasOwn(label, 'lineJoin') ? ['lineJoin'] : []),
      ...(Object.hasOwn(label, 'textStyleDocument') ? ['textStyleDocument'] : [])]) ||
        typeof label.name !== 'string' || !label.name || names.has(label.name) ||
        typeof label.componentId !== 'string' || !label.componentId || ids.has(label.componentId) ||
        !location(label.source) || label.source.partUri !== styles.styleSource.partUri ||
        label.source.preconditionHash !== styles.styleSource.preconditionHash ||
        !Number.isSafeInteger(label.lineWidthEmu) || label.lineWidthEmu < 0 || label.lineWidthEmu > 20116800)
      fail('style label identity/paint')
    names.add(label.name); ids.add(label.componentId)
    if (label.lineJoin) {
      const join = label.lineJoin
      if (!record(join, join.kind === 'miter' ? ['kind', 'limit'] : ['kind']) ||
          !['miter', 'round', 'bevel'].includes(join.kind) ||
          (join.kind === 'miter' && (!Number.isSafeInteger(join.limit) || join.limit < 0 || join.limit > 2147483647)))
        fail('source line join')
    }
    for (const field of ['fillColors', 'lineColors', 'textColors']) {
      const list = label[field]
      if (!Array.isArray(list) || !list.length || list.length > 100000) fail('source color list')
      for (const color of list) {
        if (field !== 'textColors' && record(color, ['kind']) && color.kind === 'none') continue
        normalizeTextProperties({ color }, 'run')
        if (color.kind !== 'srgb') fail('unresolved source color')
      }
    }
    if (!label.textDefaults || !Object.hasOwn(label.textDefaults, 'run') ||
        Object.keys(label.textDefaults).some((k) => !['body', 'paragraph', 'run'].includes(k))) fail('source text defaults')
    for (const [scope, props] of Object.entries(label.textDefaults))
      label.textDefaults[scope] = normalizeTextProperties(props, scope)
    if (label.textStyleDocument) {
      label.textStyleDocument = normalizeTextDocument(label.textStyleDocument)
      const p = label.textStyleDocument.paragraphs[0]
      if (label.textStyleDocument.paragraphs.length !== 1 || p.runs.length || p.endRunProperties)
        fail('source default paragraph')
      for (const [scope, props] of [['body', label.textStyleDocument.body], ['paragraph', p.properties ?? {}]])
        if (JSON.stringify(label.textDefaults[scope]) !== JSON.stringify(props)) fail('source text default mismatch')
      for (const [key, value] of Object.entries(p.defaultRunProperties ?? {}))
        if (JSON.stringify(label.textDefaults.run[key]) !== JSON.stringify(value)) fail('source run default mismatch')
    }
  }
  return freezeLayout(styles)
}
function smartArtNodeStyle(document, node) {
  const props = Object.fromEntries(node.point.properties.map((p) => [p.name, p.value]))
  const name = props.presStyleLbl ?? node.styleLabel
  const label = document.sourceStyles?.labels.find((s) => s.name === name)
  if (!label) styleFailure(`missing source style label ${name ?? ''}`,
    document.sourceStyles?.styleSource ?? { partUri: document.relationships.find((r) => r.role === 'style').partUri }, node.componentId)
  const index = props.presStyleIdx ?? 0
  if (!Number.isSafeInteger(index) || index < 0) styleFailure('invalid source color index', label.source, node.componentId)
  const choose = (colors) => colors[index % colors.length]
  return { fill: choose(label.fillColors), line: choose(label.lineColors),
    lineWidthEmu: label.lineWidthEmu, lineJoin: label.lineJoin, source: label.source,
    textDefaults: { ...label.textDefaults,
      run: { color: choose(label.textColors), ...label.textDefaults.run } } }
}
module.exports = { normalizeSmartArtStyles, smartArtNodeStyle, styleFailure }
