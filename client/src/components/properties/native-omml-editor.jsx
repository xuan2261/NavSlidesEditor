import React, { useState } from 'react'
import operations from 'revealjs-shared/src/pptx-omml-operations.js'
import presets from 'revealjs-shared/src/pptx-omml-operations-presets.js'
import contract from 'revealjs-shared/src/pptx-omml-document.js'
import grammar from 'revealjs-shared/src/pptx-omml-document-grammar.js'
import NativeOmmlRenderer from './native-omml-renderer.jsx'
import NativeOmmlStructureControls from './native-omml-structure-controls.jsx'
import './native-family-editor.css'

const structures = [
  ['r', 'math run'], ['f', 'fraction'], ['sSub', 'subscript'], ['sSup', 'superscript'],
  ['sSubSup', 'subscript and superscript'], ['sPre', 'prescripts'], ['rad', 'radical'],
  ['nary', 'n-ary operator'], ['m', 'matrix'], ['d', 'delimiter'], ['eqArr', 'equation array'],
  ['acc', 'accent'], ['bar', 'bar'], ['box', 'box'], ['borderBox', 'border box'],
  ['groupChr', 'group character'], ['phant', 'phantom'], ['func', 'function'],
  ['limLow', 'lower limit'], ['limUpp', 'upper limit'],
]
const containers = new Set(['m:oMath', 'm:e', 'm:num', 'm:den', 'm:deg',
  'm:sub', 'm:sup', 'm:fName', 'm:lim'])
function Tree({ node, selectedId, onSelect, depth = 0 }) {
  return <li>
    <button type="button" aria-label={`Select ${node.type} ${node.componentId}`}
      style={{ '--native-tree-depth': Math.min(depth, 3) }}
      aria-pressed={selectedId === node.componentId} onClick={() => onSelect(node.componentId)}>
      {node.type}{node.text === undefined ? '' : `: ${node.text}`}
    </button>
    {node.children.length > 0 && <ul>{node.children.map((child) =>
      <Tree key={child.componentId} node={child} selectedId={selectedId} onSelect={onSelect}
        depth={depth + 1} />)}</ul>}
  </li>
}
function EquationEditor({ document, instanceId, runtime, locked, onSemanticOperation,
  mathFrame, textDefaults, theme, onDocumentChange }) {
  const [selectedId, select] = useState(document.root.componentId)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState(null)
  let selected, parent, ancestry = []
  function visit(node, owners) {
    if (node.componentId === selectedId) {
      selected = node; parent = owners.at(-1); ancestry = [...owners, node]
    }
    node.children.forEach((child) => visit(child, [...owners, node]))
  }
  visit(document.root, [])
  selected ??= document.root
  const canEdit = !locked && (typeof onDocumentChange === 'function' || typeof onSemanticOperation === 'function')
  const insertion = containers.has(grammar.token(selected)) ? selected :
    parent && containers.has(grammar.token(parent)) ? parent : null
  const text = grammar.token(selected) === 'm:t' ? selected :
    grammar.token(selected) === 'm:r' ? selected.children.find((child) => grammar.token(child) === 'm:t') : null
  function dispatch(value) {
    if (!canEdit) return
    try {
      const command = typeof value === 'function' ? value() : value
      const next = operations.applyOmmlOperation(document, command)
      if (onDocumentChange) onDocumentChange(next)
      else onSemanticOperation({ type: 'omml.edit', instanceId,
        componentId: document.root.componentId, command })
      setDraft(null)
      setError(null)
    } catch (failure) { setError(failure.message) }
  }
  function choose(id) { select(id); setDraft(null); setError(null) }
  return <section aria-label="Native equation editor" className="native-family-editor">
    <div className="native-equation-preview">
      <NativeOmmlRenderer document={document} runtime={runtime} onSelect={choose}
        mathFrame={mathFrame} textDefaults={textDefaults} theme={theme} />
    </div>
    <details open className="native-equation-tree"><summary>Equation structure</summary>
      <ul><Tree node={document.root} selectedId={selected.componentId} onSelect={choose} /></ul>
    </details>
    {text && <label>Math run text
      <textarea aria-label="Math run text" disabled={!canEdit}
        aria-invalid={Boolean(error)} value={draft ?? text.text}
        onChange={(event) => {
          setDraft(event.target.value)
          dispatch({ type: 'setText', componentId: text.componentId, text: event.target.value })
        }} />
    </label>}
    <NativeOmmlStructureControls document={document} ancestry={ancestry}
      disabled={!canEdit} onCommand={dispatch} />
    <div className="native-family-actions">
      {structures.map(([type, label]) => <button key={type} type="button"
        disabled={!canEdit || !insertion} onClick={() => {
          if (!canEdit || !insertion) return
          dispatch(() => ({ type: 'insert', componentId: insertion.componentId,
            index: insertion.children.length,
            node: presets.createOmmlStructure(document, type, globalThis.crypto.randomUUID()) }))
        }}>Insert {label}</button>)}
      <button type="button" disabled={!canEdit || !parent} onClick={() =>
        dispatch({ type: 'remove', componentId: selected.componentId })}>Remove selected structure</button>
    </div>
    {error && <p role="alert">{error}</p>}
  </section>
}
export default function NativeOmmlEditor(props) {
  let document
  try { document = contract.normalizeOmmlDocument(props.document) }
  catch (error) { return <p role="alert">{error.message}</p> }
  return <EquationEditor key={`${props.instanceId}:${document.root.componentId}`}
    {...props} document={document} />
}
