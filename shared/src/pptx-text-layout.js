const { cloneTextData, normalizeTextDocument, evaluateFontProfile } = require('./pptx-text-document.js')
const { buildTextLayoutPlan } = require('./pptx-text-layout-plan.js')
const { measureParagraphLines } = require('./pptx-text-layout-wrap.js')

const EMU_PER_PX = 9525, PX_PER_PT = 4 / 3
const cache = new WeakMap()
function layoutInput(input) {
  const data = cloneTextData(input)
  if (!data || Object.keys(data).some((key) => !['document', 'shape', 'fontProfile', 'rendererProfile', 'theme'].includes(key)))
    throw new TypeError('Invalid text layout input')
  data.document = normalizeTextDocument(data.document)
  evaluateFontProfile({ profile: data.fontProfile, requests: [] })
  const shape = data.shape, rect = shape?.textRectEmu
  const integer = (value) => Number.isSafeInteger(value) && Math.abs(value) <= 2147483647
  if (!shape || Object.keys(shape).sort().join() !== 'heightEmu,textRectEmu,widthEmu' ||
      !integer(shape.widthEmu) || shape.widthEmu <= 0 || !integer(shape.heightEmu) || shape.heightEmu <= 0 ||
      !rect || Object.keys(rect).sort().join() !== 'b,l,r,t' || !Object.values(rect).every(integer) ||
      rect.r <= rect.l || rect.b <= rect.t) throw new TypeError('Invalid text layout shape rectangle/extent')
  const profile = data.rendererProfile
  if (!profile || profile.id !== 'pptx-explicit-lines-v1' ||
      !['sessionId', 'userAgent', 'platform', 'language'].every((key) => typeof profile[key] === 'string' && profile[key]) ||
      !Number.isFinite(profile.devicePixelRatio) || profile.devicePixelRatio <= 0)
    throw new TypeError('Invalid text layout renderer profile')
  return data
}
function textLayoutIdentity(input) {
  // Collision-free, conservative identity: no hash truncation, font filtering,
  // whitespace normalization, point rounding or omission of empty components.
  return JSON.stringify(layoutInput(input))
}
function prepareTextLayout(input) {
  const data = layoutInput(input), { document, shape, fontProfile } = data, issues = []
  const paragraphs = buildTextLayoutPlan(document, fontProfile, issues, data.theme)
  const body = document.body ?? {}, rect = shape.textRectEmu
  const textRectEmu = {
    l: rect.l + (body.insetLeftEmu ?? 0), t: rect.t + (body.insetTopEmu ?? 0),
    r: rect.r - (body.insetRightEmu ?? 0), b: rect.b - (body.insetBottomEmu ?? 0),
  }
  if (textRectEmu.r <= textRectEmu.l || textRectEmu.b <= textRectEmu.t)
    issues.push({ code: 'empty-text-rectangle', componentId: document.componentId, path: 'shape.textRectEmu' })
  return { ...data, textRectEmu, paragraphs, issues, cacheKey: JSON.stringify(data),
    fontScale: body.autofit?.mode === 'normal' ? (body.autofit.fontScale ?? 100000) / 100000 : 1 }
}
const spacingPx = (spacing, natural) => !spacing ? 0 :
  spacing.unit === 'points' ? spacing.value * PX_PER_PT : natural * spacing.value / 100000
