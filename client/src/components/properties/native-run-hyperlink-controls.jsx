import { useMemo, useState } from 'react'
import ActionControls from './action-controls'
import { materializeTextDocument } from 'revealjs-shared/src/pptx-text-materialization.js'
import { canonicalTextReadonly } from 'revealjs-shared/src/pptx-text-operations.js'
import { materializeFamilyDocument } from 'revealjs-shared/src/pptx-family-operations.js'
import { normalizeElementAction } from 'revealjs-shared/src/element-actions.js'
import { editRunHyperlink } from 'revealjs-shared/src/pptx-text-hyperlinks.js'
import { normalizeTextDocument } from 'revealjs-shared/src/pptx-text-document.js'
import { resolveRunHyperlink } from 'revealjs-shared/src/pptx-source-slide-references.js'
import { semanticInstance, semanticDefinition } from 'revealjs-shared/src/pptx-semantic-records.js'

function entriesFor(presentation, element) {
  const model = presentation?.pptxSemantic, instance = semanticInstance(model, element.pptxInstanceId)
  const definition = semanticDefinition(model, instance?.definitionId)
  if (!definition) return []
  let bodies = []
  if (definition.content.textDocument)
    bodies = [{ document: materializeTextDocument(model, instance.id), label: 'Text' }]
  else if (definition.content.tableDocument) {
    const table = materializeFamilyDocument(definition, instance)
    bodies = table.rows.flatMap((row, r) => row.cells.map((cell, c) => ({
      document: cell.textDocument, cellId: cell.componentId, tableId: table.componentId,
      label: `Cell ${r + 1},${c + 1}`,
    })))
  }
  return bodies.flatMap((body) => body.document.paragraphs.flatMap((paragraph) =>
    paragraph.runs.filter((run) => run.hyperlinks).map((run) => ({ ...body, run }))))
}
function RunActionEditor({ entry, trigger, presentation, element, slide, onUpdate }) {
  const resolution = resolveRunHyperlink(presentation, entry.run.hyperlinks[trigger])
  const [draft, setDraft] = useState(resolution.action || null), [error, setError] = useState('')
  const disabled = element.locked || slide.locked || !onUpdate ||
    canonicalTextReadonly(presentation.pptxSemantic, element.pptxInstanceId)
  const apply = () => {
    try {
      const normalized = normalizeElementAction(draft)
      if (normalized.error) throw new TypeError(normalized.error)
      const textDocument = normalizeTextDocument(editRunHyperlink(entry.document,
        entry.run.componentId, trigger, normalized.action))
      onUpdate(entry.cellId ? { pptxProjectionOperation: { type: 'table.edit',
        instanceId: element.pptxInstanceId, componentId: entry.tableId,
        command: { type: 'replaceCellText', cellId: entry.cellId, textDocument } } }
        : { semanticTextDocument: textDocument })
      setError('')
    } catch (cause) { setError(cause.message) }
  }
  return <fieldset disabled={disabled}>
    {resolution.status === 'unresolved' && <p role="status">Source hyperlink destination is unavailable.</p>}
    <ActionControls runScoped element={{ id: entry.run.componentId, action: draft }}
      presentation={presentation} slide={slide} onUpdate={(patch) => setDraft(patch.action)} />
    <button type="button" onClick={apply}>Apply run hyperlink</button>
    {error && <div role="alert">{error}</div>}
  </fieldset>
}
export default function NativeRunHyperlinkControls({ presentation, element, slide, onUpdate }) {
  const entries = useMemo(() => entriesFor(presentation, element), [presentation, element])
  const [selectedId, setSelectedId] = useState(null), [selectedTrigger, setSelectedTrigger] = useState('click')
  const entry = entries.find(({ run }) => run.componentId === selectedId) || entries[0]
  if (!entry) return null
  const trigger = entry.run.hyperlinks[selectedTrigger] ? selectedTrigger : Object.keys(entry.run.hyperlinks)[0]
  return <section aria-label="Native run hyperlinks" className="flex flex-col gap-2">
    <label>Source text run<select aria-label="Hyperlink text run" value={entry.run.componentId}
      onChange={(event) => setSelectedId(event.target.value)}>
      {entries.map(({ run, label }) => <option key={run.componentId} value={run.componentId}>
        {label}: {run.text || '(empty run)'}
      </option>)}
    </select></label>
    <label>Trigger<select aria-label="Hyperlink trigger" value={trigger}
      onChange={(event) => setSelectedTrigger(event.target.value)}>
      {Object.keys(entry.run.hyperlinks).map((name) => <option key={name} value={name}>
        {name === 'click' ? 'Click' : 'Hover'}
      </option>)}
    </select></label>
    <RunActionEditor key={`${entry.run.componentId}:${trigger}:${JSON.stringify(entry.run.hyperlinks[trigger])}`}
      {...{ entry, trigger, presentation, element, slide, onUpdate }} />
  </section>
}
