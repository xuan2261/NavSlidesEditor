import { normalizeTextDocument } from 'revealjs-shared/src/pptx-text-document.js'
import { assertCanonicalTextEdit } from 'revealjs-shared/src/pptx-text-operations.js'
import { sanitizeRichTextHtml } from 'revealjs-shared/src/content-safety.js'
import { invalidatePptxFitMetaForUpdates } from './pptx-import-meta'
import { materializeTextDocument, materializeTextTheme } from 'revealjs-shared/src/pptx-text-materialization.js'
import { resolveProperty } from 'revealjs-shared/src/pptx-style-resolution.js'
import { semanticInstance, semanticDefinition, replaceSemanticRecords } from 'revealjs-shared/src/pptx-semantic-records.js'

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
export function semanticTextLayoutKey(document, { fontProfile, box, rendererProfile, outlinePaint, highlightPaint, equationTheme } = {}) {
  const requested = new Set()
  let hasEquation = false
  for (const paragraph of document.paragraphs) {
    hasEquation ||= paragraph.runs.some((run) => run.kind === 'equation')
    for (const properties of [
      paragraph.defaultRunProperties,
      paragraph.endRunProperties,
      ...paragraph.runs.map((run) => run.properties),
    ]) {
      for (const key of ['fontLatin', 'fontEastAsian', 'fontComplexScript'])
        if (properties?.[key]) requested.add(properties[key].typeface)
    }
  }
  const faces = (fontProfile?.faces ?? []).filter((face) => hasEquation || requested.has(face?.typeface))
  return JSON.stringify({
    document,
    fontProfile: { schemaVersion: fontProfile?.schemaVersion, faces },
    box,
    rendererProfile,
    outlinePaint,
    highlightPaint,
    ...(hasEquation ? { equationTheme } : {}),
  })
}
export function resolveSemanticText(presentation, element) {
  const model = presentation?.pptxSemantic
  if (!element?.pptxInstanceId || ![1, 2, 3].includes(model?.schemaVersion)) return null
  const instance = semanticInstance(model, element.pptxInstanceId)
  const source = semanticDefinition(model, instance?.definitionId)?.content?.textDocument
  if (!source) return null
  const document = instance.overrides?.components?.[source.componentId]?.textDocument ?? source
  const normalized = normalizeTextDocument(document)
  const paintDocument = materializeTextDocument(model, element.pptxInstanceId)
  const theme = materializeTextTheme(model, element.pptxInstanceId)
  const equationContext = theme ? { theme } : {}
  const layoutDependencies = {
    fontProfile: { schemaVersion: 1, faces: Object.values(model.fonts ?? {}) },
    box: { width: element.width, height: element.height },
    rendererProfile: 'tiptap-native-v1',
    outlinePaint: paintDocument.paragraphs.map((paragraph) => [paragraph.componentId,
      paragraph.defaultRunProperties?.outline, paragraph.endRunProperties?.outline,
      paragraph.runs.map((run) => [run.componentId, run.properties?.outline])]),
    highlightPaint: paintDocument.paragraphs.map((paragraph) => [paragraph.componentId,
      paragraph.defaultRunProperties?.highlight, paragraph.endRunProperties?.highlight,
      paragraph.runs.map((run) => [run.componentId, run.properties?.highlight])]),
    equationTheme: equationContext.theme,
  }
  return {
    instanceId: element.pptxInstanceId,
    document: normalized,
    paintDocument,
    equationContext,
    layoutDependencies,
    layoutKey: semanticTextLayoutKey(normalized, layoutDependencies),
  }
}
function visualColor(color) {
  if (!['srgb', 'preset'].includes(color?.kind)) return null
  const paint = resolveProperty({ property: 'color', scope: 'run', layers: {
    target: {}, entries: [{ id: 'editor-color', kind: 'run',
      source: { part: 'pptxTextDocument', path: 'properties.color' }, properties: { color } }],
  } }).resolved
  if (paint.alpha === 1) return `#${paint.rgb}`
  const channels = paint.rgb.match(/../g).map((channel) => parseInt(channel, 16))
  return `rgba(${channels.join(',')},${paint.alpha})`
}
function visual(properties = {}) {
  return {
    fontSize: properties.fontSizePt == null ? null : `${properties.fontSizePt}pt`,
    fontFamily: properties.fontLatin?.typeface ?? null,
    color: visualColor(properties.color),
    highlight: visualColor(properties.highlight),
    bold: properties.bold ?? false,
    italic: properties.italic ?? false,
    underline: properties.underline != null && properties.underline !== 'none',
    strike: properties.strike != null && properties.strike !== 'noStrike',
  }
}
const lineHeight = (spacing) =>
  spacing
    ? spacing.unit === 'points'
      ? `${spacing.value}pt`
      : String(spacing.value / 100000)
    : null
