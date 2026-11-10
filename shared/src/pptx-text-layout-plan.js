const { TEXT_PROPERTY_SCOPES, evaluateFontProfile } = require('./pptx-text-document.js')
const { scriptSegments } = require('./pptx-text-layout-font.js')

// Input is an effective canonical document. Missing inherited properties must
// be resolved by the caller, not guessed from a compatibility HTML projection.
function buildTextLayoutPlan(document, fontProfile, issues, theme) {
  const issue = (code, componentId, path) => issues.push({ code, componentId, path })
  const body = document.body ?? {}, bodyIssue = (code, key) => issue(code, document.componentId, `body.${key}`)
  const runIssues = (properties, componentId, path) => {
    const propertyPath = path.endsWith('.endRunProperties') ? path : `${path}.properties`
    if (properties.kumimoji) issue('unsupported-kumimoji', componentId, `${propertyPath}.kumimoji`)
    if (properties.normalizeHeight) issue('unsupported-normalize-height', componentId, `${propertyPath}.normalizeHeight`)
    if (properties.capitalization && properties.capitalization !== 'none')
      issue('unsupported-capitalization', componentId, `${propertyPath}.capitalization`)
    const outline = properties.outline
    if (!(outline?.width > 0) || outline.fill === 'none' || outline.color?.kind === 'none') return
    if (outline.dash?.value && outline.dash.value !== 'solid')
      issue('unsupported-text-outline-dash', componentId, `${path}.properties.outline`)
    if (outline.join?.kind && outline.join.kind !== 'round')
      issue('unsupported-text-outline-join', componentId, `${path}.properties.outline`)
  }
  for (const key of ['insetLeftEmu', 'insetRightEmu', 'insetTopEmu', 'insetBottomEmu', 'wrap',
    'verticalText', 'verticalAlign', 'autofit'])
    if (body[key] === undefined) bodyIssue('unresolved-body-property', key)
  if (body.verticalText && body.verticalText !== 'horz') bodyIssue('unsupported-vertical-text', 'verticalText')
  if (body.rotation) bodyIssue('unsupported-text-rotation', 'rotation')
  if (body.rtlColumns) bodyIssue('unsupported-rtl-columns', 'rtlColumns')
  if (body.columnCount > 1) bodyIssue('unsupported-text-columns', 'columnCount')
  if (body.compatibleLineSpacing) bodyIssue('unsupported-compatible-line-spacing', 'compatibleLineSpacing')
  if (body.anchorCenter) bodyIssue('unsupported-anchor-center', 'anchorCenter')
  if (body.verticalAlign && !['t', 'ctr', 'b'].includes(body.verticalAlign)) bodyIssue('unsupported-vertical-alignment', 'verticalAlign')
  if (body.autofit?.mode === 'shape') bodyIssue('shape-autofit-needs-geometry', 'autofit')
  if (body.autofit?.mode === 'normal') {
    if (body.autofit.fontScale === 0) bodyIssue('zero-autofit-font-scale', 'autofit')
  }
  let itemCount = 0, textLength = 0, lineCount = 0
  const resolved = (defaults = {}, local = {}) => Object.fromEntries(TEXT_PROPERTY_SCOPES.run
    .filter((key) => Object.hasOwn(local, key) || Object.hasOwn(defaults, key))
    .map((key) => [key, Object.hasOwn(local, key) ? local[key] : defaults[key]]))
  function item(run, properties, path, segment, kind = 'text') {
    const { componentId } = run, slot = segment.slot ?? 'fontLatin'
    if (slot === 'unsupported') issue('unsupported-script', componentId, path)
    runIssues(properties, componentId, path)
    if (!properties.fontSizePt) issue('unresolved-font-size', componentId, `${path}.properties.fontSizePt`)
    if (properties.altLanguage) issue('unsupported-alternate-language', componentId, `${path}.properties.altLanguage`)
    const font = properties[slot]
    let faceId = null
    if (!font || font.typeface.startsWith('+')) issue('unresolved-script-font', componentId, `${path}.properties.${slot}`)
    else {
      const result = evaluateFontProfile({ profile: fontProfile, requests: [{
        typeface: font.typeface, bold: properties.bold ?? false, italic: properties.italic ?? false,
        source: { part: 'pptxTextDocument', path },
      }] }).results[0]
      faceId = result.faceId
      if (!result.metricsQualified) issue(result.unsupportedReason, componentId, `${path}.properties.${slot}`)
    }
    if ([...segment.text].some((character) => {
      const cp = character.codePointAt(0)
      return cp === 0x200c || cp === 0x200d || (cp >= 0xfe00 && cp <= 0xfe0f) ||
        (cp >= 0xe0100 && cp <= 0xe01ef)
    }))
      issue('unsupported-font-sequence', componentId, path)
    itemCount++
    return { ...segment, kind, componentId, properties, faceId, path,
      sourceKind: run.kind ?? 'paragraph', ...(run.field ? { field: run.field } : {}) }
  }
  // Lazily load numbering only for documents which declare it. Existing isolated
  // explicit-line consumers need no numbering implementation or synthetic list.
  const numbering = document.paragraphs.some((p) => p.properties?.bullet?.kind === 'number')
    ? require('./pptx-text-layout-bullets.js').createBulletNumbering() : null
  const paragraphs = document.paragraphs.map((paragraph, index) => {
    const path = `paragraphs[${index}]`, properties = paragraph.properties ?? {}
    const pIssue = (code, key) => issue(code, paragraph.componentId, `${path}.properties.${key}`)
    if (properties.alignment && !['l', 'ctr', 'r'].includes(properties.alignment)) pIssue('unsupported-paragraph-alignment', 'alignment')
    if (properties.fontAlignment && !['auto', 'base'].includes(properties.fontAlignment)) pIssue('unsupported-font-alignment', 'fontAlignment')
    for (const key of ['hangingPunctuation', 'latinLineBreak', 'eastAsianLineBreak'])
      if (properties[key] !== undefined) pIssue('unsupported-line-break-rule', key)
    const number = numbering?.(properties)
    if (properties.bullet?.kind === 'number' && number === null)
      pIssue('unsupported-numbered-bullet', 'bullet')
    if (new Set((properties.tabs ?? []).map((tab) => tab.positionEmu)).size !== (properties.tabs?.length ?? 0))
      pIssue('ambiguous-tab-stop', 'tabs')
    const lines = [{ items: [] }]
    let emptyProperties = resolved(paragraph.defaultRunProperties, paragraph.endRunProperties)
    for (let r = 0; r < paragraph.runs.length; r++) {
      const run = paragraph.runs[r], runPath = `${path}.runs[${r}]`
      const style = resolved(paragraph.defaultRunProperties, run.properties)
      if (run.kind === 'break') {
        lines.at(-1).items.push(item(run, style, runPath, { text: '', start: 0, end: 0 }, 'strut'))
        lines.at(-1).breakComponentId = run.componentId
        lines.push({ items: [] })
        emptyProperties = style
        continue
      }
      if (run.kind === 'equation') {
        runIssues(style, run.componentId, runPath)
        itemCount++
        lines.at(-1).items.push({ kind: 'equation', componentId: run.componentId,
          ommlDocument: run.ommlDocument, properties: style, path: runPath, sourceKind: 'equation',
          ...(theme ? { theme } : {}) })
        continue
      }
      textLength += run.text.length
      let offset = 0
      for (const token of run.text.split(/(\r\n|\r|\n|\t)/u)) {
        if (/^[\r\n]+$/u.test(token)) {
          if (!lines.at(-1).items.length)
            lines.at(-1).items.push(item(run, style, runPath, { text: '', start: offset, end: offset }, 'strut'))
          lines.at(-1).sourceBreak = { componentId: run.componentId, start: offset, end: offset + token.length, text: token }
          lines.push({ items: [] })
          emptyProperties = style
        } else if (token === '\t') {
          lines.at(-1).items.push(item(run, style, runPath, { text: token, start: offset, end: offset + 1 }, 'tab'))
          if (properties.direction === 'rtl' || style.direction === 'rtl')
            pIssue('unsupported-bidi-tabs', 'tabs')
        } else if (token) {
          // Resolve neutral/inherited characters after the entire explicit line
          // is known. A canonical run boundary must not change font selection.
          lines.at(-1).items.push({ run, properties: style, path: runPath, text: token, start: offset })
        } else if (run.text === '') {
          lines.at(-1).items.push(item(run, style, runPath, { text: '', start: 0, end: 0 }))
        }
        offset += token.length
      }
    }
    if (paragraph.endRunProperties) {
      emptyProperties = resolved(paragraph.defaultRunProperties, paragraph.endRunProperties)
      lines.at(-1).items.push(item(paragraph, emptyProperties, `${path}.endRunProperties`, { text: '', start: 0, end: 0 }, 'strut'))
    }
    for (const line of lines) {
      let precedingSlot = scriptSegments(line.items.map((entry) => entry.text ?? '').join(''))[0]?.slot
      line.items = line.items.flatMap((entry) => {
        if (!entry.run) return [entry]
        const segments = scriptSegments(entry.text, entry.start, precedingSlot)
        precedingSlot = segments.at(-1)?.slot ?? precedingSlot
        return segments.map((segment) => item(entry.run, entry.properties, entry.path, segment))
      })
      if (!line.items.length)
        line.items.push(item(paragraph, emptyProperties, path, { text: '', start: 0, end: 0 }, 'strut'))
      if (line.items.some((entry) => entry.kind === 'tab') &&
          line.items.some((entry) => entry.slot === 'fontComplexScript' || entry.properties.direction === 'rtl'))
        pIssue('unsupported-bidi-tabs', 'tabs')
    }
    let bullet = null
    if (properties.bullet?.kind === 'character' || number) {
      const first = lines[0].items.find((entry) => entry.kind === 'text') ?? lines[0].items[0]
      const style = resolved(first.properties)
      const typeface = properties.bulletFont && properties.bulletFont !== 'text'
        ? properties.bulletFont.typeface : first.properties[first.slot ?? 'fontLatin']?.typeface
      if (typeface) style.fontLatin = { typeface }
      if (properties.bulletColor && properties.bulletColor !== 'text') style.color = properties.bulletColor
      if (properties.bulletSize && properties.bulletSize !== 'text')
        style.fontSizePt = properties.bulletSize.unit === 'points' ? properties.bulletSize.value :
          style.fontSizePt * properties.bulletSize.value / 100000
      bullet = item(paragraph, style, `${path}.properties.bullet`, {
        text: number || properties.bullet.character, start: 0,
        end: (number || properties.bullet.character).length,
      })
      if (properties.direction === 'rtl') pIssue('unsupported-bidi-bullet', 'bullet')
    }
    lineCount += lines.length
    return { componentId: paragraph.componentId, path, properties, lines, bullet }
  })
  if (itemCount > 4096 || lineCount > 1024 || textLength > 65536)
    issue('layout-budget-exceeded', document.componentId, 'paragraphs')
  return paragraphs
}
module.exports = { buildTextLayoutPlan }
