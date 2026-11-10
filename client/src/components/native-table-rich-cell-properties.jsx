import { editTableCellText, authoredTableTextId } from './native-table-rich-text'

export default function NativeTableRichCellProperties({ cell, row, column, dispatch, disabled }) {
  const body = cell.textDocument
  const edit = (change) => dispatch(() => editTableCellText(cell, change))
  const runProperties = (p, i, patch) => edit((text) => {
    const run = text.paragraphs[p].runs[i]
    run.properties = { ...run.properties, ...patch }
  })
  const paragraphProperties = (p, patch) => edit((text) => {
    const paragraph = text.paragraphs[p]
    paragraph.properties = { ...paragraph.properties, ...patch }
  })
  const addRun = (p, kind) => edit((text) => {
    const paragraph = text.paragraphs[p]
    const previous = paragraph.runs.at(-1)
    const properties = previous?.properties ?? paragraph.endRunProperties ?? paragraph.defaultRunProperties
    paragraph.runs.push({ componentId: authoredTableTextId(body.componentId, kind, crypto.randomUUID()),
      kind, ...(kind === 'text' ? { text: '' } : {}),
      ...(properties ? { properties: structuredClone(properties) } : {}) })
  })
  const prefix = `Cell ${row + 1},${column + 1}`
  return <fieldset disabled={disabled}>
    <legend>{prefix}</legend>
    {body.paragraphs.map((paragraph, p) => <fieldset key={paragraph.componentId}>
      <legend>Paragraph {p + 1}</legend>
      <label>Alignment
        <select aria-label={`${prefix} paragraph ${p + 1} alignment`}
          disabled={disabled}
          value={paragraph.properties?.alignment ?? ''}
          onChange={(event) => paragraphProperties(p, { alignment: event.target.value })}>
          <option value="" disabled>Source default</option>
          {['l', 'ctr', 'r', 'just', 'justLow', 'dist', 'thaiDist'].map((value) =>
            <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label>Direction
        <select aria-label={`${prefix} paragraph ${p + 1} direction`}
          disabled={disabled}
          value={paragraph.properties?.direction ?? ''}
          onChange={(event) => paragraphProperties(p, { direction: event.target.value })}>
          <option value="" disabled>Source default</option>
          <option value="ltr">Left to right</option><option value="rtl">Right to left</option>
        </select>
      </label>
      <label>Bullet
        <select aria-label={`${prefix} paragraph ${p + 1} bullet`}
          disabled={disabled}
          value={paragraph.properties?.bullet?.kind ?? ''}
          onChange={(event) => paragraphProperties(p, { bullet: event.target.value === 'character'
            ? { kind: 'character', character: '•' } : event.target.value === 'number'
              ? { kind: 'number', scheme: 'arabicPeriod', startAt: 1 } : { kind: 'none' } })}>
          <option value="" disabled>Source default</option>
          <option value="none">None</option><option value="character">Bullet</option>
          <option value="number">Numbered</option>
        </select>
      </label>
      {paragraph.runs.map((run, i) => {
        const label = `${prefix} paragraph ${p + 1} run ${i + 1}`
        const properties = { ...paragraph.defaultRunProperties, ...run.properties }
        return <fieldset key={run.componentId}>
          <legend>Run {i + 1} ({run.kind})</legend>
          {run.kind === 'text' ? <textarea aria-label={label} value={run.text} disabled={disabled}
            onChange={(event) => edit((text) => { text.paragraphs[p].runs[i].text = event.target.value })} />
            : <span>{run.kind === 'break' ? 'Line break' : run.kind === 'field'
              ? `Field ${run.field.type}: ${run.text}` : 'Equation'}</span>}
          <label>Size (pt)
            <input aria-label={`${label} size (pt)`} type="number" min="1" max="4000" step="0.01"
              disabled={disabled}
              value={properties.fontSizePt ?? ''} onChange={(event) => event.target.value !== '' &&
                runProperties(p, i, { fontSizePt: Number(event.target.value) })} />
          </label>
          {['bold', 'italic'].map((name) => <label key={name}>{name}
            <input aria-label={`${label} ${name}`} type="checkbox" checked={properties[name] ?? false}
              disabled={disabled}
              onChange={(event) => runProperties(p, i, { [name]: event.target.checked })} />
          </label>)}
          <label>Underline
            <input aria-label={`${label} underline`} type="checkbox"
              disabled={disabled}
              checked={properties.underline !== undefined && properties.underline !== 'none'}
              onChange={(event) => runProperties(p, i, { underline: event.target.checked ? 'sng' : 'none' })} />
          </label>
          <label>Text RGB
            <input key={JSON.stringify(properties.color)} aria-label={`${label} color RGB`}
              disabled={disabled}
              placeholder="RRGGBB" maxLength="6"
              defaultValue={properties.color?.kind === 'srgb' ? properties.color.value : ''}
              onBlur={(event) => {
                const value = event.target.value
                if (!value || (properties.color?.kind === 'srgb' &&
                    properties.color.value.toUpperCase() === value.toUpperCase())) return
                runProperties(p, i, { color: { kind: 'srgb', value: value.toUpperCase() } })
              }} />
          </label>
          <button type="button" aria-label={`Delete ${label}`} disabled={disabled} onClick={() => edit((text) => {
            text.paragraphs[p].runs.splice(i, 1)
          })}>Delete run</button>
        </fieldset>
      })}
      <button type="button" aria-label={`Add text run to ${prefix} paragraph ${p + 1}`}
        disabled={disabled}
        onClick={() => addRun(p, 'text')}>Add text run</button>
      <button type="button" aria-label={`Add line break to ${prefix} paragraph ${p + 1}`}
        disabled={disabled}
        onClick={() => addRun(p, 'break')}>Add line break</button>
      <button type="button" aria-label={`Delete ${prefix} paragraph ${p + 1}`}
        disabled={disabled}
        onClick={() => edit((text) => { text.paragraphs.splice(p, 1) })}>Delete paragraph</button>
    </fieldset>)}
    <button type="button" aria-label={`Add paragraph to ${prefix}`} onClick={() => edit((text) => {
      const previous = text.paragraphs.at(-1)
      const properties = previous?.endRunProperties ?? previous?.defaultRunProperties
      text.paragraphs.push({
        componentId: authoredTableTextId(body.componentId, 'paragraph', crypto.randomUUID()),
        ...(previous?.properties ? { properties: structuredClone(previous.properties) } : {}),
        ...(properties ? { defaultRunProperties: structuredClone(properties) } : {}),
        runs: [{ componentId: authoredTableTextId(body.componentId, 'text', crypto.randomUUID()),
          kind: 'text', text: '' }],
      })
    })}>Add paragraph</button>
  </fieldset>
}
