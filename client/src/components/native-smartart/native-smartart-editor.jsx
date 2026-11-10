import { useState } from 'react'
import smartArtOperations from 'revealjs-shared/src/pptx-smartart-operations.js'
import smartArtRender from 'revealjs-shared/src/pptx-smartart-render.js'
import { smartArtFailureMessage } from './native-smartart-renderer'
import '../properties/native-family-editor.css'

const { applySmartArtOperation } = smartArtOperations
const { createSmartArtRenderModel } = smartArtRender
const copy = (value) => JSON.parse(JSON.stringify(value))
const sameModel = (a, b) => a.toLowerCase() === b.toLowerCase() ||
  (/^\d+$/.test(a) && /^\d+$/.test(b) && Number(a) === Number(b))

export function NativeSmartArtEditor({
  document, instanceId, bounds, onSemanticOperation, disabled = false,
}) {
  const points = document.points.filter((p) => ['node', 'asst'].includes(p.type))
  const [selectedId, setSelectedId] = useState(points[0]?.componentId ?? '')
  const [error, setError] = useState('')
  const [connectionType, setConnectionType] = useState('presOf')
  const [connectionTarget, setConnectionTarget] = useState('')
  const layoutValues = document.layout?.declarations.filter((d) =>
    d.type === 'param' || (d.type === 'constr' &&
      ['val', 'fact'].some((name) => Object.hasOwn(d.attributes, name)))) ?? []
  const [layoutId, setLayoutId] = useState(layoutValues[0]?.componentId ?? '')
  const layoutDeclaration = layoutValues.find((d) => d.componentId === layoutId) ?? layoutValues[0]
  const layoutAttribute = layoutDeclaration?.type === 'param' ||
    Object.hasOwn(layoutDeclaration?.attributes ?? {}, 'val') ? 'val' : 'fact'
  const parameterChoices = {
    linDir: ['fromL', 'fromR', 'fromT', 'fromB'],
    vertAlign: ['t', 'mid', 'b'],
    horzAlign: ['l', 'ctr', 'r'],
  }
  const selected = points.find((p) => p.componentId === selectedId) ?? points[0]
  const blocked = disabled || typeof onSemanticOperation !== 'function' || !instanceId
  const parents = document.points.filter((p) => ['doc', 'node', 'asst'].includes(p.type))
  const incoming = selected && document.connections.filter((c) =>
    c.type === 'parOf' && sameModel(c.destinationId, selected.modelId))
  const currentEdge = incoming?.length === 1 ? incoming[0] : null
  const siblings = currentEdge ? document.connections.filter((c) =>
    c.type === 'parOf' && sameModel(c.sourceId, currentEdge.sourceId))
    .sort((a, b) => a.sourceOrder - b.sourceOrder)
    .map((c) => points.find((p) => sameModel(p.modelId, c.destinationId))) : []
  const siblingIndex = siblings.findIndex((p) => p?.componentId === selected?.componentId)
  const emit = (command) => {
    if (blocked) return
    try {
      if (command.type !== 'reset') {
        const next = applySmartArtOperation(document, command)
        // Do not publish a graph whose actual authored program cannot place it.
        createSmartArtRenderModel(next, bounds)
      }
      onSemanticOperation({ type: 'smartart.edit', instanceId,
        componentId: document.componentId, command })
      setError('')
    } catch (failure) { setError(smartArtFailureMessage(failure)) }
  }
  const authoredId = () => `${document.componentId}~authored:${crypto.randomUUID()}`
  const modelId = () => `{${crypto.randomUUID()}}`
  const reorder = (offset) => {
    if (!currentEdge || siblings.some((p) => !p)) return
    const ids = siblings.map((p) => p.componentId)
    const other = siblingIndex + offset
    ;[ids[siblingIndex], ids[other]] = [ids[other], ids[siblingIndex]]
    const parent = parents.find((p) => sameModel(p.modelId, currentEdge.sourceId))
    emit({ type: 'reorder', parentId: parent.componentId, pointIds: ids })
  }
  const add = () => {
    const parent = selected ?? parents.find((p) => p.type === 'doc')
    if (!parent) return
    const edges = document.connections.filter((c) =>
      c.type === 'parOf' && sameModel(c.sourceId, parent.modelId))
    const pointModelId = modelId()
    emit({ type: 'add',
      point: { componentId: authoredId(), modelId: pointModelId, type: 'node', properties: [] },
      connection: { componentId: authoredId(), modelId: modelId(), type: 'parOf',
        sourceId: parent.modelId, destinationId: pointModelId,
        sourceOrder: edges.reduce((max, c) => Math.max(max, c.sourceOrder + 1), 0),
        destinationOrder: 0 },
    })
  }
  const labelRun = (paragraphIndex, runIndex, value) => {
    const textDocument = copy(selected.textDocument)
    textDocument.paragraphs[paragraphIndex].runs[runIndex].text = value
    emit({ type: 'label', pointId: selected.componentId, textDocument })
  }
  const createLabel = () => {
    const bodyId = authoredId()
    emit({ type: 'label', pointId: selected.componentId, textDocument: {
      schemaVersion: 1, componentId: bodyId,
      paragraphs: [{ componentId: `${bodyId}~authored:${crypto.randomUUID()}`, runs: [
        { componentId: `${bodyId}~authored:${crypto.randomUUID()}`, kind: 'text', text: '' },
      ] }],
    } })
  }
  const style = (name, value) => {
    const properties = selected.properties.filter((p) =>
      ['presStyleLbl', 'presStyleIdx', 'presStyleCnt'].includes(p.name) && p.name !== name)
    if (value !== '') properties.push({ name, value: name === 'presStyleLbl' ? value : Number(value) })
    emit({ type: 'style', pointId: selected.componentId, properties })
  }
  const layoutValue = (value) => {
    if (layoutDeclaration.type === 'constr' &&
      (!value.trim() || !Number.isFinite(Number(value)))) {
      setError('SmartArt layout constraint requires a finite number.')
      return
    }
    emit({ type: 'layout', declarationId: layoutDeclaration.componentId,
      attribute: layoutAttribute,
      value: layoutDeclaration.type === 'param' ? value : Number(value) })
  }
  return (
    <section aria-label="SmartArt editor" className="native-family-editor">
      {error && <div role="alert">{error}</div>}
      <fieldset disabled={blocked}>
        <legend>SmartArt logical graph</legend>
        <label>Node
          <select aria-label="SmartArt node" value={selected?.componentId ?? ''}
            onChange={(event) => setSelectedId(event.target.value)}>
            {points.map((p) => <option key={p.componentId} value={p.componentId}>{p.componentId}</option>)}
          </select>
          <span className="native-family-identity">{selected?.componentId}</span>
        </label>
        <div className="native-family-actions">
          <button type="button" onClick={add}>Add node</button>
        </div>
        {selected && <>
          <div className="native-family-actions">
            <button type="button" onClick={() => emit({ type: 'delete', pointId: selected.componentId })}>Delete node</button>
            <button type="button" disabled={!currentEdge || siblingIndex <= 0} onClick={() => reorder(-1)}>Move node earlier</button>
            <button type="button" disabled={!currentEdge || siblingIndex >= siblings.length - 1} onClick={() => reorder(1)}>Move node later</button>
          </div>
          <label>Parent
            <select aria-label="SmartArt parent" disabled={!currentEdge}
              value={currentEdge ? parents.find((p) => sameModel(p.modelId, currentEdge.sourceId))?.componentId ?? '' : ''}
              onChange={(event) => emit({ type: 'reparent', pointId: selected.componentId,
                parentId: event.target.value, connectionId: currentEdge.componentId })}>
              {!currentEdge && <option value="">Multiple or missing parents</option>}
              {parents.filter((p) => p.componentId !== selected.componentId).map((p) =>
                <option key={p.componentId} value={p.componentId}>{p.componentId}</option>)}
            </select>
            {currentEdge && <span className="native-family-identity">
              {parents.find((p) => sameModel(p.modelId, currentEdge.sourceId))?.componentId}
            </span>}
          </label>
          {selected.textDocument ? selected.textDocument.paragraphs.map((paragraph, pi) =>
            <div key={paragraph.componentId} data-smartart-paragraph={paragraph.componentId} className="space-y-2">
              {paragraph.runs.map((run, ri) => run.kind === 'break'
                ? <br key={run.componentId} />
                : <label key={run.componentId}>{run.kind === 'field' ? `Field ${run.field.type}` : 'Label'}
                  <input aria-label={`Label run ${run.componentId}`} value={run.text}
                    onChange={(event) => labelRun(pi, ri, event.target.value)} />
                </label>)}
            </div>) : <button type="button" onClick={createLabel}>Create label</button>}
          {['presStyleLbl', 'presStyleIdx', 'presStyleCnt'].map((name) => <label key={name}>{name}
            <input aria-label={`SmartArt ${name}`} type={name === 'presStyleLbl' ? 'text' : 'number'}
              value={selected.properties.find((p) => p.name === name)?.value ?? ''}
              onChange={(event) => style(name, event.target.value)} />
          </label>)}
          <label>Connection type
            <select aria-label="SmartArt connection type" value={connectionType}
              onChange={(event) => setConnectionType(event.target.value)}>
              {['presOf', 'parOf', 'presParOf'].map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>Connection target
            <select aria-label="SmartArt connection target" value={connectionTarget}
              onChange={(event) => setConnectionTarget(event.target.value)}>
              <option value="">Select node</option>
              {document.points.map((p) => <option key={p.componentId} value={p.modelId}>{p.componentId}</option>)}
            </select>
            {connectionTarget && <span className="native-family-identity">
              {document.points.find((p) => p.modelId === connectionTarget)?.componentId}
            </span>}
          </label>
          <button type="button" disabled={!connectionTarget} onClick={() => emit({
            type: 'connection', action: 'add', connection: { componentId: authoredId(),
              modelId: modelId(), type: connectionType, sourceId: selected.modelId,
              destinationId: connectionTarget, sourceOrder: 0, destinationOrder: 0 },
          })}>Add connection</button>
        </>}
        <ul aria-label="SmartArt connections">
          {document.connections.map((c) => <li key={c.componentId}>
            {c.type}: {c.sourceId} to {c.destinationId}
            <button type="button" aria-label={`Delete connection ${c.componentId}`}
              onClick={() => emit({ type: 'connection', action: 'delete', connectionId: c.componentId })}>Delete connection</button>
          </li>)}
        </ul>
        <button type="button" onClick={() => emit({ type: 'reset' })}>Reset SmartArt edits</button>
      </fieldset>
      {layoutDeclaration && <fieldset disabled={blocked}>
        <legend>SmartArt authored layout</legend>
        <label>Layout declaration
          <select aria-label="SmartArt layout declaration" value={layoutDeclaration.componentId}
            onChange={(event) => setLayoutId(event.target.value)}>
            {layoutValues.map((d) => <option key={d.componentId} value={d.componentId}>
              {d.type} {d.attributes.type} — {d.componentId}
            </option>)}
          </select>
        </label>
        <span className="native-family-identity">{layoutDeclaration.componentId}</span>
        <span>{layoutDeclaration.source.partUri} / {layoutDeclaration.source.path.join('.')}</span>
        {layoutDeclaration.type === 'param' ? <label>Parameter value
          <select aria-label="SmartArt layout value" value={layoutDeclaration.attributes.val}
            onChange={(event) => layoutValue(event.target.value)}>
            {(parameterChoices[layoutDeclaration.attributes.type] ?? []).map((value) =>
              <option key={value}>{value}</option>)}
          </select>
        </label> : <label>{layoutAttribute === 'fact' ? 'Reference factor' : 'Constraint value'}
          <input type="number" step="any"
            aria-label={layoutAttribute === 'fact' ? 'SmartArt layout factor' : 'SmartArt layout value'}
            value={layoutDeclaration.attributes[layoutAttribute]}
            onChange={(event) => layoutValue(event.target.value)} />
        </label>}
      </fieldset>}
    </section>
  )
}
