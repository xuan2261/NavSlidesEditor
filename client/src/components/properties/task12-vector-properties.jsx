import { useState } from 'react'
import { PARAMETERS } from 'revealjs-shared/src/pptx-vector-primitives.js'
import './native-family-editor.css'

function NumberField({ label, value, disabled, onCommit }) {
  const [draft, setDraft] = useState(null)
  const text = draft ?? String(value ?? 0)
  const valid = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text) &&
    Number.isFinite(Number(text)) && Math.abs(Number(text)) <= 1e12
  function commit() {
    if (draft !== null && valid && Number(text) !== (value ?? 0)) onCommit(Number(text))
    setDraft(null)
  }
  return <label>{label}<input aria-label={label} inputMode="decimal" value={text}
    disabled={disabled} aria-invalid={!valid} onChange={(event) => setDraft(event.target.value)}
    onBlur={commit} onKeyDown={(event) => {
      if (event.key === 'Enter') event.currentTarget.blur()
      if (event.key === 'Escape') setDraft(null)
    }} /></label>
}

function VectorProperties({ document, instanceId, disabled, onSemanticOperation }) {
  const [selectedId, setSelectedId] = useState(document.paths[0].componentId)
  const [error, setError] = useState(null)
  const path = document.paths.find((item) => item.componentId === selectedId) ?? document.paths[0]
  const blocked = disabled || !onSemanticOperation
  async function execute(command) {
    if (blocked) return
    try {
      await onSemanticOperation({ type: 'svg.edit', instanceId, componentId: document.componentId,
        command: { pathId: path.componentId, ...command } })
      setError(null)
    } catch (failure) { setError(failure.message || 'The vector edit was rejected.') }
  }
  const primitive = path.primitive
  return <section className="native-family-editor" aria-label="Native SVG vector editor">
    <label>Vector component<select aria-label="Vector component" value={path.componentId}
      onChange={(event) => { setSelectedId(event.target.value); setError(null) }}>
      {document.paths.map((item, index) => <option key={item.componentId} value={item.componentId}>
        {index + 1}: {item.primitive?.kind ?? 'path'}
      </option>)}
    </select></label>
    <p className="native-family-identity">Coordinates remain in the source SVG viewBox.</p>
    {primitive ? <fieldset disabled={blocked}><legend>{primitive.kind} parameters</legend>
      {PARAMETERS[primitive.kind].filter((name) => name !== 'points').map((name) =>
        <NumberField key={`${path.componentId}:${name}`} label={`Vector ${name}`}
          value={primitive.parameters[name]} disabled={blocked}
          onCommit={(value) => execute({ type: 'edit-primitive', parameters: { [name]: value } })} />)}
      {primitive.parameters.points?.map((point, index) => <div key={index}>
        {['x', 'y'].map((axis) => <NumberField key={axis} label={`Vector vertex ${index + 1} ${axis}`}
          value={point[axis]} disabled={blocked} onCommit={(value) => execute({ type: 'edit-primitive',
            parameters: { points: primitive.parameters.points.map((item, at) => at === index ? { ...item, [axis]: value } : item) } })} />)}
      </div>)}
      <p>Converting preserves appearance and source ownership, but replaces primitive parameters with editable path points.</p>
      <button type="button" disabled={blocked} onClick={() => execute({ type: 'convert-to-path' })}>Convert primitive to editable path</button>
    </fieldset> : <fieldset disabled={blocked}><legend>Path components</legend>
      {path.geometry.paths.map((geometryPath) => geometryPath.commands.map((command, index) =>
        <div key={`${geometryPath.componentId}:${index}`}>
          {command.points?.map((point, at) => <div key={point.componentId}>
            {['x', 'y'].map((axis) => <NumberField key={axis}
              label={`Path command ${index + 1} point ${at + 1} ${axis}`} value={point[axis]} disabled={blocked}
              onCommit={(value) => execute({ type: 'edit-path', geometryCommand: {
                type: 'control-point', componentId: point.componentId, [axis]: value } })} />)}
          </div>)}
          {command.kind === 'arcTo' && ['wR', 'hR', 'stAng', 'swAng'].map((parameter) =>
            <NumberField key={parameter} label={`Arc ${index + 1} ${parameter}`} value={command[parameter]}
              disabled={blocked} onCommit={(value) => execute({ type: 'edit-path', geometryCommand: {
                type: 'arc-parameter', pathId: geometryPath.componentId, commandIndex: index, parameter, value } })} />)}
        </div>))}
    </fieldset>}
    {error && <p role="alert">{error}</p>}
  </section>
}

export default function Task12VectorProperties(props) {
  // Source component IDs are shared by occurrences; drafts and errors are not.
  return <VectorProperties key={`${props.instanceId}:${props.document.componentId}`} {...props} />
}
