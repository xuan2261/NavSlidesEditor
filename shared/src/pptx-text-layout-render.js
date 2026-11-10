const { escapePlainText } = require('./content-safety.js')
const { textLayoutIdentity } = require('./pptx-text-layout.js')
const { TEXT_SHAPING_RESET } = require('./pptx-text-layout-font.js')

const EMU_TO_CSS = 96 / 914400
const finitePx = (value) => {
  if (!Number.isFinite(value)) throw new TypeError('Measured text layout contains invalid coordinates')
  return `${Object.is(value, -0) ? 0 : value}px`
}

// This is the same zero-size baseline marker used by the isolated browser
// shaper. Keep each logical line intact; range boxes are not glyph fragments.
const baselineMarker = '<span aria-hidden="true" style="display:inline-block;width:0;height:0;padding:0;margin:0;vertical-align:baseline;"></span>'

function renderMeasuredTextLines(input, layout, renderRun) {
  const document = input?.document
  const rect = input?.shape?.textRectEmu
  if (layout?.status !== 'measured' || layout.qualified !== false || !Array.isArray(layout.lines) ||
      typeof renderRun !== 'function' || !rect || ![rect.l, rect.t, rect.r, rect.b].every(Number.isFinite) ||
      layout.cacheKey !== textLayoutIdentity(input))
    throw new TypeError('Measured text layout identity mismatch or unavailable')
  const paragraphs = new Map(document.paragraphs.map((paragraph) => [paragraph.componentId, paragraph]))
  const runs = new Map(document.paragraphs.flatMap((paragraph) => paragraph.runs)
    .map((run) => [run.componentId, run]))
  const left = rect.l * EMU_TO_CSS, top = rect.t * EMU_TO_CSS
  return layout.lines.map((line) => {
    const paragraph = paragraphs.get(line.paragraphId)
    if (!paragraph) throw new TypeError('Measured text paragraph identity changed')
    const direction = paragraph.properties?.direction === 'rtl' ? 'rtl' : 'ltr'
    const fragments = [], struts = line.struts ?? []
    let strutIndex = 0
    for (let index = 0; index <= line.runs.length; index++) {
      while (struts[strutIndex]?.beforeRunIndex === index)
        fragments.push(renderRun(struts[strutIndex++], null))
      if (index < line.runs.length) fragments.push(line.runs[index])
    }
    const content = fragments.map((run) => {
      if (typeof run === 'string') return run
      const source = runs.get(run.componentId)
      if (!source || !['text', 'field', 'tab', 'equation'].includes(run.kind) ||
          (run.kind === 'equation' && (source.kind !== 'equation' ||
            JSON.stringify(source.ommlDocument) !== JSON.stringify(run.ommlDocument))))
        throw new TypeError('Measured text run identity changed')
      if (run.kind === 'tab') {
        const runRect = run.rects[0]
        if (!runRect) throw new TypeError('Measured tab lacks a rectangle')
        return `<span data-pptx-text-run="${escapePlainText(run.componentId)}" data-pptx-text-offset="${run.start}:${run.end}" style="display:inline-block;width:${finitePx(runRect.width)};height:0;vertical-align:baseline;white-space:pre;"></span>`
      }
      return renderRun(run, source)
    }).join('') + baselineMarker
    const paintY = line.paintY ?? line.y
    const bullet = line.bullet ? (() => {
      if (!line.bullet.rects[0]) throw new TypeError('Measured bullet lacks a rectangle')
      const style = `position:absolute;left:${finitePx(line.bulletPaintX - line.x)};top:${finitePx(line.bulletPaintY - paintY)};white-space:pre;font-size:0;line-height:normal;`
      return `<span data-pptx-text-bullet="${escapePlainText(line.paragraphId)}" style="${escapePlainText(style)}">${renderRun(line.bullet, null)}${baselineMarker}</span>`
    })() : ''
    const style = TEXT_SHAPING_RESET + `position:absolute;display:inline-block;width:max-content;margin:0;padding:0;border:0;left:${finitePx(line.x - left)};top:${finitePx(paintY - top)};white-space:pre;line-height:normal;font-size:0;direction:${direction};text-align:left;font-synthesis:none;`
    return `<div data-pptx-text-layout-line="${escapePlainText(line.paragraphId)}:${line.lineIndex}" style="${escapePlainText(style)}">${content}${bullet}</div>`
  }).join('')
}

module.exports = { renderMeasuredTextLines }
