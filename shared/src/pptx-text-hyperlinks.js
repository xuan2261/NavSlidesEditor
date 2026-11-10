const { normalizeElementAction } = require('./element-actions')
const object = (v) => v && typeof v === 'object' && !Array.isArray(v)
const fields = (v, allowed, required = []) => object(v) && required.every((k) => Object.hasOwn(v, k)) &&
  Object.keys(v).every((k) => allowed.includes(k))
function hasControlOrDel(value) {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code <= 0x1f || code === 0x7f) return true
  }
  return false
}
const text = (v, max = 1024) => typeof v === 'string' && v.length > 0 && v.length <= max && !hasControlOrDel(v)
const identity = (v) => text(v, 256)
const safePart = (v) => text(v, 1024) && !/[\\?#: ]/u.test(v) && !/%(?:2f|5c|2e)/iu.test(v) &&
  v.split('/').every((part) => part && part !== '.' && part !== '..')
function same(left, right) {
  if (left === right) return true
  return object(left) && object(right) && Object.keys(left).length === Object.keys(right).length &&
    Object.keys(left).every((key) => Object.hasOwn(right, key) && same(left[key], right[key]))
}
const RUN_ACTION_KINDS = new Set(['url', 'email', 'download', 'slide', 'next', 'previous', 'first', 'last'])
function canonicalRunAction(value) {
  if (value === null) return true
  if (!object(value) || !RUN_ACTION_KINDS.has(value.kind) || value.hotspot !== undefined) return false
  const normalized = normalizeElementAction(value)
  return !normalized.error && same(value, normalized.action)
}
function validDeclarations(value) {
  return fields(value, ['action', 'tgtFrame', 'tooltip', 'history', 'highlightClick', 'endSnd', 'invalidUrl']) &&
    Object.entries(value).every(([key, v]) => ['history', 'highlightClick', 'endSnd'].includes(key)
      ? typeof v === 'boolean' : typeof v === 'string' && v.length <= 1024 && !hasControlOrDel(v)) &&
    (value.action === undefined || value.action === 'ppaction://hlinksldjump') &&
    (value.tgtFrame === undefined || ['_blank', '_self', ''].includes(value.tgtFrame)) &&
    value.endSnd !== true
}
function validRunHyperlinks(value, component) {
  if (!fields(value, ['click', 'hover']) || !Object.keys(value).length) return false
  return Object.values(value).every((link) => fields(link,
    ['componentId', 'relationshipId', 'sourceId', 'targetPartUri', 'declarations', 'action'],
    ['componentId', 'relationshipId']) && component(link.componentId) && identity(link.relationshipId) &&
    (link.targetPartUri === undefined || safePart(link.targetPartUri)) &&
    (link.sourceId === undefined || typeof link.sourceId === 'string' && /^[a-f0-9]{64}$/.test(link.sourceId)) &&
    ((link.targetPartUri === undefined) === (link.sourceId === undefined)) &&
    (link.declarations === undefined || validDeclarations(link.declarations)) &&
    (Object.hasOwn(link, 'action') ? canonicalRunAction(link.action) : link.targetPartUri !== undefined))
}
function editRunHyperlink(document, runId, trigger, action) {
  if (!['click', 'hover'].includes(trigger) || !canonicalRunAction(action))
    throw new TypeError('Invalid run hyperlink action')
  let found = false
  const paragraphs = document.paragraphs.map((paragraph) => ({ ...paragraph,
    runs: paragraph.runs.map((run) => {
      if (run.componentId !== runId) return run
      if (found || !run.hyperlinks?.[trigger]) throw new TypeError('Unknown/ambiguous source run hyperlink')
      found = true
      return { ...run, hyperlinks: { ...run.hyperlinks, [trigger]: { ...run.hyperlinks[trigger], action } } }
    }),
  }))
  if (!found) throw new TypeError('Unknown source run hyperlink')
  return { ...document, paragraphs }
}
module.exports = { RUN_ACTION_KINDS, canonicalRunAction, validRunHyperlinks, editRunHyperlink, safePart, same }
