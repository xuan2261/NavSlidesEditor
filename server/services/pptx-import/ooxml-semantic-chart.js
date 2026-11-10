const { createHash } = require('node:crypto')
const { parseXml, attr, decodeXml, textContent } = require('./ooxml-text-run-xml')
const { relationshipPart } = require('./slide-order')
const { resolveTarget } = require('./package-store/raw-zip')
const { PptxImportError } = require('./diagnostics')
const { readWorkbookLiterals } = require('./chart-workbook-literals')
const { chartVisualReader } = require('../../../shared/src/pptx-chart-source-visual')
const { nativeChartReader } = require('./chart-native-reader')
const {
  CHART_FAMILIES,
  CHART_OPTION_TYPES,
  validateChartOption,
  normalizeChartDocument,
} = require('../../../shared/src/pptx-chart-document')
const C = new Set([
  'http://schemas.openxmlformats.org/drawingml/2006/chart',
  'http://purl.oclc.org/ooxml/drawingml/chart',
])
const R = new Set([
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  'http://purl.oclc.org/ooxml/officeDocument/relationships',
])
const OPC = 'http://schemas.openxmlformats.org/package/2006/relationships'
const value = (node, name = 'val') => decodeXml(attr(node, name) || '')

// Reads only exact inventoried parts and components. No network/workbook refresh,
// Chart.js conversion, source mutation or capability claims occur here.
async function readSemanticChart({ zip, inventory, source }) {
  let location = { partUri: source?.partUri, definitionId: source?.id }
  function fail(detail, node) {
    const error = new PptxImportError(`Source chart ${detail}: ${location.partUri}`, {
      status: 422,
    })
    error.code = 'PPTX_SEMANTIC_CHART_FAILED'
    error.sourceLocation = { ...location, ...(node ? { offset: node.start } : {}) }
    throw error
  }
  async function load(partUri) {
    const records = inventory.parts.filter((p) => p.partUri === partUri)
    const entry = zip.file(partUri)
    if (records.length !== 1 || !entry) fail(`missing or ambiguous inventoried part ${partUri}`)
    const bytes = await entry.async('nodebuffer')
    if (
      bytes.length > 8388608 ||
      createHash('sha256').update(bytes).digest('hex') !== records[0].preconditionHash
    )
      fail(`source hash/budget mismatch ${partUri}`)
    const xml = bytes.toString('utf8')
    let roots
    try {
      roots = parseXml(xml)
    } catch {
      fail('malformed XML')
    }
    if (roots.length !== 1) fail('ambiguous XML root')
    const paths = new Map()
    let count = 0
    function visit(node, path) {
      if (++count > 200000 || path.length > 64) fail('XML budget exceeded', node)
      if (new Set(node.attrs.map((a) => a.name)).size !== node.attrs.length)
        fail('duplicate XML attribute', node)
      if (C.has(node.uri) && !['v', 'f', 'formatCode', 'separator'].includes(node.local)) {
        let cursor = node.end + 1
        for (const nested of node.children) {
          if (xml.slice(cursor, nested.start).trim()) fail('unexpected element text', node)
          cursor = nested.closeEnd + 1
        }
        if (!node.selfClosing && xml.slice(cursor, node.closeStart).trim())
          fail('unexpected element text', node)
      }
      paths.set(node, path)
      node.children.forEach((child, i) => visit(child, [...path, i]))
    }
    visit(roots[0], [0])
    return { xml, root: roots[0], paths, hash: records[0].preconditionHash, partUri }
  }
  function children(node, names) {
    if (node.children.some((n) => !C.has(n.uri) || !names.includes(n.local)))
      fail('unsupported child semantics', node)
    const namesSeen = new Set()
    for (const n of node.children) {
      if (!['ser', 'pt', 'dLbl', 'dPt', 'lvl'].includes(n.local) && namesSeen.has(n.local))
        fail(`ambiguous ${n.local}`, n)
      namesSeen.add(n.local)
    }
  }
  function one(node, name, required = false) {
    const result = node.children.filter((n) => C.has(n.uri) && n.local === name)
    if (result.length > 1 || (required && result.length !== 1))
      fail(`missing/ambiguous ${name}`, node)
    return result[0]
  }
  function attributes(node, allowed = []) {
    if (node.attrs.some((a) => !a.name.startsWith('xmlns') && !allowed.includes(a.name)))
      fail('unsupported attributes', node)
  }
  function integer(raw, node) {
    if (
      !/^(?:0|[1-9]\d*)$/.test(raw) ||
      !Number.isSafeInteger(Number(raw)) ||
      Number(raw) > 2147483647
    )
      fail('invalid integer index/count', node)
    return Number(raw)
  }
  function scalar(node) {
    attributes(node, ['val'])
    if (node.children.length || !node.attrs.some((a) => a.name === 'val'))
      fail('invalid scalar', node)
    return value(node)
  }
  function options(node, allowed) {
    attributes(node)
    children(node, allowed)
    return Object.fromEntries(node.children.map((n) => [n.local, option(n)]))
  }
  function option(node) {
    const type = CHART_OPTION_TYPES[node.local]
    let v
    if (type === 'string') {
      attributes(node)
      v = textContent(chart.xml, node)
    } else {
      const raw = scalar(node)
      if (type === 'boolean') {
        if (!['true', 'false', '0', '1'].includes(raw)) fail('invalid boolean', node)
        v = ['true', '1'].includes(raw)
      } else if (
        type === 'number' ||
        type === 'positive' ||
        (Array.isArray(type) && typeof type[0] === 'number')
      ) {
        if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw))
          fail('invalid number', node)
        v = Number(raw)
      } else v = raw
    }
    try {
      return validateChartOption(node.local, v)
    } catch {
      fail(`invalid option ${node.local}`, node)
    }
  }
  async function relation(state, id, type) {
    const rels = await load(relationshipPart(state.partUri))
    if (rels.root.uri !== OPC || rels.root.local !== 'Relationships')
      fail('invalid relationships root')
    const ids = new Set()
    let match
    for (const node of rels.root.children) {
      if (node.uri !== OPC || node.local !== 'Relationship')
        fail('invalid relationship namespace', node)
      attributes(node, ['Id', 'Type', 'Target', 'TargetMode'])
      const rid = value(node, 'Id')
      if (
        !rid ||
        ids.has(rid) ||
        !value(node, 'Target') ||
        !value(node, 'Type') ||
        node.children.length
      )
        fail('ambiguous relationship', node)
      ids.add(rid)
      if (rid === id) match = node
    }
    if (!match || ![...R].some((r) => value(match, 'Type') === `${r}/${type}`))
      fail(`missing or wrong relationship ${id}`)
    const mode = value(match, 'TargetMode')
    if (mode && !['Internal', 'External'].includes(mode)) fail('invalid relationship mode')
    const external = mode === 'External'
    let target = value(match, 'Target')
    if (!external) {
      try {
        target = resolveTarget(state.partUri, target)
      } catch {
        fail('unsafe relationship target')
      }
    }
    return {
      relationshipId: id,
      external,
      target,
      relationshipSource: {
        partUri: rels.partUri,
        preconditionHash: rels.hash,
        path: rels.paths.get(match),
      },
    }
  }
  function relationshipId(node) {
    const refs = node.attrs.filter((a) => {
      const [prefix, local] = a.name.split(':')
      return local === 'id' && R.has(node.namespaces[prefix])
    })
    if (refs.length !== 1 || !decodeXml(refs[0].value))
      fail('missing/ambiguous relationship id', node)
    attributes(node, [refs[0].name])
    return decodeXml(refs[0].value)
  }
  const componentDefinitionIds = []
  function component(node, kind) {
    const path = chart.paths.get(node)
    const matches = inventory.definitions.filter(
      (d) =>
        d.partUri === chart.partUri &&
        d.kind === kind &&
        d.preconditionHash === chart.hash &&
        d.componentLocators?.some(
          (l) =>
            l.preconditionHash === chart.hash && JSON.stringify(l.path) === JSON.stringify(path)
        )
    )
    if (matches.length !== 1) fail('missing/ambiguous inventoried component identity', node)
    const d = matches[0]
    if (componentDefinitionIds.includes(d.id)) fail('duplicate component identity', node)
    componentDefinitionIds.push(d.id)
    return { definitionId: d.id, partUri: d.partUri, preconditionHash: chart.hash, path }
  }
  function data(node) {
    attributes(node)
    children(node, ['strRef', 'numRef', 'strLit', 'numLit', 'v', 'rich', 'multiLvlStrRef'])
    if (node.children.length !== 1) fail('ambiguous data choice', node)
    const choice = node.children[0]
    if (choice.local === 'rich') return visual.text(choice, true)
    attributes(choice)
    if (choice.local === 'v') return { kind: 'text', value: textContent(chart.xml, choice) }
    const reference = choice.local.endsWith('Ref')
    const numeric = choice.local.startsWith('num')
    let cacheNode = choice
    const result = { kind: choice.local }
    if (reference) {
      const cacheName = choice.local === 'multiLvlStrRef' ? 'multiLvlStrCache' : numeric ? 'numCache' : 'strCache'
      children(choice, ['f', cacheName])
      const formula = one(choice, 'f', true)
      attributes(formula)
      result.formula = textContent(chart.xml, formula)
      if (!result.formula.trim()) fail('empty formula reference', formula)
      cacheNode = one(choice, cacheName)
    }
    if (cacheNode) {
      attributes(cacheNode)
      const multi = choice.local === 'multiLvlStrRef'
      children(cacheNode, multi ? ['ptCount', 'lvl'] : numeric ? ['formatCode', 'ptCount', 'pt'] : ['ptCount', 'pt'])
      const count = integer(scalar(one(cacheNode, 'ptCount', true)), cacheNode)
      if (count > 100000) fail('cache budget exceeded', cacheNode)
      function readPoints(pointParent) {
        return pointParent.children
        .filter((p) => p.local === 'pt')
        .map((p) => {
          attributes(p, ['idx'])
          children(p, ['v'])
          const v = one(p, 'v', true)
          attributes(v)
          const raw = textContent(chart.xml, v)
          const point = {
            index: integer(value(p, 'idx'), p),
            value: raw,
            source: component(p, 'chart-data-point'),
          }
          if (numeric) {
            if (
              !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw) ||
              !Number.isFinite(Number(raw))
            )
              fail('invalid numeric cache', p)
            point.value = Number(raw)
            point.lexicalValue = raw
          }
          return point
        })
      }
      if (multi) {
        const levels = cacheNode.children.filter(node => node.local === 'lvl')
        if (!levels.length) fail('missing category cache levels', cacheNode)
        result.cache = { count, levels: levels.map(level => {
          attributes(level); children(level, ['pt'])
          return { source: { partUri: chart.partUri, preconditionHash: chart.hash, path: chart.paths.get(level) },
            points: readPoints(level) }
        }) }
      } else result.cache = { count, points: readPoints(cacheNode) }
      const format = one(cacheNode, 'formatCode')
      if (format) {
        attributes(format)
        result.cache.formatCode = textContent(chart.xml, format)
      }
    }
    return result
  }
  const labelOptions = [
    'dLblPos',
    'delete',
    'showLegendKey',
    'showVal',
    'showCatName',
    'showSerName',
    'showPercent',
    'showBubbleSize',
    'showLeaderLines',
    'separator',
  ]
  function labels(node) {
    attributes(node)
    children(node, [...labelOptions, 'dLbl', 'txPr', 'numFmt'])
    return {
      ...labelStyle(node),
      options: Object.fromEntries(
        node.children.filter((n) => labelOptions.includes(n.local)).map((n) => [n.local, option(n)])
      ),
      labels: node.children
        .filter((n) => n.local === 'dLbl')
        .map((n) => {
          attributes(n)
          children(n, [...labelOptions, 'idx', 'tx', 'txPr', 'numFmt', 'spPr'])
          if (one(n, 'spPr')) {
            const p = visual.paint(one(n, 'spPr'))
            if (Object.keys(p).length) fail('unsupported label shape paint', n)
          }
          const result = {
            ...labelStyle(n),
            index: integer(scalar(one(n, 'idx', true)), n),
            options: Object.fromEntries(
              n.children
                .filter((c) => labelOptions.includes(c.local))
                .map((c) => [c.local, option(c)])
            ),
          }
          if (one(n, 'tx')) result.text = data(one(n, 'tx'))
          return result
        }),
    }
  }
  function title(node) {
    attributes(node)
    children(node, ['tx', 'layout', 'overlay'])
    if (one(node, 'layout')) emptyLayout(one(node, 'layout'))
    if (one(node, 'overlay') && option(one(node, 'overlay'))) fail('unsupported overlaid title', node)
    return data(one(node, 'tx', true))
  }
  function emptyLayout(node) {
    attributes(node)
    if (node.children.length) fail('unsupported authored layout', node)
  }
  function numberFormat(n) {
    attributes(n, ['formatCode', 'sourceLinked'])
    if (n.children.length || !['0', '1', 'true', 'false'].includes(value(n, 'sourceLinked')))
      fail('invalid number format', n)
    return { formatCode: value(n, 'formatCode'), sourceLinked: ['1', 'true'].includes(value(n, 'sourceLinked')) }
  }
  function labelStyle(n) {
    return {
      ...(one(n, 'txPr') ? { textStyle: visual.text(one(n, 'txPr')) } : {}),
      ...(one(n, 'numFmt') ? { numberFormat: numberFormat(one(n, 'numFmt')) } : {}),
    }
  }
  let chart, visual
  try {
    const owners = inventory.definitions.filter((d) => d.id === source?.id)
    if (owners.length !== 1 || owners[0].kind !== 'graphic-frame') fail('invalid source owner')
    source = owners[0]
    const owner = await load(source.partUri)
    const locators = source.componentLocators
    if (locators?.length !== 1 || locators[0].preconditionHash !== owner.hash)
      fail('invalid source owner locator')
    let frame = owner.root
    const path = locators[0].path
    if (path[0] !== 0) fail('invalid owner path')
    for (const i of path.slice(1)) frame = frame?.children[i]
    if (!frame || frame.local !== 'graphicFrame') fail('missing owner frame')
    const chartRefs = []
    function find(node) {
      if (C.has(node.uri) && node.local === 'chart') chartRefs.push(node)
      node.children.forEach(find)
    }
    find(frame)
    if (chartRefs.length !== 1 || chartRefs[0].children.length)
      fail('ambiguous owner chart reference')
    const id = relationshipId(chartRefs[0])
    const binding = await relation(owner, id, 'chart')
    if (binding.external) fail('external chart relationship denied')
    location = { partUri: binding.target, definitionId: source.id }
    chart = await load(binding.target)
    const visualSources = []
    visual = chartVisualReader({ attr, decodeXml, textContent, xml: chart.xml, fail,
      component: (node, kind) => visualSources.push(component(node, kind)) })
    const native = nativeChartReader({ one, children, attributes, scalar, integer, option, visual: () => visual, fail })
    const root = chart.root
    if (!C.has(root.uri) || root.local !== 'chartSpace') fail('invalid chart namespace/root')
    attributes(root)
    children(root, ['chart', 'style', 'externalData', 'date1904', 'roundedCorners', 'spPr', 'txPr'])
    const chartNode = one(root, 'chart', true)
    attributes(chartNode)
    children(chartNode, [
      'plotArea',
      'title',
      'legend',
      'autoTitleDeleted',
      'plotVisOnly',
      'dispBlanksAs',
      'showDLblsOverMax',
      'view3D',
    ])
    const plotArea = one(chartNode, 'plotArea', true)
    attributes(plotArea)
    // Multiple plot families and repeated same-family plots are meaningful.
    for (const n of plotArea.children)
      if (
        !C.has(n.uri) ||
        ![...CHART_FAMILIES, 'layout', 'catAx', 'valAx', 'dateAx', 'serAx', 'spPr'].includes(n.local)
      )
        fail('unsupported plot semantics', n)
    for (const layout of plotArea.children.filter((n) => n.local === 'layout')) {
      attributes(layout)
      if (layout.children.length) fail('unsupported authored layout', layout)
    }
    const document = {
      schemaVersion: 1,
      source: {
        partUri: chart.partUri,
        preconditionHash: chart.hash,
        ownerDefinitionId: source.id,
        relationshipId: id,
      },
      plots: [],
      axes: [],
      options: {},
    }
    if (one(chartNode, 'view3D')) document.view3D = native.projection(one(chartNode, 'view3D'))
    const style = one(root, 'style')
    if (one(root, 'spPr')) document.paint = visual.paint(one(root, 'spPr'))
    if (one(root, 'txPr')) document.textStyle = visual.text(one(root, 'txPr'))
    if (one(plotArea, 'spPr')) document.plotPaint = visual.paint(one(plotArea, 'spPr'))
    if (style) document.style = integer(scalar(style), style)
    for (const node of [...root.children, ...chartNode.children])
      if (CHART_OPTION_TYPES[node.local]) document.options[node.local] = option(node)
    if (one(chartNode, 'title')) document.title = title(one(chartNode, 'title'))
    if (one(chartNode, 'legend')) {
      const legend = one(chartNode, 'legend')
      attributes(legend)
      children(legend, ['legendPos', 'overlay', 'txPr', 'layout'])
      if (one(legend, 'layout')) emptyLayout(one(legend, 'layout'))
      document.legend = Object.fromEntries(legend.children.filter(n => ['legendPos', 'overlay'].includes(n.local)).map(n => [n.local, option(n)]))
      if (one(legend, 'txPr')) document.legendTextStyle = visual.text(one(legend, 'txPr'))
    }
    const plotOptions = [
      'barDir',
      'grouping',
      'varyColors',
      'scatterStyle',
      'radarStyle',
      'ofPieType',
      'shape',
      'holeSize',
      'firstSliceAng',
      'gapWidth',
      'gapDepth',
      'overlap',
      'bubbleScale',
      'showNegBubbles',
      'sizeRepresents',
      'wireframe',
      'splitType',
      'splitPos',
      'secondPieSize',
      'smooth',
      'marker',
    ]
    for (const node of plotArea.children.filter((n) => CHART_FAMILIES.includes(n.local))) {
      attributes(node)
      // axId repeats; unlike all singleton options it is a list.
      for (const n of node.children)
        if (!C.has(n.uri) || ![...plotOptions, 'ser', 'axId', 'dLbls', 'hiLowLines', 'dropLines', 'upDownBars', 'bandFmts'].includes(n.local))
          fail('unsupported plot property', n)
      for (const name of [...plotOptions, 'dLbls', 'hiLowLines', 'dropLines', 'upDownBars', 'bandFmts']) one(node, name)
      const plot = { family: node.local, options: {}, axisIds: [], series: [] }
      native.decorations(node, plot)
      for (const n of node.children) {
        if (plotOptions.includes(n.local)) plot.options[n.local] = option(n)
        else if (n.local === 'axId') plot.axisIds.push(integer(scalar(n), n))
        else if (n.local === 'dLbls') plot.dataLabels = labels(n)
        else if (['hiLowLines', 'dropLines', 'upDownBars', 'bandFmts'].includes(n.local)) continue
        else {
          attributes(n)
          const seriesOptions = ['smooth', 'explosion', 'bubble3D', 'shape', 'invertIfNegative']
          children(n, [
            'idx',
            'order',
            'tx',
            'cat',
            'val',
            'xVal',
            'yVal',
            'bubbleSize',
            'marker',
            'dLbls',
            'spPr', 'dPt',
            ...seriesOptions,
          ])
          const src = component(n, 'chart-series')
          const s = {
            id: src.definitionId,
            source: src,
            index: integer(scalar(one(n, 'idx', true)), n),
            order: integer(scalar(one(n, 'order', true)), n),
            options: {},
            data: {},
          }
          for (const c of n.children) {
            if (['tx', 'cat', 'val', 'xVal', 'yVal', 'bubbleSize'].includes(c.local))
              s.data[c.local] = data(c)
            else if (seriesOptions.includes(c.local)) s.options[c.local] = option(c)
            else if (c.local === 'spPr') s.paint = visual.paint(c)
            else if (c.local === 'dPt') {
              attributes(c)
              children(c, ['idx', 'spPr', 'explosion', 'bubble3D', 'invertIfNegative'])
              const p = { index: integer(scalar(one(c, 'idx', true)), c), options: {} }
              for (const n of c.children) {
                if (n.local === 'spPr') p.paint = visual.paint(n)
                else if (n.local !== 'idx') p.options[n.local] = option(n)
              }
              ;(s.pointStyles ??= []).push(p)
            }
            else if (c.local === 'marker') {
              attributes(c); children(c, ['symbol', 'size', 'spPr'])
              s.marker = Object.fromEntries(c.children.filter(n => n.local !== 'spPr').map(n => [n.local, option(n)]))
              if (one(c, 'spPr')) s.markerPaint = visual.paint(one(c, 'spPr'))
            }
            else if (c.local === 'dLbls') s.dataLabels = labels(c)
          }
          plot.series.push(s)
        }
      }
      document.plots.push(plot)
    }
    const axisOptions = [
      'axPos',
      'delete',
      'crosses',
      'crossesAt',
      'crossBetween',
      'auto',
      'lblAlgn',
      'lblOffset',
      'tickLblPos',
      'majorTickMark',
      'minorTickMark',
      'tickLblSkip',
      'tickMarkSkip',
      'noMultiLvlLbl',
      'majorUnit',
      'minorUnit',
    ]
    for (const node of plotArea.children.filter((n) =>
      ['catAx', 'valAx', 'dateAx', 'serAx'].includes(n.local)
    )) {
      attributes(node)
      children(node, [...axisOptions, 'axId', 'crossAx', 'scaling', 'title', 'numFmt',
        'spPr', 'txPr', 'majorGridlines', 'minorGridlines'])
      const axis = {
        kind: node.local,
        id: integer(scalar(one(node, 'axId', true)), node),
        crossAxisId: integer(scalar(one(node, 'crossAx', true)), node),
        options: {},
      }
      for (const n of node.children) {
        if (axisOptions.includes(n.local)) axis.options[n.local] = option(n)
        else if (n.local === 'scaling')
          axis.scaling = options(n, ['orientation', 'min', 'max', 'logBase'])
        else if (n.local === 'title') axis.title = title(n)
        else if (n.local === 'numFmt') axis.numberFormat = numberFormat(n)
        else if (n.local === 'spPr') axis.paint = visual.paint(n)
        else if (n.local === 'txPr') axis.textStyle = visual.text(n)
        else if (['majorGridlines', 'minorGridlines'].includes(n.local)) {
          attributes(n); children(n, ['spPr'])
          axis[n.local] = one(n, 'spPr') ? visual.paint(one(n, 'spPr')) : {}
        }
      }
      document.axes.push(axis)
    }
    const externalData = one(root, 'externalData')
    if (externalData) {
      const relationshipIdValue = relationshipId(externalData)
      children(externalData, ['autoUpdate'])
      const binding = await relation(chart, relationshipIdValue, 'package')
      document.workbook = {
        source: component(externalData, 'chart-workbook-reference'),
        ...binding,
        fetchPolicy: 'deny',
      }
      if (!binding.external) {
        const entry = zip.file(binding.target)
        const records = inventory.parts.filter((p) => p.partUri === binding.target)
        if (!entry || records.length !== 1) fail('missing workbook')
        const bytes = await entry.async('nodebuffer')
        const hash = createHash('sha256').update(bytes).digest('hex')
        if (hash !== records[0].preconditionHash) fail('workbook hash mismatch')
        document.workbook.preconditionHash = hash
        document.workbook.literalData = await readWorkbookLiterals(bytes)
      }
      const update = one(externalData, 'autoUpdate')
      if (update) document.workbook.autoUpdate = option({ ...update, local: 'auto' })
    }
    const expected = inventory.definitions
      .filter((d) => d.partUri === chart.partUri)
      .map((d) => d.id)
    if (
      expected.length !== componentDefinitionIds.length ||
      expected.some((id) => !componentDefinitionIds.includes(id))
    )
      fail('unconsumed source constituent')
    if (visualSources.length) document.visualSources = visualSources
    return { document: normalizeChartDocument(document), componentDefinitionIds }
  } catch (error) {
    if (error.code === 'PPTX_SEMANTIC_CHART_FAILED') throw error
    fail(error.message)
  }
}
module.exports = { readSemanticChart }
