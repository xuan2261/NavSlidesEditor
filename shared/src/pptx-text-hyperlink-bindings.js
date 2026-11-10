const { same } = require('./pptx-text-hyperlinks')
const fail = (detail) => { throw new TypeError(`Invalid source hyperlink ${detail}`) }
function textDocuments(definition) {
  const content = definition.content
  return [content.textDocument, ...(content.tableDocument?.rows.flatMap((row) =>
    row.cells.map((cell) => cell.textDocument)) || [])].filter(Boolean)
}
function links(document) {
  return document.paragraphs.flatMap((paragraph) => paragraph.runs.flatMap((run) =>
    Object.entries(run.hyperlinks || {}).map(([trigger, link]) => ({ runId: run.componentId, trigger, link }))))
}
function validateTextHyperlinkBindings(definition) {
  const bindings = new Set(), components = new Map(definition.components.map((c) => [c.id, c]))
  for (const text of textDocuments(definition)) for (const { runId, link } of links(text)) {
    const run = components.get(runId), component = components.get(link.componentId)
    const path = component?.locator?.path, parent = run?.locator?.path
    if (!component || component.kind !== 'hyperlink' || run?.kind !== 'run' || bindings.has(link.componentId) ||
      component.locator.preconditionHash !== definition.source.preconditionHash ||
      path.length !== parent.length + 2 || !parent.every((v, i) => path[i] === v)) fail('component binding')
    if (link.targetPartUri !== undefined) {
      if (Object.hasOwn(link, 'action') || link.declarations?.action !== 'ppaction://hlinksldjump') fail('internal source action')
    } else if (!['url', 'email'].includes(link.action?.kind) || link.declarations?.action !== undefined)
      fail('external source action')
    bindings.add(link.componentId)
  }
  return bindings
}
function validateTextHyperlinkOverride(definition, document) {
  const originals = new Map(textDocuments(definition).flatMap(links).map((entry) => [entry.link.componentId, entry]))
  for (const entry of links(document)) {
    const original = originals.get(entry.link.componentId)
    const split = original && entry.runId.startsWith(`${original.runId}~`) &&
      /^[1-9][0-9]*$/.test(entry.runId.slice(original.runId.length + 1))
    if (!original || original.runId !== entry.runId && !split || original.trigger !== entry.trigger) fail('override owner')
    const { action: _sourceAction, ...source } = original.link
    const { action: _action, ...candidate } = entry.link
    if (!same(source, candidate)) fail('override declaration')
  }
}
module.exports = { validateTextHyperlinkBindings, validateTextHyperlinkOverride }
