const { cloneTextData, normalizeTextDocument } = require('./pptx-text-document')

const dateStyles = Object.freeze({
  datetime: { dateStyle: 'short', timeStyle: 'short' },
  datetime1: { dateStyle: 'short' },
  datetime2: { dateStyle: 'full' },
  datetime3: { year: 'numeric', month: 'long', day: 'numeric' },
  datetime4: { year: '2-digit', month: 'numeric', day: 'numeric' },
  datetime5: {},
  datetime6: { year: '2-digit', month: 'short', day: 'numeric' },
  datetime7: { year: '2-digit', month: 'long' },
  datetime8: { year: '2-digit', month: 'short' },
  datetime9: { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' },
  datetime10: { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' },
  datetime11: { hour: '2-digit', minute: '2-digit', hour12: false },
  datetime12: { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false },
  datetime13: { hour: 'numeric', minute: '2-digit', hour12: true },
})

function preview(field, context) {
  const type = field.type.toLowerCase()
  if (type === 'slidenum')
    return Number.isSafeInteger(context.slideNumber) && context.slideNumber > 0
      ? String(context.slideNumber)
      : null
  if (['title', 'slidetitle'].includes(type))
    return typeof context.slideTitle === 'string' ? context.slideTitle : null
  if (context.datePreviews && Object.hasOwn(context.datePreviews, field.type)) {
    const value = context.datePreviews[field.type]
    return typeof value === 'string' ? value : null
  }
  const style = dateStyles[type]
  if (!style || !(context.date instanceof Date) || !Number.isFinite(context.date.getTime())) return null
  if (type === 'datetime5') {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      ...(context.timeZone ? { timeZone: context.timeZone } : {}),
    })
    const values = Object.fromEntries(
      formatter
        .formatToParts(context.date)
        .filter((part) => ['year', 'month', 'day'].includes(part.type))
        .map((part) => [part.type, part.value])
    )
    return `${values.year}-${values.month}-${values.day}`
  }
  return new Intl.DateTimeFormat(context.locale || undefined, {
    ...style,
    ...(context.timeZone ? { timeZone: context.timeZone } : {}),
  }).format(context.date)
}

function evaluateTextFieldPreviews(input, context = {}) {
  const document = normalizeTextDocument(input)
  let result
  for (const [paragraphIndex, paragraph] of document.paragraphs.entries()) {
    for (const [runIndex, run] of paragraph.runs.entries()) {
      if (run.kind !== 'field') continue
      const value = preview(run.field, context)
      if (value === null || value === run.text) continue
      result ??= cloneTextData(document)
      result.paragraphs[paragraphIndex].runs[runIndex].text = value
    }
  }
  return result ? normalizeTextDocument(result) : document
}

module.exports = { evaluateTextFieldPreviews }