function moveRuns(runs, x, y, baseline) {
  return runs.map((run) => ({ ...run, baseline: baseline + run.baseline,
    rects: run.rects.map((rect) => ({ ...rect, x: rect.x + x, y: rect.y + y })) }))
}
function layoutTextDocument(input, measurement) {
  const plan = prepareTextLayout(input)
  const failure = (issues) => ({ status: 'unsupported', qualified: false, cacheKey: plan.cacheKey,
    rendererProfile: plan.rendererProfile, issues, lines: [] })
  if (plan.issues.length) return failure(plan.issues)
  if (!measurement?.validate || !measurement?.measureLine)
    return failure([{ code: 'browser-measurement-required', componentId: plan.document.componentId, path: 'rendererProfile' }])
  const invalid = measurement.validate(plan.fontProfile, plan.rendererProfile)
  if (invalid) return failure([{ code: invalid, componentId: plan.document.componentId, path: 'rendererProfile' }])
  const prior = cache.get(measurement)
  if (prior?.key === plan.cacheKey) return cloneTextData(prior.result)
  const rect = Object.fromEntries(Object.entries(plan.textRectEmu).map(([k, v]) => [k, v / EMU_PER_PX]))
  const lines = [], body = plan.document.body, paragraphCount = plan.paragraphs.length
  let y = 0
  const budget = { count: 0 }
  for (let p = 0; p < paragraphCount; p++) {
    const paragraph = plan.paragraphs[p], properties = paragraph.properties
    const wrapped = measureParagraphLines(paragraph, { wrap: body.wrap, width: rect.r - rect.l,
      fontScale: plan.fontScale, budget }, measurement)
    if (wrapped.issues.length) return failure(wrapped.issues)
    const measured = wrapped.lines
    const bullet = paragraph.bullet ? measurement.measureLine({
      items: [paragraph.bullet], properties: {}, fontScale: plan.fontScale, startX: 0,
    }) : null
    if (bullet?.issues.length) return failure(bullet.issues)
    if (p > 0 || body.spaceFirstLastParagraph) y += spacingPx(properties.spaceBefore, measured[0].height)
    measured.forEach((line, index) => {
      const reduction = body.autofit.mode === 'normal' ? (body.autofit.lineSpaceReduction ?? 0) / 100000 : 0
      const height = (properties.lineSpacing ? spacingPx(properties.lineSpacing, line.height) : line.height) * (1 - reduction)
      const leading = (height - line.height) / 2, left = line.startX
      const right = rect.r - rect.l - (properties.marginRightEmu ?? 0) / EMU_PER_PX
      const free = right - left - line.contentWidth
      const x = rect.l + left + (properties.alignment === 'ctr' ? free / 2 : properties.alignment === 'r' ? free : 0)
      const rawTop = rect.t + y + leading
      const top = Math.floor(rawTop * 64) / 64
      const baseline = top + line.baseline
      const entry = { paragraphId: paragraph.componentId, lineIndex: index, x, y: rect.t + y,
        paintY: top, width: line.width, contentWidth: line.contentWidth, height, baseline,
        runs: moveRuns(line.runs, x, top, top), struts: moveRuns(line.struts ?? [], x, top, top) }
      if (line.breakComponentId) entry.breakComponentId = line.breakComponentId
      if (line.sourceBreak) entry.sourceBreak = line.sourceBreak
      if (line.softWrap) entry.softWrap = true
      if (index === 0 && bullet) {
        const bulletX = rect.l + ((properties.marginLeftEmu ?? 0) + (properties.indentEmu ?? 0)) / EMU_PER_PX
        entry.bullet = moveRuns(bullet.runs, bulletX, baseline - bullet.baseline, baseline - bullet.baseline)[0]
        entry.bulletPaintX = bulletX
        entry.bulletPaintY = baseline - bullet.baseline
      }
      lines.push(entry)
      y += height
    })
    if (p < paragraphCount - 1 || body.spaceFirstLastParagraph)
      y += spacingPx(properties.spaceAfter, measured.at(-1).height)
  }
  const availableHeight = rect.b - rect.t
  const offset = body.verticalAlign === 'ctr' ? (availableHeight - y) / 2 : body.verticalAlign === 'b' ? availableHeight - y : 0
  for (const line of lines) {
    line.y += offset
    line.paintY += offset
    if (line.bullet) line.bulletPaintY += offset
    line.baseline += offset
    for (const run of [...line.runs, ...line.struts, ...(line.bullet ? [line.bullet] : [])]) {
      run.baseline += offset
      for (const box of run.rects) box.y += offset
    }
  }
  const boxes = lines.flatMap((line) => [...line.runs, ...(line.bullet ? [line.bullet] : [])].flatMap((run) => run.rects))
  const result = { status: 'measured', qualified: false, cacheKey: plan.cacheKey, rendererProfile: plan.rendererProfile,
    textRectEmu: plan.textRectEmu, fontScale: plan.fontScale, height: y, lines, issues: [],
    overflow: { horizontal: body.wrap ? lines.some((line) => line.x < rect.l || line.x + line.contentWidth > rect.r ||
        line.bullet?.rects.some((box) => box.x < rect.l || box.x + box.width > rect.r)) :
      boxes.some((box) => box.x < rect.l || box.x + box.width > rect.r),
      vertical: y > availableHeight || boxes.some((box) => box.y < rect.t || box.y + box.height > rect.b) } }
  cache.set(measurement, { key: plan.cacheKey, result: cloneTextData(result) })
  return result
}
module.exports = { prepareTextLayout, textLayoutIdentity, layoutTextDocument }
