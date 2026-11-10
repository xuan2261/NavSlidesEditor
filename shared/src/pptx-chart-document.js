// Source chart semantics. Caches are snapshots, never project-local formula edits.
const { validateChartVisual } = require('./pptx-chart-visual-contract')
const { validateView3D, validatePlotGeometry } = require('./pptx-chart-native-contract')
const CHART_FAMILIES = Object.freeze([
  'barChart',
  'bar3DChart',
  'lineChart',
  'line3DChart',
  'areaChart',
  'area3DChart',
  'pieChart',
  'pie3DChart',
  'doughnutChart',
  'ofPieChart',
  'scatterChart',
  'bubbleChart',
  'radarChart',
  'stockChart',
  'surfaceChart',
  'surface3DChart',
])
const CHART_OPTION_TYPES = Object.freeze({
  barDir: ['bar', 'col'],
  grouping: ['standard', 'clustered', 'stacked', 'percentStacked'],
  scatterStyle: ['none', 'line', 'lineMarker', 'marker', 'smooth', 'smoothMarker'],
  radarStyle: ['standard', 'marker', 'filled'],
  ofPieType: ['pie', 'bar'],
  shape: ['box', 'cone', 'coneToMax', 'cylinder', 'pyramid', 'pyramidToMax'],
  axPos: ['b', 'l', 'r', 't'],
  orientation: ['minMax', 'maxMin'],
  crosses: ['autoZero', 'max', 'min'],
  crossBetween: ['between', 'midCat'],
  lblAlgn: ['ctr', 'l', 'r'],
  tickLblPos: ['high', 'low', 'nextTo', 'none'],
  majorTickMark: ['cross', 'in', 'none', 'out'],
  minorTickMark: ['cross', 'in', 'none', 'out'],
  legendPos: ['b', 'tr', 'l', 'r', 't'],
  dLblPos: ['bestFit', 'b', 'ctr', 'inBase', 'inEnd', 'l', 'outEnd', 'r', 't'],
  dispBlanksAs: ['span', 'gap', 'zero'],
  symbol: [
    'circle',
    'dash',
    'diamond',
    'dot',
    'none',
    'picture',
    'plus',
    'square',
    'star',
    'triangle',
    'x',
    'auto',
  ],
  size: [2, 72],
  holeSize: [10, 90],
  firstSliceAng: [0, 360],
  gapWidth: [0, 500],
  gapDepth: [0, 500],
  overlap: [-100, 100],
  bubbleScale: [0, 300],
  secondPieSize: [5, 200],
  explosion: [0, 400],
  lblOffset: [0, 1000],
  tickLblSkip: [1, 2147483647],
  tickMarkSkip: [1, 2147483647],
  min: 'number',
  max: 'number',
  logBase: [2, 1000],
  majorUnit: 'positive',
  minorUnit: 'positive',
  crossesAt: 'number',
  splitPos: 'number',
  splitType: ['auto', 'cust', 'percent', 'pos', 'val'],
  separator: 'string',
  formatCode: 'string',
  sourceLinked: 'boolean',
  varyColors: 'boolean',
  smooth: 'boolean',
  marker: 'boolean',
  wireframe: 'boolean',
  bubble3D: 'boolean',
  invertIfNegative: 'boolean',
  showNegBubbles: 'boolean',
  sizeRepresents: ['area', 'w'],
  showLegendKey: 'boolean',
  showVal: 'boolean',
  showCatName: 'boolean',
  showSerName: 'boolean',
  showPercent: 'boolean',
  showBubbleSize: 'boolean',
  showLeaderLines: 'boolean',
  delete: 'boolean',
  auto: 'boolean',
  noMultiLvlLbl: 'boolean',
  overlay: 'boolean',
  plotVisOnly: 'boolean',
  showDLblsOverMax: 'boolean',
  autoTitleDeleted: 'boolean',
  roundedCorners: 'boolean',
  date1904: 'boolean',
})
const fail = (path) => {
  throw new TypeError(`Invalid PPTX chart contract: ${path}`)
}
function object(value, keys, path) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    fail(path)
}
function string(value, path) {
  if (typeof value !== 'string' || value.length > 1048576) fail(path)
}
function integer(value, path, max = 2147483647) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) fail(path)
}
function array(value, path) {
  if (!Array.isArray(value) || value.length > 100000) fail(path)
}
function source(value) {
  object(value, ['definitionId', 'partUri', 'preconditionHash', 'path'], 'source component')
  if (!value.definitionId || !value.partUri || !/^[a-f0-9]{64}$/.test(value.preconditionHash))
    fail('source identity')
  string(value.definitionId, 'definitionId')
  string(value.partUri, 'partUri')
  array(value.path, 'path')
  if (!value.path.length) fail('path')
  value.path.forEach((n) => integer(n, 'path'))
}
function validateChartOption(name, value) {
  const type = CHART_OPTION_TYPES[name]
  if (!type) fail(`option ${name}`)
  if (Array.isArray(type)) {
    if (
      typeof type[0] === 'string'
        ? !type.includes(value)
        : !Number.isInteger(value) || value < type[0] || value > type[1]
    )
      fail(name)
  } else if (type === 'number' || type === 'positive') {
    if (!Number.isFinite(value) || (type === 'positive' && value <= 0)) fail(name)
  } else if (typeof value !== type) fail(name)
  if (typeof value === 'string') string(value, name)
  return value
}
function options(value) {
  object(value, Object.keys(CHART_OPTION_TYPES), 'options')
  for (const [name, v] of Object.entries(value)) validateChartOption(name, v)
}
function data(value) {
  object(value, ['kind', 'formula', 'cache', 'value', 'textStyle', 'detachedFrom'], 'data')
  if ('detachedFrom' in value) {
    const origin = value.detachedFrom
    object(origin, ['kind', 'formula', 'basis'], 'detachment provenance')
    if (!['numRef', 'strRef'].includes(origin.kind) || origin.basis !== 'cache-snapshot' ||
        value.kind !== origin.kind.replace('Ref', 'Lit')) fail('detachment provenance')
    string(origin.formula, 'detached formula')
    if (!origin.formula.trim()) fail('detached formula')
  }
  if (value.textStyle) validateChartVisual(value.textStyle, 'textStyle')
  if (value.kind === 'text') {
    string(value.value, 'text')
    if (Object.keys(value).some(k => !['kind', 'value', 'textStyle'].includes(k))) fail('text fields')
    return
  }
  if (!['numLit', 'strLit', 'numRef', 'strRef', 'multiLvlStrRef'].includes(value.kind)) fail('data kind')
  if (value.kind.endsWith('Ref')) {
    string(value.formula, 'formula')
    if (!value.formula.trim()) fail('formula')
  } else if ('formula' in value) fail('literal formula')
  if ('value' in value) fail('cache value')
  if (!value.cache) {
    if (value.kind.endsWith('Lit')) fail('literal cache')
    return
  }
  object(value.cache, ['count', 'formatCode', 'points', 'levels'], 'cache')
  integer(value.cache.count, 'cache count', 100000)
  if ('formatCode' in value.cache) string(value.cache.formatCode, 'formatCode')
  if (value.kind === 'multiLvlStrRef') {
    if ('points' in value.cache || 'formatCode' in value.cache) fail('hierarchical category cache fields')
    array(value.cache.levels, 'category levels')
    if (!value.cache.levels.length) fail('missing category levels')
    const paths = new Set()
    for (const level of value.cache.levels) {
      object(level, ['source', 'points'], 'category level')
      object(level.source, ['partUri', 'preconditionHash', 'path'], 'category level origin')
      const origin = level.source
      if (!origin.partUri || !/^[a-f0-9]{64}$/.test(origin.preconditionHash)) fail('category level source')
      array(origin.path, 'category level path')
      if (!origin.path.length) fail('category level path')
      origin.path.forEach(n => integer(n, 'category level path'))
      const path = JSON.stringify(origin.path)
      if (paths.has(path)) fail('duplicate category level')
      paths.add(path)
      data({ kind: 'strLit', cache: { count: value.cache.count, points: level.points } })
      for (const point of level.points)
        if (point.source.partUri !== origin.partUri || point.source.preconditionHash !== origin.preconditionHash ||
            point.source.path.length !== origin.path.length + 1 ||
            !origin.path.every((n, i) => point.source.path[i] === n)) fail('category level point owner')
    }
    return
  }
  if ('levels' in value.cache) fail('unexpected category levels')
  array(value.cache.points, 'cache points')
  const indices = new Set()
  for (const p of value.cache.points) {
    object(p, ['index', 'value', 'lexicalValue', 'source'], 'cache point')
    integer(p.index, 'point index')
    if (p.index >= value.cache.count || indices.has(p.index)) fail('point index/count')
    indices.add(p.index)
    source(p.source)
    if (value.kind.startsWith('num')) {
      if (!Number.isFinite(p.value)) fail('numeric point')
      string(p.lexicalValue, 'numeric lexicalValue')
      if (
        !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(p.lexicalValue) ||
        Number(p.lexicalValue) !== p.value
      )
        fail('numeric lexicalValue')
    } else {
      string(p.value, 'string point')
      if ('lexicalValue' in p) fail('string lexicalValue')
    }
  }
}
function labels(value) {
  object(value, ['options', 'labels', 'textStyle', 'numberFormat'], 'data labels')
  if (value.textStyle) validateChartVisual(value.textStyle, 'textStyle')
  if (value.numberFormat) options(value.numberFormat)
  options(value.options)
  array(value.labels, 'labels')
  const seen = new Set()
  for (const label of value.labels) {
    object(label, ['index', 'options', 'text', 'textStyle', 'numberFormat'], 'label')
    if (label.textStyle) validateChartVisual(label.textStyle, 'textStyle')
    if (label.numberFormat) options(label.numberFormat)
    integer(label.index, 'label index')
    if (seen.has(label.index)) fail('duplicate label')
    seen.add(label.index)
    options(label.options)
    if (label.text) data(label.text)
  }
}
function workbookLiterals(value) {
  object(
    value,
    ['source', 'parts', 'relationships', 'date1904', 'styles', 'sheets'],
    'workbook literals'
  )
  array(value.parts, 'workbook parts')
  const parts = new Map()
  for (const p of value.parts) {
    object(p, ['partUri', 'preconditionHash'], 'workbook part')
    string(p.partUri, 'workbook partUri')
    if (!p.partUri || parts.has(p.partUri) || !/^[a-f0-9]{64}$/.test(p.preconditionHash))
      fail('workbook part identity')
    parts.set(p.partUri, p.preconditionHash)
  }
  function origin(s) {
    object(s, ['partUri', 'preconditionHash', 'path'], 'workbook origin')
    if (!parts.has(s.partUri) || parts.get(s.partUri) !== s.preconditionHash)
      fail('workbook snapshot binding')
    array(s.path, 'workbook path')
    if (!s.path.length || s.path[0] !== 0) fail('workbook path')
    s.path.forEach((n) => integer(n, 'workbook path'))
  }
  function attrs(a) {
    object(a, Object.keys(a || {}), 'workbook attributes')
    Object.values(a).forEach((v) => string(v, 'workbook attribute'))
  }
  origin(value.source)
  if ('date1904' in value && typeof value.date1904 !== 'boolean') fail('workbook date1904')
  array(value.relationships, 'workbook relationships')
  const relIds = new Set()
  for (const r of value.relationships) {
    object(r, ['id', 'type', 'target', 'external', 'source'], 'workbook relationship')
    for (const k of ['id', 'type', 'target']) {
      string(r[k], k)
      if (!r[k]) fail(k)
    }
    if (typeof r.external !== 'boolean') fail('workbook external')
    origin(r.source)
    const id = `${r.source.partUri}#${r.id}`
    if (relIds.has(id)) fail('duplicate workbook relationship')
    relIds.add(id)
  }
  if (value.styles) {
    object(value.styles, ['source', 'numberFormats', 'cellFormats'], 'workbook styles')
    origin(value.styles.source)
    array(value.styles.numberFormats, 'number formats')
    const ids = new Set()
    for (const f of value.styles.numberFormats) {
      object(f, ['numFmtId', 'formatCode', 'source'], 'number format')
      integer(f.numFmtId, 'numFmtId')
      string(f.formatCode, 'formatCode')
      origin(f.source)
      if (ids.has(f.numFmtId)) fail('duplicate numFmtId')
      ids.add(f.numFmtId)
    }
    array(value.styles.cellFormats, 'cell formats')
    for (const f of value.styles.cellFormats) {
      object(f, ['attributes', 'source'], 'cell format')
      attrs(f.attributes)
      origin(f.source)
    }
  }
  array(value.sheets, 'workbook sheets')
  const names = new Set(),
    ids = new Set(),
    targets = new Set()
  for (const sheet of value.sheets) {
    object(
      sheet,
      ['name', 'sheetId', 'relationshipId', 'source', 'worksheetSource', 'cells'],
      'workbook sheet'
    )
    for (const k of ['name', 'sheetId', 'relationshipId']) {
      string(sheet[k], k)
      if (!sheet[k]) fail(k)
    }
    if (!/^[1-9]\d*$/.test(sheet.sheetId) || names.has(sheet.name) || ids.has(sheet.sheetId))
      fail('sheet identity')
    names.add(sheet.name)
    ids.add(sheet.sheetId)
    origin(sheet.source)
    origin(sheet.worksheetSource)
    if (sheet.source.partUri !== value.source.partUri || targets.has(sheet.worksheetSource.partUri))
      fail('sheet source')
    targets.add(sheet.worksheetSource.partUri)
    const binding = value.relationships.filter(
      (r) =>
        r.id === sheet.relationshipId &&
        r.source.partUri ===
          `${value.source.partUri.slice(0, value.source.partUri.lastIndexOf('/'))}/_rels/${value.source.partUri.split('/').at(-1)}.rels`
    )
    if (
      binding.length !== 1 ||
      binding[0].external ||
      binding[0].target !== sheet.worksheetSource.partUri ||
      !/\/worksheet$/.test(binding[0].type)
    )
      fail('sheet relationship binding')
    array(sheet.cells, 'workbook cells')
    const cells = new Set()
    for (const c of sheet.cells) {
      object(
        c,
        ['reference', 'source', 'literal', 'styleIndex', 'formula', 'cached', 'sharedStringSource'],
        'workbook cell'
      )
      const match = /^([A-Z]{1,3})([1-9]\d*)$/.exec(c.reference)
      if (
        !match ||
        Number(match[2]) > 1048576 ||
        match[1].split('').reduce((v, char) => v * 26 + char.charCodeAt(0) - 64, 0) > 16384 ||
        cells.has(c.reference)
      )
        fail('cell reference')
      cells.add(c.reference)
      origin(c.source)
      if (c.source.partUri !== sheet.worksheetSource.partUri) fail('cell source')
      if ('styleIndex' in c) {
        integer(c.styleIndex, 'style index')
        if (!value.styles || !value.styles.cellFormats[c.styleIndex]) fail('cell style')
      }
      if (c.formula) {
        object(c.formula, ['text', 'attributes'], 'formula')
        string(c.formula.text, 'formula text')
        attrs(c.formula.attributes)
        if (typeof c.cached !== 'boolean' || (!c.cached && c.literal.kind !== 'blank'))
          fail('formula cache')
      } else if ('cached' in c) fail('nonformula cached')
      const l = c.literal
      object(l, ['kind', 'value', 'lexicalValue', 'storage', 'sharedStringIndex'], 'cell literal')
      const allowed =
        l.kind === 'blank'
          ? ['kind']
          : ['number', 'boolean'].includes(l.kind)
            ? ['kind', 'value', 'lexicalValue']
            : l.kind === 'string'
              ? [
                  'kind',
                  'value',
                  'storage',
                  ...(l.storage === 'shared' ? ['sharedStringIndex'] : []),
                ]
              : ['kind', 'value']
      if (
        Object.keys(l).length !== allowed.length ||
        Object.keys(l).some((k) => !allowed.includes(k))
      )
        fail('literal fields')
      if (l.kind === 'number') {
        if (
          !Number.isFinite(l.value) ||
          !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(l.lexicalValue) ||
          Number(l.lexicalValue) !== l.value
        )
          fail('workbook numeric literal')
      } else if (l.kind === 'boolean') {
        if (
          !['0', '1', 'true', 'false'].includes(l.lexicalValue) ||
          l.value !== ['1', 'true'].includes(l.lexicalValue)
        )
          fail('workbook boolean')
      } else if (l.kind !== 'blank') {
        if (!['string', 'error', 'date'].includes(l.kind)) fail('literal kind')
        string(l.value, 'literal value')
        if (l.kind === 'date') {
          const y = Number(l.value.slice(0, 4)),
            m = Number(l.value.slice(5, 7)),
            d = Number(l.value.slice(8, 10))
          const days = [
            31,
            y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28,
            31,
            30,
            31,
            30,
            31,
            31,
            30,
            31,
            30,
            31,
          ]
          if (
            !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(
              l.value
            ) ||
            !Number.isFinite(Date.parse(l.value)) ||
            d < 1 ||
            d > (days[m - 1] || 0)
          )
            fail('date literal')
        }
        if (l.kind === 'string' && !['inline', 'shared', 'formula'].includes(l.storage))
          fail('string storage')
      }
      if (l.storage === 'shared') {
        integer(l.sharedStringIndex, 'shared string index')
        origin(c.sharedStringSource)
      } else if ('sharedStringSource' in c) fail('shared string source')
    }
  }
}
function normalizeChartDocument(input) {
  // Bound before cloning; reject cycles, custom objects, undefined and non-finite numbers.
  const visited = new Set()
  let nodes = 0
  function bounded(v, depth) {
    if (++nodes > 1000000 || depth > 32) fail('budget')
    if (v === null || typeof v === 'boolean') return
    if (typeof v === 'string') return string(v, 'string budget')
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) fail('number')
      return
    }
    if (
      !v ||
      typeof v !== 'object' ||
      visited.has(v) ||
      (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype)
    )
      fail('JSON value')
    visited.add(v)
    Object.values(v).forEach((x) => bounded(x, depth + 1))
    visited.delete(v)
  }
  bounded(input, 0)
  object(
    input,
    ['schemaVersion', 'source', 'style', 'plots', 'axes', 'options', 'title', 'legend', 'workbook',
      'paint', 'plotPaint', 'textStyle', 'legendTextStyle', 'visualSources', 'view3D'],
    'document'
  )
  if (input.schemaVersion !== 1) fail('schemaVersion')
  object(
    input.source,
    ['partUri', 'preconditionHash', 'ownerDefinitionId', 'relationshipId'],
    'chart source'
  )
  for (const key of ['partUri', 'ownerDefinitionId', 'relationshipId']) {
    string(input.source[key], key)
    if (!input.source[key]) fail(key)
  }
  if (!/^[a-f0-9]{64}$/.test(input.source.preconditionHash)) fail('hash')
  if ('style' in input) {
    integer(input.style, 'style', 48)
    if (!input.style) fail('style')
  }
  options(input.options)
  if ('view3D' in input) validateView3D(input.view3D)
  if (input.visualSources) {
    array(input.visualSources, 'visual sources')
    input.visualSources.forEach(source)
  }
  for (const name of ['paint', 'plotPaint']) if (input[name]) validateChartVisual(input[name], 'paint')
  for (const name of ['textStyle', 'legendTextStyle']) if (input[name]) validateChartVisual(input[name], 'textStyle')
  if (input.title) data(input.title)
  if (input.legend) options(input.legend)
  array(input.axes, 'axes')
  const axes = new Set()
  for (const axis of input.axes) {
    object(
      axis,
      ['id', 'kind', 'crossAxisId', 'options', 'title', 'scaling', 'numberFormat',
        'paint', 'textStyle', 'majorGridlines', 'minorGridlines'],
      'axis'
    )
    integer(axis.id, 'axis id')
    if (axes.has(axis.id) || !['catAx', 'valAx', 'dateAx', 'serAx'].includes(axis.kind))
      fail('axis identity')
    axes.add(axis.id)
    integer(axis.crossAxisId, 'crossAxisId')
    options(axis.options)
    if (axis.scaling) options(axis.scaling)
    // Reloaded documents obey the same bounds as axis edits; unrelated commands
    // must not admit an invalid persisted scale.
    if (axis.scaling?.min !== undefined && axis.scaling?.max !== undefined &&
        axis.scaling.min >= axis.scaling.max) fail('axis range')
    if (axis.scaling?.logBase && axis.scaling?.min <= 0) fail('logarithmic axis minimum')
    if (axis.numberFormat) options(axis.numberFormat)
    if (axis.title) data(axis.title)
    for (const name of ['paint', 'majorGridlines', 'minorGridlines'])
      if (axis[name]) validateChartVisual(axis[name], 'paint')
    if (axis.textStyle) validateChartVisual(axis.textStyle, 'textStyle')
  }
  for (const axis of input.axes) if (!axes.has(axis.crossAxisId)) fail('unresolved cross axis')
  array(input.plots, 'plots')
  if (!input.plots.length) fail('empty plots')
  const seriesIds = new Set(),
    indices = new Set(),
    orders = new Set()
  for (const plot of input.plots) {
    object(plot, ['family', 'options', 'axisIds', 'series', 'dataLabels', 'hiLowLines', 'dropLines', 'upDownBars', 'bandFormats'], 'plot')
    validatePlotGeometry(plot)
    if (!CHART_FAMILIES.includes(plot.family)) fail('family')
    options(plot.options)
    array(plot.axisIds, 'axisIds')
    if (
      new Set(plot.axisIds).size !== plot.axisIds.length ||
      plot.axisIds.some((n) => !axes.has(n))
    )
      fail('plot axisIds')
    array(plot.series, 'series')
    if (!plot.series.length) fail('empty series')
    if (plot.dataLabels) labels(plot.dataLabels)
    for (const series of plot.series) {
      object(
        series,
        ['id', 'source', 'index', 'order', 'options', 'data', 'dataLabels', 'marker',
          'paint', 'markerPaint', 'pointStyles'],
        'series'
      )
      source(series.source)
      if (series.id !== series.source.definitionId || seriesIds.has(series.id))
        fail('series identity')
      seriesIds.add(series.id)
      integer(series.index, 'series index')
      integer(series.order, 'series order')
      if (indices.has(series.index) || orders.has(series.order))
        fail('duplicate series index/order')
      indices.add(series.index)
      orders.add(series.order)
      options(series.options)
      object(series.data, ['tx', 'cat', 'val', 'xVal', 'yVal', 'bubbleSize'], 'series data')
      Object.values(series.data).forEach(data)
      const xy = ['scatterChart', 'bubbleChart'].includes(plot.family)
      if (xy ? !series.data.xVal || !series.data.yVal : !series.data.val)
        fail('required data channels')
      if (plot.family === 'bubbleChart' && !series.data.bubbleSize) fail('bubbleSize')
      for (const name of ['val', 'xVal', 'yVal', 'bubbleSize']) {
        if (series.data[name] && !series.data[name].kind.startsWith('num'))
          fail('numeric data channel')
      }
      if (series.dataLabels) labels(series.dataLabels)
      if (series.marker) options(series.marker)
      for (const name of ['paint', 'markerPaint']) if (series[name]) validateChartVisual(series[name], 'paint')
      if (series.pointStyles) {
        array(series.pointStyles, 'point styles')
        const seen = new Set()
        for (const point of series.pointStyles) {
          object(point, ['index', 'paint', 'options'], 'point style')
          integer(point.index, 'point style index')
          if (seen.has(point.index)) fail('duplicate point style')
          seen.add(point.index)
          options(point.options)
          if (point.paint) validateChartVisual(point.paint, 'paint')
        }
      }
    }
  }
  if (input.workbook) {
    object(
      input.workbook,
      [
        'source',
        'relationshipId',
        'target',
        'external',
        'autoUpdate',
        'preconditionHash',
        'fetchPolicy',
        'relationshipSource',
        'literalData',
      ],
      'workbook'
    )
    source(input.workbook.source)
    for (const k of ['relationshipId', 'target']) {
      string(input.workbook[k], k)
      if (!input.workbook[k]) fail(k)
    }
    if (
      typeof input.workbook.external !== 'boolean' ||
      ('autoUpdate' in input.workbook && typeof input.workbook.autoUpdate !== 'boolean')
    )
      fail('workbook flags')
    if (!input.workbook.external && !/^[a-f0-9]{64}$/.test(input.workbook.preconditionHash))
      fail('workbook hash')
    if ('fetchPolicy' in input.workbook && input.workbook.fetchPolicy !== 'deny')
      fail('workbook fetch policy')
    if (input.workbook.relationshipSource) {
      const s = input.workbook.relationshipSource
      object(s, ['partUri', 'preconditionHash', 'path'], 'workbook relationship source')
      string(s.partUri, 'relationship part')
      if (!/^[a-f0-9]{64}$/.test(s.preconditionHash)) fail('relationship hash')
      array(s.path, 'relationship path')
      s.path.forEach((n) => integer(n, 'relationship path'))
    }
    if ('literalData' in input.workbook) {
      if (input.workbook.external || input.workbook.fetchPolicy !== 'deny')
        fail('external workbook literals')
      workbookLiterals(input.workbook.literalData)
    }
  }
  // Every source component belongs to this exact chart snapshot, including cache
  // points and the externalData node (not the workbook target's own hash).
  const componentIds = new Set()
  function bind(value) {
    if (!value || typeof value !== 'object') return
    if (value.kind === 'multiLvlStrRef') for (const level of value.cache?.levels ?? [])
      if (level.source.partUri !== input.source.partUri || level.source.preconditionHash !== input.source.preconditionHash)
        fail('category level snapshot binding')
    if (!Array.isArray(value) && Object.hasOwn(value, 'definitionId')) {
      if (
        value.partUri !== input.source.partUri ||
        value.preconditionHash !== input.source.preconditionHash ||
        componentIds.has(value.definitionId)
      )
        fail('component snapshot binding')
      componentIds.add(value.definitionId)
    }
    Object.values(value).forEach(bind)
  }
  bind(input)
  return JSON.parse(JSON.stringify(input))
}
module.exports = { CHART_FAMILIES, CHART_OPTION_TYPES, validateChartOption, normalizeChartDocument }
