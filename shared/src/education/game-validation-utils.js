const { isSafeMediaSrc } = require('../content-safety.js')
const isObject = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const isColor = (value) =>
  typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)
function createValidation() {
  const errors = []
  const add = (path, message) => errors.push({ path, message })
  const text = (value, path, empty = false, max = 10000) => {
    if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max)
      add(path, `Enter ${empty ? 'text' : 'nonempty text'} of at most ${max} characters`)
  }
  const number = (value, path, min, max, integer = false) => {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isInteger(value))
    )
      add(path, `Use a finite ${integer ? 'integer' : 'number'} from ${min} to ${max}`)
  }
  const list = (value, path, min = 0, max = 1000) => {
    if (!Array.isArray(value)) {
      add(path, 'Use an array; malformed authored content cannot be discarded')
      return []
    }
    if (value.length < min || value.length > max) add(path, `Use between ${min} and ${max} entries`)
    return value
  }
  const object = (value, path) => {
    if (!isObject(value)) {
      add(path, 'Use an object')
      return false
    }
    return true
  }
  const unique = (rows, path, key = 'id') => {
    const seen = new Set()
    rows.forEach((row, i) => {
      if (!object(row, [...path, i])) return
      text(row[key], [...path, i, key], false, 256)
      if (seen.has(row[key])) add([...path, i, key], `Duplicate ${key}; assign a unique stable ID`)
      seen.add(row[key])
    })
    return seen
  }
  const media = (value, path) => {
    if (!object(value, path)) return
    if (typeof value.src !== 'string' || !isSafeMediaSrc(value.src))
      add([...path, 'src'], 'Use a safe media URL')
    text(value.alt, [...path, 'alt'])
  }
  const content = (value, path) => {
    if (!object(value, path)) return
    if (value.type === 'text') text(value.text, [...path, 'text'])
    else if (value.type === 'image') media(value, path)
    else add([...path, 'type'], 'Choose text or image content')
  }
  const choice = (value, path, choices) => {
    if (!choices.includes(value)) add(path, `Choose one of: ${choices.join(', ')}`)
  }
  const boolean = (value, path) => {
    if (typeof value !== 'boolean') add(path, 'Use a boolean')
  }
  return { errors, add, text, number, list, object, unique, media, content, choice, boolean }
}
function throwInvalid(errors, context = 'Game configuration') {
  if (!errors.length) return
  const error = new Error(
    `${context}: ${errors.map((item) => `${item.path.join('.') || 'config'}: ${item.message}`).join('; ')}`
  )
  error.errors = errors
  throw error
}
module.exports = { createValidation, throwInvalid, isObject, isColor }
