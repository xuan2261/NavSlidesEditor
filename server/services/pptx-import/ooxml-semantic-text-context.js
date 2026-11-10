const { P_URIS, A_URIS, decodeXml } = require('./ooxml-text-run-xml')
const { createContextSourceFactory, contextFailure } = require('./ooxml-semantic-text-context-source')
const {
  matchPlaceholder,
  shapeLayers,
  declarations,
  paragraphDeclaration,
  runDeclaration,
} = require('./ooxml-semantic-text-context-layers')
const { readContextTheme } = require('./ooxml-semantic-text-context-theme')
const { isEquationEntry, standaloneEquationTopology } = require('./ooxml-semantic-text-equation')
const C_URIS = new Set([
  'http://schemas.openxmlformats.org/drawingml/2006/chart',
  'http://purl.oclc.org/ooxml/drawingml/chart',
])

async function readSemanticTextStyleContext({ zip, inventory, occurrenceId }) {
  const factory = createContextSourceFactory(zip, inventory)
  return readContext(factory.inventory, factory.createSource(), occurrenceId)
}
async function readContext(inventory, graph, occurrenceId) {
  const occurrences = inventory.occurrences.filter((o) => o.id === occurrenceId)
  const occurrence = occurrences[0]
  if (occurrences.length !== 1)
    contextFailure('ppt/presentation.xml', null, [], 'missing/ambiguous occurrence')
  const definitions = inventory.definitions.filter((d) => d.id === occurrence.definitionId)
  const definition = definitions[0]
  if (definitions.length !== 1 || !['shape', 'graphic-frame'].includes(definition.kind))
    contextFailure(occurrence.slidePartUri, null, [], 'occurrence must bind one native text owner')
  const presentation = await graph.part('ppt/presentation.xml')
  if (!P_URIS.has(presentation.root.uri) || presentation.root.local !== 'presentation')
    presentation.fail(presentation.root, 'presentation root')
  const slideList = presentation.one(presentation.root, 'sldIdLst', P_URIS)
  const slideRelations = []
  for (const n of slideList?.children || []) {
    if (!P_URIS.has(n.uri) || n.local !== 'sldId') presentation.fail(n, 'slide identity')
    const ids = n.attrs.filter(
      (a) =>
        a.name.includes(':') &&
        a.name.split(':')[1] === 'id' &&
        graph.R.has(n.namespaces[a.name.split(':')[0]])
    )
    if (ids.length !== 1) presentation.fail(n, 'slide relationship identity')
    const id = decodeXml(ids[0].value)
    const rels = await graph.relations(presentation)
    const matches = rels.filter(
      (r) => r.Id === id && [...graph.R].some((uri) => r.Type === `${uri}/slide`)
    )
    if (matches.length !== 1) presentation.fail(n, 'slide relationship binding')
    slideRelations.push({ id, relation: matches[0] })
  }
  const { resolveTarget } = require('./package-store/raw-zip')
  const matches = slideRelations.filter(
    ({ relation: r }) =>
      r.TargetMode !== 'External' &&
      resolveTarget(presentation.partUri, r.Target) === occurrence.slidePartUri
  )
  if (matches.length !== 1 || !inventory.slides.some((s) => s.partUri === occurrence.slidePartUri))
    presentation.fail(presentation.root, 'host slide is not declared')
  const slide = await graph.related(presentation, 'slide', matches[0].id)
  const layout = await graph.related(slide, 'slideLayout')
  const master = await graph.related(layout, 'slideMaster')
  for (const [p, local] of [
    [slide, 'sld'],
    [layout, 'sldLayout'],
    [master, 'sldMaster'],
  ])
    if (!P_URIS.has(p.root.uri) || p.root.local !== local) p.fail(p.root, `wrong ${local} target`)
  const hosts = [slide, layout, master]
  const owner = hosts.find((p) => p.partUri === definition.partUri)
  if (!owner) slide.fail(slide.root, 'occurrence source outside host chain')
  const chain = [slide.partUri, ...graph.relationships.slice(1).map((r) => r.relationshipId)]
  const expectedChain = chain.slice(0, hosts.indexOf(owner) + 1)
  if (
    JSON.stringify(expectedChain) !== JSON.stringify(occurrence.relationshipChain) ||
    occurrence.id !== `${slide.partUri}@${expectedChain.join('>')}#${definition.id}`
  )
    owner.fail(owner.root, 'forged occurrence relationship chain')
  const themePart = await graph.related(master, 'theme')
  if (!A_URIS.has(themePart.root.uri) || themePart.root.local !== 'theme')
    themePart.fail(themePart.root, 'theme root')
  const themeData = readContextTheme(themePart, hosts)
  if (definition.kind === 'graphic-frame') {
    const frame = owner.nodes.get(definition.id)
    if (!P_URIS.has(frame?.uri) || frame.local !== 'graphicFrame')
      owner.fail(frame, 'chart frame owner')
    const graphic = owner.one(frame, 'graphic')
    const data = owner.one(graphic, 'graphicData')
    if (
      !graphic ||
      !data ||
      !C_URIS.has(owner.attrs(data, ['uri']).uri) ||
      data.children.length !== 1 ||
      !C_URIS.has(data.children[0].uri) ||
      data.children[0].local !== 'chart'
    )
      owner.fail(frame, 'native chart frame required')
    owner.attrs(graphic)
    owner.children(graphic, ['graphicData'])
    const reference = data.children[0]
    const ids = reference.attrs.filter(
      (a) =>
        a.name.includes(':') &&
        a.name.split(':')[1] === 'id' &&
        graph.R.has(reference.namespaces[a.name.split(':')[0]])
    )
    if (ids.length !== 1) owner.fail(reference, 'chart relationship identity')
    owner.attrs(reference, [ids[0].name])
    owner.children(reference)
    const chartRelations = (await graph.relations(owner)).filter(
      (r) =>
        r.Id === decodeXml(ids[0].value) && [...graph.R].some((uri) => r.Type === `${uri}/chart`)
    )
    if (chartRelations.length !== 1 || chartRelations[0].TargetMode === 'External')
      owner.fail(reference, 'chart relationship binding')
    let target
    try {
      target = resolveTarget(owner.partUri, chartRelations[0].Target)
    } catch {
      owner.fail(reference, 'unsafe chart target')
    }
    const chart = await graph.part(target)
    if (!C_URIS.has(chart.root.uri) || chart.root.local !== 'chartSpace')
      chart.fail(chart.root, 'chart root')
    if (
      (await graph.relations(chart)).some((r) =>
        [...graph.R].some((uri) =>
          ['theme', 'themeOverride'].some((kind) => r.Type === `${uri}/${kind}`)
        )
      )
    )
      chart.fail(chart.root, 'unsupported chart-local theme authority')
    for (const part of [presentation, ...hosts]) part.receipt(part.root)
    return {
      schemaVersion: 1,
      occurrenceId,
      definitionId: definition.id,
      hostSlidePartUri: slide.partUri,
      bindings: { layoutDefinitionId: null, masterDefinitionId: null },
      relationships: graph.relationships,
      provenance: graph.provenance,
      theme: themeData.theme,
      body: { target: {}, entries: [] },
      paragraphs: [],
      fontRequests: themeData.declarations.filter((d) => d.typeface.length > 0),
    }
  }
  const own = shapeLayers(owner, definition)
  const layoutDefinition = owner === slide ? matchPlaceholder(layout, own.ph) : null
  const inheritedLayout = layoutDefinition ? shapeLayers(layout, layoutDefinition, 'layout') : null
  const masterDefinition =
    owner !== master ? matchPlaceholder(master, inheritedLayout?.ph || own.ph, true) : null
  const inheritedMaster = masterDefinition ? shapeLayers(master, masterDefinition, 'master') : null
  const inherited = [inheritedLayout, inheritedMaster].filter(Boolean)
  const shared = { paragraph: [...own.lists.paragraph], run: [...own.lists.run] }
  const body = {
    target: own.ph ? { placeholder: own.ph } : {},
    entries: [own.body, ...inherited.map((s) => s.body)],
  }
  for (const s of inherited) {
    const kind = s === inheritedLayout ? 'layoutParagraph' : 'masterParagraph'
    const levelEntries = new Map()
    for (let index = 0; index < s.paragraphs.length; index++) {
      const pNode = s.paragraphs[index]
      const pPr = pNode.children.find((c) => c.local === 'pPr')
      const lvlAttr = pPr?.attrs?.find((a) => a.name === 'lvl')?.value
      const explicitLevel =
        lvlAttr !== undefined &&
        /^\d+$/.test(lvlAttr) &&
        Number(lvlAttr) >= 0 &&
        Number(lvlAttr) <= 8
          ? Number(lvlAttr)
          : undefined
      const level = explicitLevel !== undefined ? explicitLevel : 0

      const directP = paragraphDeclaration(s.p, pNode, kind, {
        placeholder: s.ph,
        level,
      })

      if (levelEntries.has(level))
        s.p.fail(pNode, 'ambiguous inherited paragraph level')
      levelEntries.set(level, { directP })
    }
    const sortedLevels = [...levelEntries.keys()].sort((a, b) => a - b)
    for (const lvl of sortedLevels) {
      const { directP } = levelEntries.get(lvl)
      for (const scope of ['paragraph', 'run'])
        shared[scope].push(directP[scope])
    }
    for (const scope of ['paragraph', 'run'])
      shared[scope].push(...s.lists[scope])
  }
  for (const s of [own, ...inherited]) if (s.fontReference) shared.run.push(s.fontReference)
  const styles = own.ph ? master.one(master.root, 'txStyles', P_URIS) : null
  if (styles) {
    master.attrs(styles)
    const seen = new Set()
    const type = (inheritedLayout ? inheritedLayout.ph.type : own.ph.type) ?? 'obj'
    const applicableCategory = ['title', 'ctrTitle', 'subTitle'].includes(type)
      ? 'title'
      : ['body', 'obj'].includes(type)
        ? 'body'
        : 'other'
    for (const n of styles.children) {
      const category = { titleStyle: 'title', bodyStyle: 'body', otherStyle: 'other' }[n.local]
      if (!category || !P_URIS.has(n.uri) || seen.has(category))
        master.fail(n, 'master text style container')
      seen.add(category)
      if (category !== applicableCategory) continue
      const layers = declarations(master, n, 'masterTextStyle', { category })
      for (const scope of ['paragraph', 'run']) shared[scope].push(...layers[scope])
    }
  }
  const defaults = declarations(
    presentation,
    presentation.one(presentation.root, 'defaultTextStyle', P_URIS),
    'presentationDefault'
  )
  for (const scope of ['paragraph', 'run']) shared[scope].push(...defaults[scope])
  const paragraphs = own.paragraphs.map((paragraph) => {
    const direct = paragraphDeclaration(owner, paragraph, 'paragraph')
    const target = {
      ...(own.ph ? { placeholder: own.ph } : {}),
      ...(direct.paragraph.properties.level !== undefined
        ? { level: direct.paragraph.properties.level }
        : {}),
    }
    const layers = (scope) => ({ target, entries: [direct[scope], ...shared[scope]] })
    const standalone = standaloneEquationTopology(own.node)
    const runs = paragraph.children
      .filter((n) => (A_URIS.has(n.uri) && ['r', 'fld', 'br'].includes(n.local)) ||
        (!standalone && isEquationEntry(n)))
      .map((n) => ({
        source: owner.location(n),
        layers: { target, entries: [
          ...(!isEquationEntry(n) ? [runDeclaration(owner, n)] : []),
          ...layers('run').entries,
        ] },
      }))
    return {
      source: owner.location(paragraph),
      paragraph: layers('paragraph'),
      run: layers('run'),
      runs,
    }
  })
  const fontRequests = themeData.declarations.filter((d) => d.typeface.length > 0)
  for (const paragraph of paragraphs)
    for (const layer of [
      ...paragraph.run.entries,
      ...paragraph.runs.flatMap((r) => r.layers.entries),
    ])
      for (const key of ['fontLatin', 'fontEastAsian', 'fontComplexScript'])
        if (
          layer.properties[key] &&
          !fontRequests.some((r) => r.id === layer.id && r.property === key)
        )
          fontRequests.push({
            id: layer.id,
            source: layer.source,
            property: key,
            ...layer.properties[key],
          })
  for (const paragraph of paragraphs)
    for (const layer of paragraph.paragraph.entries)
      if (
        layer.properties.bulletFont &&
        layer.properties.bulletFont !== 'text' &&
        !fontRequests.some((r) => r.id === layer.id && r.property === 'bulletFont')
      )
        fontRequests.push({
          id: layer.id,
          source: layer.source,
          property: 'bulletFont',
          ...layer.properties.bulletFont,
        })
  return {
    schemaVersion: 1,
    occurrenceId,
    definitionId: definition.id,
    hostSlidePartUri: slide.partUri,
    bindings: {
      layoutDefinitionId: layoutDefinition?.id || null,
      masterDefinitionId: masterDefinition?.id || null,
    },
    relationships: graph.relationships,
    provenance: graph.provenance,
    theme: themeData.theme,
    body,
    paragraphs,
    fontRequests,
  }
}
async function buildSemanticTextStyleContexts({ zip, inventory, occurrenceIds }) {
  if (!Array.isArray(occurrenceIds) || new Set(occurrenceIds).size !== occurrenceIds.length)
    contextFailure('ppt/presentation.xml', null, [], 'explicit unique occurrence IDs required')
  const selected = [...occurrenceIds], factory = createContextSourceFactory(zip, inventory)
  const contexts = []
  for (const occurrenceId of selected)
    contexts.push(await readContext(factory.inventory, factory.createSource(), occurrenceId))
  return contexts
}
module.exports = { readSemanticTextStyleContext, buildSemanticTextStyleContexts }