export function semanticTextToTipTap(input, paintDocument = input, { theme } = {}) {
  const document = normalizeTextDocument(input)
  const { paragraphs: sourceParagraphs, ...header } = document
  const paragraphs = sourceParagraphs.length
    ? sourceParagraphs
    : [{ componentId: `${document.componentId.slice(0, 230)}~paragraph`, runs: [] }]
  const paintParagraphs = new Map(paintDocument.paragraphs.map((paragraph) => [paragraph.componentId, paragraph]))
  const runOutline = (paragraph, run) => {
    const paintParagraph = paintParagraphs.get(paragraph.componentId) ?? paragraph
    const paintRun = paintParagraph.runs.find((candidate) => candidate.componentId === run.componentId)
    return paintRun?.properties?.outline ?? run.properties?.outline ??
      paintParagraph.defaultRunProperties?.outline ?? paragraph.defaultRunProperties?.outline
  }
  const runHighlight = (paragraph, run) => {
    const paintParagraph = paintParagraphs.get(paragraph.componentId) ?? paragraph
    const paintRun = paintParagraph.runs.find((candidate) => candidate.componentId === run.componentId)
    // Direct paint edits must defeat a cached materialized document from before
    // the edit. Scheme declarations alone need occurrence/theme resolution.
    if (run.properties?.highlight && run.properties.highlight.kind !== 'scheme') return run.properties.highlight
    return paintRun?.properties?.highlight ?? run.properties?.highlight ??
      paintParagraph.defaultRunProperties?.highlight ?? paragraph.defaultRunProperties?.highlight
  }
  return {
    type: 'doc',
    content: paragraphs.map((paragraph) => ({
      type: 'paragraph',
      attrs: {
        pptxParagraph: { header, paragraph,
          caretOutline: paintParagraphs.get(paragraph.componentId)?.endRunProperties?.outline ??
            paintParagraphs.get(paragraph.componentId)?.defaultRunProperties?.outline,
          caretHighlight: paintParagraphs.get(paragraph.componentId)?.endRunProperties?.highlight ??
            paintParagraphs.get(paragraph.componentId)?.defaultRunProperties?.highlight },
        nativeWhiteSpace: 'pre-wrap',
        lineHeight: lineHeight(paragraph.properties?.lineSpacing),
        textAlign:
          { l: 'left', ctr: 'center', r: 'right', just: 'justify' }[
            paragraph.properties?.alignment
          ] ?? null,
      },
      content: paragraph.runs.flatMap((run) => {
        const expected = { ...visual({ ...paragraph.defaultRunProperties, ...run.properties }),
          highlight: visualColor(runHighlight(paragraph, run)) }
        if (run.kind === 'equation') {
          const paintParagraph = paintParagraphs.get(paragraph.componentId) ?? paragraph
          const paintRun = paintParagraph.runs.find((candidate) => candidate.componentId === run.componentId) ?? run
          return [{ type: 'semanticEquation', attrs: {
            pptxRun: { run, identitySeed: run.componentId },
            pptxEquationStyle: {
              textDefaults: { run: { ...paintParagraph.defaultRunProperties, ...paintRun.properties } },
              ...(theme ? { theme } : {}),
            },
          } }]
        }
        const metadata = { run, expected, outline: runOutline(paragraph, run) }
        const marks = [
          {
            type: 'textStyle',
            attrs: {
              pptxRun: metadata,
              fontSize: expected.fontSize,
              fontFamily: expected.fontFamily,
              color: expected.color,
            },
          },
          ...(expected.highlight ? [{ type: 'highlight', attrs: { color: expected.highlight } }] : []),
          ...['bold', 'italic', 'underline', 'strike']
            .filter((name) => expected[name])
            .map((type) => ({ type })),
        ]
        return run.kind === 'break'
          ? [{ type: 'hardBreak', attrs: { pptxRun: metadata }, marks }]
          : run.text
            ? [{ type: 'text', text: run.text, marks }]
            : [{ type: 'semanticEmptyRun', attrs: { pptxRun: metadata }, marks }]
      }),
    })),
  }
}
export function semanticCaretMarks(parent) {
  const metadata = parent.attrs.pptxParagraph
  if (!metadata || parent.content.size) return null
  const paragraph = metadata.paragraph
  const caretDocument = {
    ...metadata.header,
    paragraphs: [
      {
        ...paragraph,
        runs: [
          {
            componentId: `${paragraph.componentId.slice(0, 230)}~run`,
            kind: 'text',
            text: 'x',
            properties: { ...paragraph.defaultRunProperties, ...paragraph.endRunProperties },
          },
        ],
      },
    ],
  }
  const caretPaint = metadata.caretHighlight === undefined ? caretDocument : {
    ...caretDocument,
    paragraphs: caretDocument.paragraphs.map((entry) => ({ ...entry,
      runs: entry.runs.map((run) => ({ ...run,
        properties: { ...run.properties, highlight: metadata.caretHighlight },
      })),
    })),
  }
  const projection = semanticTextToTipTap(caretDocument, caretPaint)
  const marks = projection.content[0].content[0].marks
  if (metadata.caretOutline !== undefined)
    marks[0].attrs.pptxRun.outline = metadata.caretOutline
  return marks
}
function sizeInPoints(value) {
  const match = /^(\d+(?:\.\d+)?)(pt|px)$/.exec(value ?? '')
  if (!match) throw new TypeError('Unsupported semantic font size')
  return Number(match[1]) * (match[2] === 'px' ? 0.75 : 1)
}
function cssColor(value) {
  if (/^#[\da-f]{6}$/i.test(value ?? '')) return { kind: 'srgb', value: value.slice(1).toUpperCase() }
  const match = /^(rgb|rgba)\(\s*(\d+),\s*(\d+),\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/.exec(value ?? '')
  if (!match || match.slice(2, 5).some((n) => Number(n) > 255) ||
      (match[1] === 'rgba') !== (match[5] !== undefined) || Number(match[5] ?? 1) > 1)
    throw new TypeError('Unsupported semantic color')
  const alpha = Math.round(Number(match[5] ?? 1) * 100000)
  return {
    kind: 'srgb',
    value: match.slice(2, 5).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase(),
    ...(alpha === 100000 ? {} : { transforms: [{ kind: 'alpha', value: alpha }] }),
  }
}
function linkedSourceRunId(run, paragraph) {
  if (!run.hyperlinks) return run.componentId
  // A numeric suffix alone is not ownership: an unrelated authored ID may end in ~N.
  // Prefer the retained paragraph's run identity and exact hyperlink declarations.
  let root = run.componentId
  for (const candidate of paragraph?.runs ?? []) {
    if (
      root.startsWith(`${candidate.componentId}~`) &&
      /^[1-9][0-9]*$/.test(root.slice(candidate.componentId.length + 1)) &&
      equal(candidate.hyperlinks, run.hyperlinks)
    ) root = candidate.componentId
  }
  // Imported identities retain their XML paths even when the original segment
  // has been deleted before saving/reopening. Require both paragraph and link
  // ownership before recovering that absent source run; never strip authored IDs.
  const source = /^(.*)#(text-run|text-field):([0-9]+(?:\.[0-9]+)*)(?:~[1-9][0-9]*)?$/.exec(root)
  if (!source) return root
  const [, part, kind, path] = source
  const parent = `${part}#paragraph:${path.split('.').slice(0, -1).join('.')}`
  const paragraphId = paragraph?.componentId
  if (!paragraphId || (paragraphId !== parent && !(paragraphId.startsWith(`${parent}~`) &&
      /^[1-9][0-9]*$/.test(paragraphId.slice(parent.length + 1))))) return root
  const prefix = `${part}#hyperlink:${path}.`
  if (!Object.values(run.hyperlinks).every((link) => link.componentId.startsWith(prefix) &&
      /^[0-9]+\.[0-9]+$/.test(link.componentId.slice(prefix.length)))) return root
  return `${part}#${kind}:${path}`
}
export function semanticTextFromTipTap(json) {
  const first = json.content?.[0]?.attrs?.pptxParagraph
  if (!first) throw new TypeError('Missing semantic paragraph identity')
  const used = new Set([first.header.componentId])
  const reserved = new Set([first.header.componentId])
  const reserveRun = (run) => {
    reserved.add(run.componentId)
    const visit = (node) => {
      reserved.add(node.componentId)
      node.children.forEach(visit)
    }
    if (run.kind === 'equation') visit(run.ommlDocument.root)
  }
  for (const node of json.content) {
    const paragraph = node.attrs?.pptxParagraph?.paragraph
    if (paragraph) {
      reserved.add(paragraph.componentId)
      for (const run of paragraph.runs) reserveRun(run)
    }
    for (const child of node.content ?? []) {
      const native = child.attrs?.pptxRun ??
        child.marks?.find((mark) => mark.type === 'textStyle')?.attrs?.pptxRun
      if (native) reserveRun(native.run)
    }
  }
  const unique = (id, sourceId = id, linked = false, fresh = false) => {
    let value = id,
      suffix = 1
    while ((fresh && value === id) || used.has(value) || (value !== id && reserved.has(value))) {
      value = `${linked ? sourceId : sourceId.slice(0, 230)}~${suffix++}`
      if (value.length > 256) throw new TypeError('Source hyperlink run identity cannot be split')
    }
    used.add(value)
    return value
  }
  const paragraphs = json.content.map((node) => {
    const metadata = node.attrs?.pptxParagraph
    if (!metadata || !['paragraph', 'heading'].includes(node.type))
      throw new TypeError('Unsupported semantic block')
    const paragraph = { ...metadata.paragraph }
    delete paragraph.runs
    const result = { ...paragraph, componentId: unique(paragraph.componentId), runs: [] }
    const alignment = { left: 'l', center: 'ctr', right: 'r', justify: 'just' }[
      node.attrs.textAlign
    ]
    const originalAlign =
      { l: 'left', ctr: 'center', r: 'right', just: 'justify' }[paragraph.properties?.alignment] ??
      null
    if (node.attrs.textAlign !== originalAlign && alignment)
      result.properties = { ...result.properties, alignment }
    if ((node.attrs.lineHeight ?? null) !== lineHeight(paragraph.properties?.lineSpacing)) {
      result.properties = { ...result.properties }
      if (node.attrs.lineHeight == null) delete result.properties.lineSpacing
      else {
        const percent = /^(\d+)(?:\.(\d{1,5}))?$/.exec(node.attrs.lineHeight)
        result.properties.lineSpacing = percent
          ? {
              unit: 'percent',
              value: Number(percent[1]) * 100000 + Number((percent[2] ?? '').padEnd(5, '0')),
            }
          : { unit: 'points', value: sizeInPoints(node.attrs.lineHeight) }
      }
    }
    let previousSourceId
    for (const child of node.content ?? []) {
      if (child.type === 'semanticEquation') {
        const source = child.attrs?.pptxRun?.run
        if (source?.kind !== 'equation' || child.text !== undefined || (child.content?.length ?? 0))
          throw new TypeError('Missing semantic equation identity')
        const componentId = unique(source.componentId)
        const retained = child.attrs.pptxRun.identitySeed === source.componentId ||
          (child.attrs.pptxRun.identitySeed === undefined &&
            metadata.paragraph.runs.some((run) => run.componentId === source.componentId && run.kind === 'equation'))
        const fresh = componentId !== source.componentId || !retained
        const reseed = (node) => ({ ...node,
          componentId: unique(node.componentId, node.componentId, false, fresh),
          children: node.children.map(reseed),
        })
        result.runs.push({ ...source, componentId,
          ommlDocument: { ...source.ommlDocument, root: reseed(source.ommlDocument.root) } })
        previousSourceId = undefined
        continue
      }
      if (!['text', 'hardBreak', 'nativeTab', 'semanticEmptyRun'].includes(child.type))
        throw new TypeError('Unsupported semantic inline node')
      const marks = child.marks ?? []
      if (
        marks.some(
          (mark) => !['textStyle', 'bold', 'italic', 'underline', 'strike', 'highlight'].includes(mark.type)
        )
      )
        throw new TypeError('Unsupported semantic inline style')
      const attrs = marks.find((mark) => mark.type === 'textStyle')?.attrs ?? {}
      const native = child.attrs?.pptxRun ?? attrs.pptxRun
      const source = native?.run ?? {
        componentId: `${result.componentId.slice(0, 230)}~run`,
        kind: 'text',
        properties: paragraph.defaultRunProperties ?? {},
      }
      if (source.kind === 'equation') throw new TypeError('Equation metadata requires an atomic equation node')
      const expected = native?.expected ?? visual(source.properties)
      const run = { ...source, properties: { ...source.properties } }
      const set = (key, value) => {
        if (value == null) delete run.properties[key]
        else run.properties[key] = value
      }
      for (const name of ['bold', 'italic', 'underline', 'strike']) {
        const active = marks.some((mark) => mark.type === name)
        if (active !== expected[name])
          set(
            name,
            name === 'underline'
              ? active
                ? 'sng'
                : 'none'
              : name === 'strike'
                ? active
                  ? 'sngStrike'
                  : 'noStrike'
                : active
          )
      }
      if ((attrs.fontSize ?? null) !== expected.fontSize)
        set('fontSizePt', attrs.fontSize ? sizeInPoints(attrs.fontSize) : null)
      if ((attrs.fontFamily ?? null) !== expected.fontFamily)
        set('fontLatin', attrs.fontFamily ? { typeface: attrs.fontFamily } : null)
      if (attrs.fontWeight != null) {
        if (!/^(normal|bold|[1-9]00)$/.test(attrs.fontWeight))
          throw new TypeError('Unsupported semantic font weight')
        set('bold', attrs.fontWeight === 'bold' || Number(attrs.fontWeight) >= 600)
      }
      if (
        (attrs.color ?? null) !== expected.color &&
        !(attrs.color && expected.color && equal(cssColor(attrs.color), cssColor(expected.color)))
      )
        set('color', attrs.color ? cssColor(attrs.color) : null)
      const highlight = marks.find((mark) => mark.type === 'highlight')
      const highlightColor = highlight ? highlight.attrs?.color ?? '#FFFF00' : null
      if (
        highlightColor !== (expected.highlight ?? null) &&
        !(highlightColor && expected.highlight && equal(cssColor(highlightColor), cssColor(expected.highlight)))
      )
        // Deleting the declaration would resurrect an inherited highlight.
        set('highlight', highlightColor ? cssColor(highlightColor) : { kind: 'none' })
      if (!Object.keys(run.properties).length && !source.properties) delete run.properties
      if (child.type === 'hardBreak') {
        run.kind = 'break'
        delete run.text
        delete run.field
      } else
        run.text =
          child.type === 'nativeTab' ? '\t' : child.type === 'semanticEmptyRun' ? '' : child.text
      const previous = result.runs.at(-1)
      if (
        previous &&
        previous.kind !== 'break' &&
        previous.kind !== 'equation' &&
        run.kind !== 'break' &&
        run.kind !== 'equation' &&
        previousSourceId === source.componentId &&
        equal(previous.properties, run.properties) &&
        equal(previous.proofing, run.proofing) &&
        equal(previous.field, run.field) &&
        equal(previous.hyperlinks, run.hyperlinks)
      ) {
        previous.text += run.text
      } else result.runs.push({
        ...run,
        componentId: unique(source.componentId, linkedSourceRunId(source, metadata.paragraph), !!source.hyperlinks),
      })
      previousSourceId = source.componentId
    }
    return result
  })
  return normalizeTextDocument({ ...first.header, paragraphs })
}
export function commitSemanticText(previous, element, document, html, mapTarget) {
  const target = resolveSemanticText(previous, element)
  if (!target) throw new TypeError('Canonical text requires its source-bound occurrence')
  let matched = false
  const projected = mapTarget(previous, (slide) => {
    if (!(slide.elements || []).some((candidate) => candidate.id === element.id)) return slide
    if (matched) throw new TypeError('Ambiguous canonical text occurrence')
    matched = true
    document = assertCanonicalTextEdit(previous.pptxSemantic, slide, element, document)
    return {
      ...slide,
      elements: slide.elements.map((candidate) =>
        candidate.id === element.id && candidate.pptxInstanceId === target.instanceId
          ? { ...candidate, ...invalidatePptxFitMetaForUpdates(candidate, { content: sanitizeRichTextHtml(html) }) }
          : candidate
      ),
    }
  })
  if (!matched) throw new TypeError('Canonical text is outside the active slide')
  if (equal(target.document, document)) return previous
  const instance = semanticInstance(previous.pptxSemantic, target.instanceId)
  return {
    ...projected,
    pptxSemantic: replaceSemanticRecords(previous.pptxSemantic, {
      instances: {
        [target.instanceId]: {
          ...instance,
          overrides: {
            ...instance.overrides,
            components: {
              ...instance.overrides?.components,
              [document.componentId]: {
                ...instance.overrides?.components?.[document.componentId],
                textDocument: document,
              },
            },
          },
        },
      },
    }),
  }
}
