const { isSafeMediaSrc } = require('../content-safety.js')
const { GAME_CATALOG, CANONICAL_GAME_TYPES, isGameSubtype } = require('./game-registry.js')
const { createValidation, isObject } = require('./game-validation-utils.js')
const { validateQuestionShape } = require('./question-shape.js')
const { normalizePlaceholder } = require('../slide-layout-normalization.js')

const rows = (value) => (Array.isArray(value) ? value : [])
const atPath = (value, path) => path.reduce((at, key) => at?.[key], value)
function addReference(refs, url, path, kind) {
  if (typeof url === 'string' && isSafeMediaSrc(url)) refs.push({ path, url, kind })
}
function addImage(refs, value, path, content = false) {
  if (content && value?.type !== 'image') return
  const validation = createValidation()
  if (content) validation.content(value, path)
  else validation.media(value, path)
  if (
    validation.errors.length ||
    (/^data:/i.test(value?.src || '') && !/^data:image\//i.test(value.src))
  )
    return
  addReference(refs, value.src, [...path, 'src'], 'native')
}
function questionReferences(refs, question, path) {
  const errors = []
  validateQuestionShape(
    question,
    errors,
    question?.answerKey !== undefined || question?.feedback !== undefined
  )
  if (errors.length) return
  if (question.media) addReference(refs, question.media.src, [...path, 'media', 'src'], 'native')
  const options =
    question.kind === 'matching'
      ? [
          ['left', question.options.left],
          ['right', question.options.right],
        ]
      : [['', question.options]]
  for (const [side, items] of options)
    rows(items).forEach((item, index) => {
      if (item.media)
        addReference(
          refs,
          item.media.src,
          [...path, 'options', ...(side ? [side] : []), index, 'media', 'src'],
          'native'
        )
    })
}

/** Relative paths into a canonical authored or public config; never normalizes it. */
function collectNativeGameConfigMediaReferences(gameType, config) {
  const refs = []
  if (!isGameSubtype(gameType) || !isObject(config)) return refs
  const fields = GAME_CATALOG[gameType].authoringFields
  if (fields.includes('questions'))
    rows(config.questions).forEach((question, i) =>
      questionReferences(refs, question, ['questions', i])
    )
  if (gameType === 'jeopardy')
    rows(config.categories).forEach((category, i) => {
      rows(category?.questions).forEach((question, j) =>
        questionReferences(refs, question, ['categories', i, 'questions', j])
      )
    })
  if (gameType === 'poll' || gameType === 'sorting') {
    const key = gameType === 'poll' ? 'options' : 'items'
    rows(config[key]).forEach((item, i) => addImage(refs, item?.media, [key, i, 'media']))
  }
  if (gameType === 'matching')
    rows(config.pairs).forEach((pair, i) => {
      for (const side of ['promptMedia', 'targetMedia'])
        addImage(refs, pair?.[side], ['pairs', i, side])
    })
  if (gameType === 'memory' || gameType === 'flashcards') {
    const key = gameType === 'memory' ? 'pairs' : 'cards'
    const sides = gameType === 'memory' ? ['first', 'second'] : ['front', 'back']
    rows(config[key]).forEach((item, i) => {
      for (const side of sides) addImage(refs, item?.[side], [key, i, side], true)
    })
  }
  return refs
}

function elementReferences(element, path, refs) {
  if (!isObject(element)) return
  for (const key of ['src', 'poster']) addReference(refs, element[key], [...path, key], key)
  rows(element.tracks).forEach((track, i) =>
    addReference(refs, track?.src, [...path, 'tracks', i, 'src'], 'track')
  )
  if (element.type !== 'game') return
  // Retained subtype configs are authored data too, even when not currently active.
  for (const type of CANONICAL_GAME_TYPES) {
    const config = element[type]
    for (const ref of collectNativeGameConfigMediaReferences(type, config))
      refs.push({ ...ref, path: [...path, type, ...ref.path] })
  }
  if (isGameSubtype(element.gameType)) {
    const fields = GAME_CATALOG[element.gameType].authoringFields
    const flat = Object.fromEntries(
      fields.filter((key) => Object.hasOwn(element, key)).map((key) => [key, element[key]])
    )
    for (const ref of collectNativeGameConfigMediaReferences(element.gameType, flat))
      refs.push({ ...ref, path: [...path, ...ref.path] })
  }
}

/** Explicit authored references, including hidden/unused layouts needed for editable backup. */
function collectGameMediaReferences(presentation) {
  const refs = []
  const masters = rows(presentation?.layoutMasters)
  const visit = (slides, path) =>
    rows(slides).forEach((slide, i) => {
      if (!isObject(slide)) return
      const base = [...path, i]
      if (slide.background?.type === 'image') {
        const key = slide.background.image ? 'image' : 'src'
        addReference(refs, slide.background[key], [...base, 'background', key], 'background')
      }
      rows(slide.elements).forEach((element, j) =>
        elementReferences(element, [...base, 'elements', j], refs)
      )
      const patches = slide.layoutOverrides?.elementPatches
      const master = masters.find((item) => item?.id === slide.layoutId)
      for (const element of rows(master?.fixedElements)) {
        for (const id of [element.id, `layout-fixed:${master.id}:${element.id}`]) {
          const patch = patches?.[id]
          if (!isObject(patch)) continue
          const patchRefs = []
          elementReferences({ ...element, ...patch, type: element.type }, [], patchRefs)
          for (const ref of patchRefs) {
            if (atPath(patch, ref.path) === ref.url)
              refs.push({
                ...ref,
                path: [...base, 'layoutOverrides', 'elementPatches', id, ...ref.path],
              })
          }
        }
      }
      visit(slide.children, [...base, 'children'])
    })
  visit(presentation?.slides, ['slides'])
  masters.forEach((master, i) => {
    rows(master?.fixedElements).forEach((element, j) =>
      elementReferences(element, ['layoutMasters', i, 'fixedElements', j], refs)
    )
    rows(master?.placeholders).forEach((placeholder, j) => {
      if (!normalizePlaceholder(placeholder)) return
      const path = ['layoutMasters', i, 'placeholders', j]
      elementReferences(placeholder, path, refs)
      const defaults = placeholder.contentPolicy?.elementDefaults
      if (isObject(defaults))
        elementReferences(
          { ...defaults, type: placeholder.type },
          [...path, 'contentPolicy', 'elementDefaults'],
          refs
        )
    })
  })
  return refs
}

function rewriteReferences(source, refs, urlMap) {
  const clone = structuredClone(source)
  for (const ref of refs) {
    const mapped =
      urlMap instanceof Map
        ? urlMap.get(ref.url)
        : Object.hasOwn(urlMap || {}, ref.url)
          ? urlMap[ref.url]
          : undefined
    if (mapped === undefined) continue
    const wrongImageData =
      ref.kind === 'native' &&
      typeof mapped === 'string' &&
      /^data:/i.test(mapped.trim()) &&
      !/^data:image\//i.test(mapped.trim())
    if (typeof mapped !== 'string' || !isSafeMediaSrc(mapped) || wrongImageData)
      throw new Error(`Invalid replacement media URL at ${ref.path.join('.')}`)
    const parent = atPath(clone, ref.path.slice(0, -1))
    parent[ref.path[ref.path.length - 1]] = mapped
    if (ref.kind === 'background') {
      parent.image = mapped
      delete parent.src
    }
  }
  return clone
}
function rewriteGameMediaUrls(presentation, urlMap) {
  return rewriteReferences(presentation, collectGameMediaReferences(presentation), urlMap)
}
function rewriteNativeGameConfigMediaUrls(gameType, config, urlMap) {
  return rewriteReferences(config, collectNativeGameConfigMediaReferences(gameType, config), urlMap)
}
module.exports = {
  collectGameMediaReferences,
  rewriteGameMediaUrls,
  collectNativeGameConfigMediaReferences,
  rewriteNativeGameConfigMediaUrls,
}
