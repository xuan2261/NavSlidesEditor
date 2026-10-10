const { isColor } = require('./game-validation-utils.js')
function validatePicker(config, v, wheel = false) {
  const items = v.list(config.items, ['items'], 1, 1000)
  v.unique(items, ['items'])
  items.forEach((item, i) => {
    if (!item || typeof item !== 'object') return
    v.text(item.label, ['items', i, 'label'])
    v.number(item.weight, ['items', i, 'weight'], Number.MIN_VALUE, Number.MAX_VALUE)
  })
  if (!wheel)
    v.list(config.wheelColors, ['wheelColors'], 1, 100).forEach((color, i) => {
      if (!isColor(color)) v.add(['wheelColors', i], 'Use a hex color')
    })
}
function validateResponses(type, config, v) {
  if (type === 'poll') {
    const options = v.list(config.options, ['options'], 2, 6)
    v.unique(options, ['options'])
    options.forEach((option, i) => {
      if (!option || typeof option !== 'object') return
      v.text(option.text, ['options', i, 'text'])
      if (option.media !== undefined) v.media(option.media, ['options', i, 'media'])
    })
  }
  if (type === 'matching') {
    const pairs = v.list(config.pairs, ['pairs'], 2, 8)
    v.unique(pairs, ['pairs'], 'promptId')
    v.unique(pairs, ['pairs'], 'targetId')
    pairs.forEach((pair, i) => {
      if (!pair || typeof pair !== 'object') return
      for (const key of ['prompt', 'target']) {
        v.text(pair[key], ['pairs', i, key])
        if (pair[`${key}Media`] !== undefined)
          v.media(pair[`${key}Media`], ['pairs', i, `${key}Media`])
      }
    })
  }
}
function validateCards(type, config, v) {
  const memory = type === 'memory'
  const key = memory ? 'pairs' : 'cards'
  const rows = v.list(config[key], [key], memory ? 2 : 1, memory ? 24 : 100)
  v.unique(rows, [key])
  rows.forEach((row, i) => {
    if (!row || typeof row !== 'object') return
    for (const side of memory ? ['first', 'second'] : ['front', 'back'])
      v.content(row[side], [key, i, side])
  })
}
function validateSorting(config, v) {
  const buckets = v.list(config.buckets, ['buckets'], 2, 100)
  const bucketIds = v.unique(buckets, ['buckets'])
  buckets.forEach((bucket, i) => {
    if (bucket && typeof bucket === 'object') v.text(bucket.label, ['buckets', i, 'label'])
  })
  const items = v.list(config.items, ['items'], 1, 1000)
  const itemIds = v.unique(items, ['items'])
  items.forEach((item, i) => {
    if (!item || typeof item !== 'object') return
    v.text(item.text, ['items', i, 'text'])
    if (item.media !== undefined) v.media(item.media, ['items', i, 'media'])
  })
  if (!v.object(config.answerKey, ['answerKey'])) return
  const rows = v.list(
    config.answerKey.assignments,
    ['answerKey', 'assignments'],
    items.length,
    items.length
  )
  const seen = new Set()
  rows.forEach((row, i) => {
    const path = ['answerKey', 'assignments', i]
    if (!v.object(row, path)) return
    if (!itemIds.has(row.itemId))
      v.add([...path, 'itemId'], 'Unknown item ID; restore the item or update its assignment')
    if (!bucketIds.has(row.bucketId))
      v.add([...path, 'bucketId'], 'Unknown bucket ID; restore the bucket or update its assignment')
    if (seen.has(row.itemId))
      v.add([...path, 'itemId'], 'Each item must have exactly one assignment')
    seen.add(row.itemId)
  })
  if (items.some((item) => !seen.has(item?.id)))
    v.add(['answerKey', 'assignments'], 'Every item needs an assignment')
}
module.exports = { validatePicker, validateResponses, validateCards, validateSorting }
