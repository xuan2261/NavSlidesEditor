import React, { useState } from 'react'
import structure from 'revealjs-shared/src/pptx-omml-operations-structure.js'
import grammar from 'revealjs-shared/src/pptx-omml-document-grammar.js'

function propertyValue(node, name) {
  return node.children.find((child) => grammar.token(child) === `m:${node.type}Pr`)
    ?.children.find((child) => grammar.token(child) === `m:${name}`)
    ?.attributes.find((attr) => grammar.token({ namespaceUri: attr.namespaceUri, type: attr.name }) === 'm:val')?.value
}
function MatrixControls({ document, matrix, disabled, onCommand }) {
  const [selectedRow, setRow] = useState(0), [selectedColumn, setColumn] = useState(0)
  const rows = matrix.children.filter((child) => grammar.token(child) === 'm:mr')
  const row = Math.min(selectedRow, rows.length - 1)
  const column = Math.min(selectedColumn, rows[0].children.length - 1)
  function change(axis, action, index) {
    onCommand(() => structure.createOmmlMatrixCommand(document, matrix.componentId,
      { axis, action, index }, globalThis.crypto.randomUUID()))
  }
  return <fieldset disabled={disabled}>
    <legend>Matrix structure</legend>
    <label>Matrix row<select aria-label="Matrix row" value={row}
      onChange={(event) => setRow(Number(event.target.value))}>
      {rows.map((entry, index) => <option key={entry.componentId} value={index}>{index + 1}</option>)}
    </select></label>
    <label>Matrix column<select aria-label="Matrix column" value={column}
      onChange={(event) => setColumn(Number(event.target.value))}>
      {rows[0].children.map((entry, index) => <option key={entry.componentId} value={index}>{index + 1}</option>)}
    </select></label>
    <button type="button" onClick={() => change('row', 'insert', row + 1)}>Insert matrix row after</button>
    <button type="button" disabled={rows.length === 1}
      onClick={() => change('row', 'remove', row)}>Delete matrix row</button>
    <button type="button" onClick={() => change('column', 'insert', column + 1)}>Insert matrix column after</button>
    <button type="button" disabled={rows[0].children.length === 1}
      onClick={() => change('column', 'remove', column)}>Delete matrix column</button>
  </fieldset>
}
const fields = {
  f: ['Fraction presentation', 'type', [['bar', 'Stacked fraction'], ['skw', 'Skewed fraction'],
    ['lin', 'Linear fraction'], ['noBar', 'No fraction bar']]],
  rad: ['Radical degree visibility', 'degHide', [['0', 'Show degree'], ['1', 'Hide degree']]],
  r: ['Math run style', 'sty', [['p', 'Plain'], ['b', 'Bold'], ['i', 'Italic'], ['bi', 'Bold italic']]],
  m: ['Matrix vertical alignment', 'baseJc', [['top', 'Top'], ['center', 'Center'], ['bottom', 'Bottom']]],
  eqArr: ['Equation array alignment', 'baseJc', [['top', 'Top'], ['center', 'Center'], ['bottom', 'Bottom']]],
}
export default function NativeOmmlStructureControls({ document, ancestry, disabled, onCommand }) {
  const owners = [...ancestry].reverse()
  const matrix = owners.find((node) => grammar.token(node) === 'm:m')
  const owner = owners.find((node) => Object.hasOwn(fields, node.type))
  const field = owner && fields[owner.type]
  return <>
    {field && <label>{field[0]}<select aria-label={field[0]} disabled={disabled}
      value={propertyValue(owner, field[1]) ?? ''} onChange={(event) => {
        const text = event.target.value
        onCommand(() => structure.createOmmlPropertyCommand(document, owner.componentId,
          field[1], text, globalThis.crypto.randomUUID()))
      }}>
      <option value="" disabled>Source default</option>
      {field[2].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>}
    {matrix && <MatrixControls key={matrix.componentId} document={document} matrix={matrix}
      disabled={disabled} onCommand={onCommand} />}
  </>
}
