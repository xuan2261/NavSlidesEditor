const { sanitizeMediaSrc } = require('../content-safety.js')

function contentItem(value) {
  if (typeof value === 'string') return { text: value }
  const item = { text: typeof value?.text === 'string' ? value.text : '' }
  const media = value?.type === 'image' ? value : value?.media
  const src = sanitizeMediaSrc(media?.src)
  if (src) item.media = { src, alt: typeof media.alt === 'string' ? media.alt : '' }
  return item
}
function independentItems(items) {
  return items
    .map(contentItem)
    .sort((a, b) =>
      a.text < b.text
        ? -1
        : a.text > b.text
          ? 1
          : (a.media?.src || '').localeCompare(b.media?.src || '')
    )
}
function questionContent(question, teacherReveal) {
  const sections = [
    {
      label: question.prompt,
      items: question.media ? [contentItem({ media: question.media })] : [],
    },
  ]
  const options = question.options
  const append = (label, items, solution = false) =>
    sections.push({ label, items: items.map(contentItem), ...(solution ? { solution: true } : {}) })
  if (question.kind === 'matching') {
    append('Prompts', options.left)
    append('Targets', independentItems(options.right))
  } else if (Array.isArray(options))
    append('Choices', question.kind === 'ordering' ? independentItems(options) : options)
  else if (question.kind === 'true-false') append('Choices', ['True', 'False'])
  else if (question.kind === 'fill-blank') append('Response', ['________________'])
  if (!teacherReveal) return sections
  const key = question.answerKey
  const find = (items, id) => items.find((item) => item.id === id)
  switch (question.kind) {
    case 'single-choice':
      append('Answer', [find(options, key.optionId)], true)
      break
    case 'multi-choice':
      append(
        'Answers',
        key.optionIds.map((id) => find(options, id)),
        true
      )
      break
    case 'true-false':
      append('Answer', [key.value ? 'True' : 'False'], true)
      break
    case 'fill-blank':
      append('Accepted answers', key.accepted, true)
      break
    case 'ordering':
      append(
        'Correct order',
        key.itemIds.map((id, index) => ({
          text: `${index + 1}. ${find(options, id).text}`,
          media: find(options, id).media,
        })),
        true
      )
      break
    case 'matching':
      key.pairs.forEach((pair) => {
        const left = find(options.left, pair.leftId),
          right = find(options.right, pair.rightId)
        append(
          'Match',
          left.media || right.media ? [left, '→', right] : [`${left.text} → ${right.text}`],
          true
        )
      })
      break
    case 'image-hotspot':
      sections[0].regions = key.regions.map((region) => {
        const { shape, x, y, width, height, cx, cy, r } = region
        return shape === 'rect' ? { shape, x, y, width, height } : { shape, cx, cy, r }
      })
      append(
        'Answer regions',
        key.regions.map((region) => find(options, region.id)),
        true
      )
      break
  }
  return sections
}
module.exports = { contentItem, independentItems, questionContent }
