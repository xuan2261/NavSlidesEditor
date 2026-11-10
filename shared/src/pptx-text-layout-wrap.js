const EMU_PER_PX = 9525

// Only ordinary space and explicit hyphen opportunities are admitted here.
// Canonical run boundaries are deliberately absent from this decision. Native
// East Asian, discretionary-hyphen and custom line-break policies need their own
// profile, rather than a browser "anywhere" approximation.
function measureParagraphLines(paragraph, { wrap, width, fontScale, budget }, measurement) {
  const { properties } = paragraph,
    lines = []
  const measure = (items) => {
    if (++budget.count > 8192)
      return {
        issues: [
          {
            code: 'layout-measurement-budget-exceeded',
            componentId: paragraph.componentId,
            path: paragraph.path,
          },
        ],
      }
    const startX =
      (properties.marginLeftEmu ?? 0) / EMU_PER_PX +
      (!paragraph.bullet && lines.length === 0 ? (properties.indentEmu ?? 0) / EMU_PER_PX : 0)
    return measurement.measureLine({ items, properties, fontScale, startX })
  }
  for (const source of paragraph.lines) {
    // One indexing unit only; the sentinel never becomes canonical run text.
    const text = source.items.map((item) => item.kind === 'equation' ? '\ufffc' : item.text).join('')
    if (wrap && source.items.some((item) => item.kind === 'tab'))
      return {
        issues: [
          {
            code: 'unsupported-soft-wrap-tabs',
            componentId: paragraph.componentId,
            path: paragraph.path,
          },
        ],
      }
    if (
      wrap &&
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Bopomofo}\u00ad\u200b\u2060]/u.test(
        text
      )
    )
      return {
        issues: [
          {
            code: 'unsupported-soft-wrap-policy',
            componentId: paragraph.componentId,
            path: paragraph.path,
          },
        ],
      }
    const ends = wrap
      ? [...text.matchAll(/ +|-/gu)]
          .map((match) => match.index + match[0].length)
          .filter((end) => !/[\p{Mark}\u00a0]/u.test(text[end] ?? ''))
      : []
    if (ends.at(-1) !== text.length) ends.push(text.length)
    function slice(start, end) {
      let offset = 0
      return source.items.flatMap((item) => {
        const lo = offset,
          hi = lo + (item.kind === 'equation' ? 1 : item.text.length)
        offset = hi
        if (item.kind === 'equation') return lo >= start && hi <= end ? [item] : []
        if (lo === hi)
          return (lo >= start && lo < end) || (end === text.length && lo === end) ? [item] : []
        const a = Math.max(start, lo),
          b = Math.min(end, hi)
        return b > a
          ? [
              {
                ...item,
                text: item.text.slice(a - lo, b - lo),
                start: item.start + a - lo,
                end: item.start + b - lo,
              },
            ]
          : []
      })
    }
    let start = 0,
      accepted = null,
      acceptedEnd = 0
    for (let i = 0; i < ends.length; i++) {
      const end = ends[i],
        candidate = measure(slice(start, end))
      if (candidate.issues.length) return candidate
      // Preserved trailing spaces hang at a soft line edge. Measure the intact
      // non-space prefix separately; never subtract estimated space advances or
      // lose the authored trailing characters/selection rectangles.
      const trailing = wrap ? (/ +$/u.exec(text.slice(start, end))?.[0].length ?? 0) : 0
      candidate.contentWidth = candidate.width
      if (trailing) {
        const content =
          end - trailing > start ? measure(slice(start, end - trailing)) : { issues: [], width: 0 }
        if (content.issues.length) return content
        candidate.contentWidth = content.width
      }
      const available = width - candidate.startX - (properties.marginRightEmu ?? 0) / EMU_PER_PX
      if (candidate.contentWidth > available && accepted) {
        lines.push({ ...accepted, softWrap: true })
        start = acceptedEnd
        accepted = null
        i--
      } else {
        accepted = candidate
        acceptedEnd = end
      }
    }
    if (accepted)
      lines.push({
        ...accepted,
        ...(source.breakComponentId ? { breakComponentId: source.breakComponentId } : {}),
        ...(source.sourceBreak ? { sourceBreak: source.sourceBreak } : {}),
      })
  }
  return { issues: [], lines }
}
module.exports = { measureParagraphLines }
