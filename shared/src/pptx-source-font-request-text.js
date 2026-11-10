const { resolveProperty, resolveProperties } = require('./pptx-style-resolution')
const { scriptSegments } = require('./pptx-text-layout-font')
const { collectOmmlFontRequests } = require('./pptx-omml-source-style')

// Resolve the same explicit text properties consumed by the layout engine.
// Physical font registration never supplies missing occurrence declarations.
function requestTextFonts(text, { context, sourceText = text, defaults = {}, source, add, issue }) {
  for (const [p, paragraph] of text.paragraphs.entries()) {
    const sourceIndex = sourceText.paragraphs.findIndex((entry) => entry.componentId === paragraph.componentId)
    const original = sourceText.paragraphs[sourceIndex]
    const inherited = context?.paragraphs[sourceIndex]
    const runs = [...paragraph.runs]
    if (!runs.length || paragraph.endRunProperties) runs.push({
      componentId: paragraph.componentId, text: '', properties: paragraph.endRunProperties,
    })
    const slotsByRun = new Map()
    let line = []
    function finishLine() {
      let preceding = scriptSegments(line.map((entry) => entry.text).join(''))[0]?.slot
      for (const entry of line) {
        const segments = scriptSegments(entry.text, 0, preceding)
        preceding = segments.at(-1)?.slot ?? preceding
        for (const segment of segments) slotsByRun.get(entry.run).add(segment.slot)
      }
      line = []
    }
    for (const run of runs) {
      slotsByRun.set(run, new Set())
      if (run.kind === 'break') { slotsByRun.get(run).add('fontLatin'); finishLine(); continue }
      if (run.kind === 'equation') { finishLine(); continue }
      for (const token of (run.text ?? '').split(/(\r\n|\r|\n|\t)/u)) {
        if (/^[\r\n]+$/u.test(token)) finishLine()
        else if (token === '\t' || !run.text) slotsByRun.get(run).add('fontLatin')
        else if (token) line.push({ run, text: token })
      }
    }
    finishLine()
    for (const [r, run] of runs.entries()) {
      const direct = { ...defaults.run, ...paragraph.defaultRunProperties, ...run.properties }
      const location = { ...source, componentId: run.componentId,
        path: `paragraphs[${p}].runs[${r}]` }
      const sourceRun = original?.runs.findIndex((entry) => entry.componentId === run.componentId)
      const originalLayers = inherited?.runs[sourceRun]?.layers ?? inherited?.run
      const layers = originalLayers && { ...originalLayers,
        entries: originalLayers.entries.filter((entry) => !['run', 'paragraph'].includes(entry.kind)),
        target: {
          ...originalLayers.target, ...(paragraph.properties?.level !== undefined
            ? { level: paragraph.properties.level } : {}),
        } }
      let inheritedProperties
      function resolved(property) {
        if (Object.hasOwn(direct, property)) {
          return resolveProperty({ property, scope: 'run', ...(context?.theme ? { theme: context.theme } : {}),
            layers: { target: {}, entries: [{ id: 'effective-run', kind: 'run',
              source: { part: source.part, path: location.path },
              properties: { [property]: direct[property] } }] } })
        }
        if (!layers) return { resolved: null, unsupportedReason: 'property-not-defined' }
        inheritedProperties ??= resolveProperties({ scope: 'run', theme: context.theme, layers })
        return inheritedProperties[property]
      }
      const bold = resolved('bold').resolved ?? false
      const italic = resolved('italic').resolved ?? false
      if (run.kind === 'equation') {
        try {
          const properties = {}
          for (const property of ['fontLatin', 'fontSizePt', 'bold', 'italic']) {
            const value = resolved(property).resolved
            if (value !== null) properties[property] = property === 'fontLatin'
              ? { typeface: value } : value
          }
          for (const font of collectOmmlFontRequests(run.ommlDocument, {
            textDefaults: { run: properties }, theme: context?.theme,
          })) add(font.fontFamily, font.bold, font.italic, {
            ...location, componentId: font.componentId,
            path: `${location.path}.ommlDocument.root${font.path.map((i) => `.children[${i}]`).join('')}`,
          })
        } catch (error) {
          issue('source-math-font-context-unavailable', { ...location,
            ...(error.componentId ? { componentId: error.componentId } : {}),
          })
        }
      } else {
        const slots = slotsByRun.get(run)
        if (!slots.size) slots.add('fontLatin')
        for (const slot of slots) {
          if (slot === 'unsupported') { issue('unsupported-script', location); continue }
          const font = resolved(slot)
          if (!font.resolved) issue(font.unsupportedReason === 'property-not-defined'
            ? 'source-font-declaration-missing' : font.unsupportedReason, { ...location, property: slot })
          else add(font.resolved, bold, italic, location)
        }
      }
      if (r === 0) {
        const properties = { ...defaults.paragraph, ...paragraph.properties }
        const paragraphProperty = (property) => {
          const layers = inherited?.paragraph
          if (!Object.hasOwn(properties, property) && !layers) return { resolved: null }
          return resolveProperty({ property, scope: 'paragraph',
            ...(context?.theme ? { theme: context.theme } : {}),
            layers: { target: { ...layers?.target,
              ...(properties.level !== undefined ? { level: properties.level } : {}) },
            entries: [...(layers?.entries ?? []).filter((entry) => entry.kind !== 'paragraph'),
              ...(Object.hasOwn(properties, property) ? [{
                id: 'effective-bullet', kind: 'paragraph',
                source: { part: source.part, path: location.path },
                properties: { [property]: properties[property] },
              }] : [])] } })
        }
        const bullet = paragraphProperty('bullet')
        if (bullet.resolved && bullet.resolved.kind !== 'none') {
          const font = paragraphProperty('bulletFont')
          if (font.resolved) add(font.resolved, bold, italic, {
            ...location, path: `paragraphs[${p}].properties.bulletFont`,
          })
          else if (font.unsupportedReason &&
            !['property-not-defined', 'requires-bullet-run-style'].includes(font.unsupportedReason))
            issue(font.unsupportedReason, location)
        }
      }
    }
  }
}
module.exports = { requestTextFonts }
