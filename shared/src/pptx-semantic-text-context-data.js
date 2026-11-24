const { normalizeTextProperties } = require('./pptx-text-document')
const { resolveProperty } = require('./pptx-style-resolution')

const fail = (detail) => {
  throw new TypeError(`Invalid source text context: ${detail}`)
}
const same = (a, b) => {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b) || (Array.isArray(a) && a.length !== b.length))
    return false
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && same(a[key], b[key]))
  )
}
function fields(value, allowed, required = allowed) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    required.some((key) => !Object.hasOwn(value, key)) ||
    Object.keys(value).some((key) => !allowed.includes(key))
  )
    fail('record fields')
}
function sourcePath(source) {
  fields(source, ['part', 'path'])
  if (
    typeof source.path !== 'string' ||
    !/^(0|[1-9]\d*)(\.(0|[1-9]\d*))*$/.test(source.path) ||
    source.path.split('.').some((n) => !Number.isSafeInteger(Number(n)))
  )
    fail('source path')
  return source.path.split('.').map(Number)
}
const within = (source, owner) =>
  source.part === owner.partUri &&
  owner.componentLocator.path.every((n, i) => sourcePath(source)[i] === n)

function validateTextContextData(context, owners, checkedSource) {
  const receipts = new Map()
  if (!Array.isArray(context.provenance)) fail('provenance')
  for (const receipt of context.provenance) {
    fields(receipt, ['id', 'source', 'preconditionHash'])
    if (typeof receipt.id !== 'string' || !receipt.id.length || receipts.has(receipt.id))
      fail('duplicate provenance identity')
    const path = sourcePath(receipt.source)
    checkedSource({
      partUri: receipt.source.part,
      preconditionHash: receipt.preconditionHash,
      componentLocator: { path, preconditionHash: receipt.preconditionHash },
    })
    if (!owners.parts.includes(receipt.source.part)) fail('provenance outside relationship chain')
    receipts.set(receipt.id, receipt)
  }
  function receipt(value) {
    sourcePath(value.source)
    if (!same(receipts.get(value.id)?.source, value.source)) fail('missing source receipt')
  }
  function layers(value, scope) {
    // Reuse the renderer's typed layer/target/theme contract, without storing any
    // resolved values or requiring a physical font/default.
    resolveProperty({
      layers: value,
      theme: context.theme,
      scope,
      property: { body: 'insetLeftEmu', paragraph: 'marginLeftEmu', run: 'bold' }[scope],
    })
    for (const layer of value.entries) {
      receipt(layer)
      normalizeTextProperties(layer.properties, scope)
      const owner = layer.kind.startsWith('layout')
        ? owners.layout
        : layer.kind.startsWith('master') && layer.kind !== 'masterTextStyle'
          ? owners.master
          : ['presentationDefault', 'masterTextStyle', 'theme'].includes(layer.kind)
            ? null
            : owners.own
      const part = {
        presentationDefault: owners.parts[0],
        masterTextStyle: owners.parts[3],
        theme: owners.parts[4],
      }[layer.kind]
      if (part ? layer.source.part !== part : !owner || !within(layer.source, owner))
        fail('declaration owner')
    }
  }
  receipt(context.theme)
  if (context.theme.source.part !== owners.parts[4] || context.theme.source.path !== '0')
    fail('theme owner')
  layers(context.body, 'body')
  const definition = owners.definition
  const textParagraphs = definition.content.textDocument?.paragraphs
  const equation = definition.content.ommlDocument
  if (
    !Array.isArray(context.paragraphs) ||
    context.paragraphs.length !== (textParagraphs?.length ?? (equation ? 1 : 0))
  )
    fail('paragraph inventory')
  function componentLocation(source, componentId) {
    const component = owners.definition.components.find((c) => c.id === componentId)
    if (
      !component ||
      source.part !== owners.own.partUri ||
      !same(sourcePath(source), component.locator.path)
    )
      fail('text component location')
  }
  for (const [index, paragraph] of context.paragraphs.entries()) {
    fields(paragraph, ['source', 'paragraph', 'run', 'runs'])
    const text = textParagraphs?.[index]
    if (text) componentLocation(paragraph.source, text.componentId)
    else {
      // Bind the real paragraph for direct or inventoried-wrapper OMML roots.
      const root = definition.components.find((c) => c.id === equation.root.componentId)
      const paragraphs = definition.components.filter((c) => c.kind === 'paragraph')
      const ownerPath = owners.own.componentLocator.path
      const path = sourcePath(paragraph.source)
      const rootPath = root?.locator.path ?? []
      const wrapperPath = rootPath.slice(0, -1)
      const wrapper = definition.components.find((c) =>
        c.id === `${owners.own.partUri}#unknown-extension:${wrapperPath.join('.')}` &&
        c.kind === 'property' && same(c.locator.path, wrapperPath))
      if (
        paragraphs.length !== 1 ||
        path.length !== ownerPath.length + 2 ||
        !ownerPath.every((n, i) => path[i] === n) ||
        !(rootPath.length === path.length + 1 ||
          (rootPath.length === path.length + 2 && wrapper)) ||
        !path.every((n, i) => root.locator.path[i] === n)
      )
        fail('equation containing paragraph')
      componentLocation(paragraph.source, paragraphs[0].id)
      for (const set of [paragraph.paragraph, paragraph.run])
        for (const layer of set.entries.filter((e) => e.kind === 'paragraph')) {
          const declarationPath = sourcePath(layer.source)
          if (
            layer.source.part !== paragraph.source.part ||
            !(
              same(declarationPath, path) ||
              (declarationPath.length === path.length + 1 &&
                declarationPath.at(-1) === 0 &&
                path.every((n, i) => declarationPath[i] === n))
            )
          )
            fail('equation paragraph declaration')
        }
    }
    layers(paragraph.paragraph, 'paragraph')
    layers(paragraph.run, 'run')
    if (!Array.isArray(paragraph.runs) || paragraph.runs.length !== (text?.runs.length ?? 0))
      fail('run inventory')
    for (const [runIndex, run] of paragraph.runs.entries()) {
      fields(run, ['source', 'layers'])
      componentLocation(run.source, text.runs[runIndex].componentId)
      layers(run.layers, 'run')
    }
  }
  if (!Array.isArray(context.fontRequests)) fail('font requests')
  const fonts = new Set()
  for (const font of context.fontRequests) {
    fields(
      font,
      ['id', 'source', 'property', 'typeface', 'script', 'panose', 'pitchFamily', 'charset'],
      ['id', 'source', 'typeface']
    )
    receipt(font)
    const key = JSON.stringify([font.id, font.property ?? null])
    if (
      fonts.has(key) ||
      typeof font.typeface !== 'string' ||
      !font.typeface.length ||
      font.typeface.length > 1024 ||
      (font.property !== undefined &&
        !['fontLatin', 'fontEastAsian', 'fontComplexScript', 'bulletFont'].includes(font.property))
    )
      fail('font request identity')
    fonts.add(key)
    if (font.script !== undefined && typeof font.script !== 'string') fail('font request metadata')
    if (font.property !== undefined) {
      const descriptor = Object.fromEntries(
        ['typeface', 'script', 'panose', 'pitchFamily', 'charset']
          .filter((key) => Object.hasOwn(font, key))
          .map((key) => [key, font[key]])
      )
      normalizeTextProperties({ fontLatin: descriptor }, 'run')
    } else
      // Theme requests retain their existing lexical source contract.
      for (const field of ['panose', 'pitchFamily', 'charset'])
        if (font[field] !== undefined && typeof font[field] !== 'string')
          fail('font request metadata')
  }
}
module.exports = { validateTextContextData, fields, sourcePath, fail, same }
