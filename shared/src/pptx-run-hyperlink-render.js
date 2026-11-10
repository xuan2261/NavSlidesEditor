const { escapePlainText } = require('./content-safety')
const { resolveRunHyperlink } = require('./pptx-source-slide-references')

// Only generated presentation output supplies this context; editor paint stays inert.
function runHyperlinkAttributes(run, presentation) {
  if (!presentation || !run?.hyperlinks) return ''
  const attributes = []
  for (const [trigger, link] of Object.entries(run.hyperlinks)) {
    const resolved = resolveRunHyperlink(presentation, link)
    if (resolved.status !== 'ready') continue
    const name = trigger === 'click' ? 'data-ns-action' : 'data-ns-hover-action'
    attributes.push(`${name}="${escapePlainText(JSON.stringify(resolved.action))}"`)
    if (trigger === 'click') attributes.push('role="link"', 'tabindex="0"')
    else attributes.push(`data-ns-hover-link="${escapePlainText(link.componentId)}"`)
  }
  return attributes.length ? ` ${attributes.join(' ')}` : ' aria-disabled="true"'
}
function presentationHasRunHyperlinks(presentation) {
  return Object.values(presentation.pptxSemantic?.definitions || {}).some((definition) => {
    const documents = [definition.content.textDocument,
      ...(definition.content.tableDocument?.rows.flatMap((row) => row.cells.map((cell) => cell.textDocument)) || [])]
    return documents.some((document) => document?.paragraphs.some((paragraph) =>
      paragraph.runs.some((run) => run.hyperlinks)))
  })
}
module.exports = { runHyperlinkAttributes, presentationHasRunHyperlinks }
