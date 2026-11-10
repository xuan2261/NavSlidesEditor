const { attr, decodeXml } = require('./ooxml-text-run-xml')
const { resolveTarget } = require('./package-store/raw-zip')
const { normalizeElementAction } = require('../../../shared/src/element-actions')
const { canonicalRunAction } = require('../../../shared/src/pptx-text-hyperlinks')
const R = new Set(['http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships'])
const value = (node, name) => decodeXml(attr(node, name) ?? '')

function readRunHyperlink(node, source, runId) {
  if (!runId) source.fail(node, 'hyperlink requires an explicit source run')
  const ids = node.attrs.filter((a) => a.name.includes(':') && a.name.split(':')[1] === 'id' &&
    R.has(node.namespaces[a.name.split(':')[0]]))
  if (ids.length !== 1) source.fail(node, 'hyperlink relationship identity')
  const attrs = source.attrs(node, [ids[0].name, 'action', 'tgtFrame', 'tooltip', 'history',
    'highlightClick', 'endSnd', 'invalidUrl'])
  source.children(node)
  const relationshipId = attrs[ids[0].name]
  delete attrs[ids[0].name]
  for (const key of ['history', 'highlightClick', 'endSnd'])
    if (attrs[key] !== undefined) attrs[key] = source.boolean(node, attrs[key])
  const relations = source.relationships?.(source.source.partUri)
  const matches = relations?.filter((r) => value(r, 'Id') === relationshipId) || []
  if (!relationshipId || matches.length !== 1) source.fail(node, 'missing/ambiguous hyperlink relationship')
  const relation = matches[0], type = value(relation, 'Type'), target = value(relation, 'Target')
  const mode = value(relation, 'TargetMode')
  let descriptor
  if (attrs.action === 'ppaction://hlinksldjump') {
    if (!R.has(type.slice(0, -6)) || !type.endsWith('/slide') || !['', 'Internal'].includes(mode))
      source.fail(node, 'invalid hyperlink slide relationship')
    let targetPartUri
    try { targetPartUri = resolveTarget(source.source.partUri, target) }
    catch { source.fail(node, 'unsafe hyperlink slide target') }
    if (!source.slideParts?.has(targetPartUri)) source.fail(node, 'hyperlink target is not a declared source slide')
    descriptor = { sourceId: source.sourceId, targetPartUri }
  } else {
    if (attrs.action !== undefined || ![...R].some((base) => type === `${base}/hyperlink`) || mode !== 'External')
      source.fail(node, 'unsupported hyperlink relationship/action')
    const candidate = { kind: /^mailto:/i.test(target) ? 'email' : 'url', url: target,
      ...(attrs.tgtFrame === '_blank' ? { target: 'new' } : {}) }
    if (!canonicalRunAction(candidate)) source.fail(node, 'unsafe/noncanonical hyperlink URL')
    descriptor = { action: normalizeElementAction(candidate).action }
  }
  const componentId = source.bind(node, 'hyperlink', runId, 'hyperlink')
  const result = { componentId, relationshipId, ...descriptor,
    ...(Object.keys(attrs).length ? { declarations: attrs } : {}) }
  // The public strict record validation also rejects unrepresented declaration semantics.
  source.checked(node, () => {
    const { validRunHyperlinks } = require('../../../shared/src/pptx-text-hyperlinks')
    if (!validRunHyperlinks({ click: result }, () => true)) throw new TypeError('unsupported hyperlink declaration')
  })
  return result
}
module.exports = { readRunHyperlink }
