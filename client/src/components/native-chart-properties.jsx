import { useState } from 'react'
import chartOperations from 'revealjs-shared/src/pptx-chart-operations.js'
import chartDocumentContract from 'revealjs-shared/src/pptx-chart-document.js'

function Draft({ value, label, numeric, disabled, commit }) {
  const [draft, setDraft] = useState(null)
  const text = draft ?? String(value)
  const valid = !numeric || (text.trim() !== '' && Number.isFinite(Number(text)))
  return <input aria-label={label} aria-invalid={!valid} disabled={disabled}
    className="mb-1 w-full border border-border bg-card text-xs"
    value={text} onChange={event => setDraft(event.target.value)}
    onBlur={() => {
      if (draft !== null && valid) {
        commit(numeric ? Number(text) : text)
        setDraft(null)
      }
    }} />
}
function Option({ name, value, label, disabled, commit, choices }) {
  const type = chartDocumentContract.CHART_OPTION_TYPES[name]
  const values = choices ?? (Array.isArray(type) && typeof type[0] === 'string' ? type :
    type === 'boolean' ? [true, false] : null)
  if (values) return <label>{label}<select aria-label={label} disabled={disabled}
    value={value === undefined ? '' : String(value)} onChange={event => {
      if (event.target.value !== '') commit(type === 'boolean' ? event.target.value === 'true' : event.target.value)
    }}>
    <option value="">Source default</option>
    {values.map(v => <option key={String(v)} value={String(v)}>{String(v)}</option>)}
  </select></label>
  return <label>{label}<Draft label={label} value={value ?? ''} disabled={disabled}
    numeric={type !== 'string'} commit={commit} /></label>
}
function EditableTitle({ channel, label, disabled, set, convert }) {
  const reference = channel?.kind.endsWith('Ref')
  const value = channel?.kind === 'text' ? channel.value : channel?.cache?.points?.[0]?.value ?? ''
  const singleText = channel?.kind === 'strLit' && channel.cache.count === 1 && channel.cache.points.length === 1
  return <div>
    {reference && <p>{label} source reference: {channel.formula}
      <button type="button" aria-label={`Convert ${label} cache to project-local data`}
        disabled={disabled || channel.kind !== 'strRef' || !channel.cache}
        onClick={convert}>Convert cached snapshot to local data</button></p>}
    {channel?.detachedFrom && <p>{label} detached cached snapshot of {channel.detachedFrom.formula}; formulas are not evaluated.</p>}
    <label>{label}<Draft label={label} value={value}
      disabled={disabled || Boolean(channel && channel.kind !== 'text' && !singleText)} commit={set} /></label>
  </div>
}
function Channel({ series, name, channel, disabled, send }) {
  const reference = channel.kind.endsWith('Ref')
  const label = series.data.tx?.kind === 'text' ? series.data.tx.value : series.id
  return <fieldset className="mb-2">
    <legend>{name}{reference ? ` (source reference: ${channel.formula})` : ''}</legend>
    {channel.detachedFrom && <p>Project-local cached snapshot of {channel.detachedFrom.formula}; source reference preserved, not evaluated.</p>}
    {channel.kind === 'multiLvlStrRef' && <p>Hierarchical categories remain source-bound; flattening conversion is not supported.</p>}
    {reference && <button type="button" disabled={disabled || !channel.cache || channel.kind === 'multiLvlStrRef'}
      aria-label={`Convert ${label} ${name} cache to project-local data`}
      onClick={() => send({ type: 'chart.data.convert-local', seriesId: series.id,
        channel: name, basis: 'cache-snapshot' })}>
      Convert cached snapshot to local data
    </button>}
    {channel.cache?.points?.map(point => <Draft key={point.source.definitionId}
      label={`${label} ${name} point ${point.index}`} value={point.value}
      numeric={channel.kind.startsWith('num')} disabled={disabled || reference}
      commit={value => send({ type: 'chart.data.set-point', seriesId: series.id,
        channel: name, index: point.index, value })} />)}
  </fieldset>
}
function Controls({ chartDocument: d, instanceId, locked, onSemanticOperation }) {
  const [error, setError] = useState('')
  const disabled = locked || !onSemanticOperation || !instanceId
  const send = command => {
    if (disabled) return
    // Apply the same reducer before dispatch, never send a writable document.
    try {
      if (command.type !== 'reset') chartOperations.applyChartOperation(d, command)
    } catch (failure) {
      if (!(failure instanceof TypeError)) throw failure
      setError(failure.message)
      return
    }
    setError('')
    onSemanticOperation({ type: 'chart.edit', instanceId,
      componentId: d.source.ownerDefinitionId, command })
  }
  return <div className="text-xs" data-native-chart-properties>
    {error && <p role="alert">{error}</p>}
    <p>Edits apply to this NavSlides occurrence. Reference conversion uses cached values,
      not formula calculation. Original workbook and PPTX remain unchanged.</p>
    <p>{d.source.partUri}</p>
    {d.workbook && <details><summary>Preserved source workbook</summary>
      <p>{d.workbook.target} (external fetching denied)</p>
      {d.workbook.literalData?.sheets.map(sheet => <p key={sheet.sheetId}>
        {sheet.name}: {sheet.cells.length} literal cell records;
        {' '}{sheet.cells.filter(cell => cell.formula).length} formula snapshots (not evaluated)
      </p>)}
    </details>}
    <button type="button" disabled={disabled} onClick={() => send({ type: 'reset' })}>
      Reset chart occurrence to source
    </button>
    <EditableTitle channel={d.title} label="Chart title" disabled={disabled}
      set={value => send({ type: 'chart.title.set', value })}
      convert={() => send({ type: 'chart.title.convert-local', basis: 'cache-snapshot' })} />
    <label>Native style<Draft numeric label="Chart style" value={d.style ?? ''}
      disabled={disabled} commit={value => {
        if (Number.isInteger(value) && value >= 1 && value <= 48)
          send({ type: 'chart.style.set', value })
      }} /></label>
    <label>Legend position<select aria-label="Legend position" disabled={disabled}
      value={d.legend?.legendPos ?? 't'}
      onChange={e => send({ type: 'chart.options.set', target: 'legend',
        values: { legendPos: e.target.value } })}>
      {['t', 'b', 'l', 'r', 'tr'].map(v => <option key={v} value={v}>{v}</option>)}
    </select></label>
    {d.plots.map((plot, plotIndex) => <section key={plotIndex}>
      <h3>{plot.family}</h3>
      {chartOperations.PLOT_OPTIONS[plot.family].map(name => <Option key={name} name={name}
        label={`Plot ${plotIndex} ${name}`} value={plot.options[name]} disabled={disabled}
        choices={name === 'grouping' && !plot.family.startsWith('bar')
          ? ['standard', 'stacked', 'percentStacked'] : name === 'splitType' ? ['auto', 'percent', 'pos', 'val'] : undefined}
        commit={value => send({ type: 'chart.options.set', target: 'plot', plotIndex,
          values: { [name]: value } })} />)}
      {plot.series.map(series => <section key={series.id}>
        <EditableTitle channel={series.data.tx} label={`${series.id} series name`} disabled={disabled}
          set={value => send({ type: 'chart.series.rename', seriesId: series.id, value })}
          convert={() => send({ type: 'chart.data.convert-local', seriesId: series.id,
            channel: 'tx', basis: 'cache-snapshot' })} />
        {['smooth', 'explosion', 'bubble3D', 'shape', 'invertIfNegative']
          .filter(name => chartOperations.seriesOptionAllowed(plot.family, name)).map(name =>
            <Option key={name} name={name} label={`${series.id} ${name}`}
              value={series.options[name]} disabled={disabled}
              commit={value => send({ type: 'chart.options.set', target: 'series', seriesId: series.id,
                values: { [name]: value } })} />)}
        {['lineChart', 'line3DChart', 'scatterChart', 'radarChart'].includes(plot.family) &&
          ['symbol', 'size'].map(name => <Option key={name} name={name}
            label={`${series.id} marker ${name}`} value={series.marker?.[name]} disabled={disabled}
            choices={name === 'symbol' ? chartDocumentContract.CHART_OPTION_TYPES.symbol.filter(v => v !== 'picture') : undefined}
            commit={value => send({ type: 'chart.marker.set', seriesId: series.id, values: { [name]: value } })} />)}
        <label>Series fill<input type="color" aria-label={`${series.id} series fill`}
          disabled={disabled}
          value={`#${series.paint?.fill?.color ?? '000000'}`}
          onChange={event => send({ type: 'chart.paint.set', target: 'series', seriesId: series.id,
            value: { ...series.paint, fill: { kind: 'solid', color: event.target.value.slice(1) } } })} /></label>
        {(series.data.val ?? series.data.yVal)?.cache?.points.map(point => {
          const style = series.pointStyles?.find(p => p.index === point.index)?.paint
          return <label key={point.source.definitionId}>Point {point.index} fill<input type="color"
            aria-label={`${series.id} point ${point.index} fill`} disabled={disabled}
            value={`#${style?.fill?.color ?? series.paint?.fill?.color ?? '000000'}`}
            onChange={event => send({ type: 'chart.point.paint.set', seriesId: series.id, index: point.index,
              value: { ...style, fill: { kind: 'solid', color: event.target.value.slice(1) } } })} /></label>
        })}
        {Object.entries(series.data).filter(([, c]) => c.kind !== 'text').map(([name, channel]) =>
          <Channel key={name} {...{ series, name, channel, disabled, send }} />)}
        <label>Show values<input type="checkbox" aria-label={`${series.id} show values`}
          disabled={disabled} checked={series.dataLabels?.options.showVal ?? false}
          onChange={e => send({ type: 'chart.options.set', target: 'labels', seriesId: series.id,
            values: { showVal: e.target.checked } })} /></label>
      </section>)}
    </section>)}
    {d.axes.map(axis => <fieldset key={axis.id}>
      <legend>Axis {axis.id} ({axis.kind})</legend>
      <EditableTitle channel={axis.title} label={`Axis ${axis.id} title`} disabled={disabled}
        set={value => send({ type: 'chart.axis.title.set', axisId: axis.id, value })}
        convert={() => send({ type: 'chart.axis.title.convert-local', axisId: axis.id, basis: 'cache-snapshot' })} />
      {(['valAx', 'dateAx'].includes(axis.kind) ? ['min', 'max'] : []).map(name => <Draft key={name} numeric disabled={disabled}
        label={`Axis ${axis.id} ${name}`} value={axis.scaling?.[name] ?? ''}
        commit={value => {
          const other = axis.scaling?.[name === 'min' ? 'max' : 'min']
          if (other !== undefined && (name === 'min' ? value >= other : value <= other)) return
          send({ type: 'chart.options.set', target: 'axis', axisId: axis.id, values: { [name]: value } })
        }} />)}
      {['orientation', 'axPos', 'delete', 'logBase', 'majorUnit', 'minorUnit', 'crosses',
        'crossesAt', 'crossBetween', 'tickLblPos', 'majorTickMark', 'minorTickMark']
        .filter(name => !(['majorUnit', 'minorUnit'].includes(name) && !['valAx', 'dateAx'].includes(axis.kind) ||
          ['logBase', 'crossBetween'].includes(name) && axis.kind !== 'valAx')).map(name =>
        <Option key={name} name={name} label={`Axis ${axis.id} ${name}`}
          value={axis.scaling?.[name] ?? axis.options[name]} disabled={disabled}
          commit={value => send({ type: 'chart.options.set', target: 'axis', axisId: axis.id,
            values: { [name]: value } })} />)}
    </fieldset>)}
    {d.plots.every(p => ['bar3DChart', 'line3DChart', 'area3DChart', 'pie3DChart', 'surface3DChart'].includes(p.family)) &&
      <fieldset><legend>Source 3D view</legend>
        {['rotX', 'rotY', 'depthPercent', 'hPercent', 'perspective'].map(name =>
          <Draft key={name} numeric label={`3D ${name}`} value={d.view3D?.[name] ?? ''} disabled={disabled}
            commit={value => send({ type: 'chart.view3D.set', values: { [name]: value } })} />)}
        <label>Right angle axes<input type="checkbox" aria-label="3D right angle axes" disabled={disabled}
          checked={d.view3D?.rAngAx ?? true} onChange={event => send({ type: 'chart.view3D.set',
            values: { rAngAx: event.target.checked } })} /></label>
      </fieldset>}
  </div>
}
export default function NativeChartProperties(props) {
  const d = chartDocumentContract.normalizeChartDocument(props.chartDocument)
  return <Controls key={`${props.instanceId}:${d.source.ownerDefinitionId}`}
    {...props} chartDocument={d} />
}
