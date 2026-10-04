const COMMAND_SIZE = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 }
const PATH_TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g
const PAINT =
  /^(?:#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})|[a-z]+|rgba?\([\d.,%\s]+\)|hsla?\([\d.,%\s]+\)|var\(--ns-[a-z0-9-]+\))$/i

function validatePathData(data) {
  if (typeof data !== 'string' || !data.trim() || data.length > 20000) {
    throw new Error('Each path needs a non-empty SVG d string of at most 20,000 characters.')
  }
  const tokens = data.match(PATH_TOKEN) || []
  if (data.replace(PATH_TOKEN, '').replace(/[\s,]/g, '') || !/^[Mm]$/.test(tokens[0])) {
    throw new Error(
      'SVG path data must start with M or m and contain only path commands and numbers.'
    )
  }
  let end = 0
  let previous = null
  for (const match of data.matchAll(PATH_TOKEN)) {
    const separator = data.slice(end, match.index)
    if (
      !/^\s*,?\s*$/.test(separator) ||
      (separator.includes(',') &&
        (!previous || /^[a-z]$/i.test(previous) || /^[a-z]$/i.test(match[0])))
    ) {
      throw new Error(
        'Path coordinates need valid SVG separators; use spaces or single commas between numbers.'
      )
    }
    previous = match[0]
    end = match.index + match[0].length
  }
  if (data.slice(end).trim()) throw new Error('Remove the trailing separator from the SVG path.')
  let index = 0
  while (index < tokens.length) {
    const command = tokens[index++].toUpperCase()
    const size = COMMAND_SIZE[command]
    if (size === undefined)
      throw new Error('An SVG path command is missing before its coordinates.')
    const start = index
    while (index < tokens.length && !/^[a-z]$/i.test(tokens[index])) index++
    const values = tokens.slice(start, index).map(Number)
    if (size === 0 ? values.length !== 0 : values.length === 0 || values.length % size !== 0) {
      throw new Error(`Path command ${command} needs ${size} coordinates per segment.`)
    }
    if (!values.every(Number.isFinite)) throw new Error('Path coordinates must be finite numbers.')
    if (command === 'A') {
      for (let offset = 0; offset < values.length; offset += size) {
        if (
          values[offset] < 0 ||
          values[offset + 1] < 0 ||
          ![0, 1].includes(values[offset + 3]) ||
          ![0, 1].includes(values[offset + 4])
        ) {
          throw new Error('Arc paths need non-negative radii and flags of 0 or 1.')
        }
      }
    }
  }
}

/** Parse only the persisted drawing path records; no SVG markup or executable input. */
export function parseDrawingPathsDraft(draft) {
  if (draft.length > 1000000)
    throw new Error('Drawing path JSON must be at most 1,000,000 characters.')
  let paths
  try {
    paths = JSON.parse(draft)
  } catch {
    throw new Error('Enter a JSON array of paths, for example [{"d":"M0 0 L100 100"}].')
  }
  if (!Array.isArray(paths) || paths.length > 1000)
    throw new Error('Enter a JSON array containing at most 1,000 paths.')
  for (let index = 0; index < paths.length; index++) {
    const path = paths[index]
    try {
      if (!path || typeof path !== 'object' || Array.isArray(path))
        throw new Error('Each path must be a JSON object.')
      if (
        Object.keys(path).some((key) => !['d', 'stroke', 'strokeWidth', 'opacity'].includes(key))
      ) {
        throw new Error('Path fields are d, stroke, strokeWidth and opacity only.')
      }
      validatePathData(path.d)
      if (
        path.stroke != null &&
        (typeof path.stroke !== 'string' || !PAINT.test(path.stroke.trim()))
      ) {
        throw new Error('Path stroke must be a color, not a URL or SVG markup.')
      }
      if (path.stroke != null && path.stroke.trim().toLowerCase() !== 'none') {
        const style = document.createElement('span').style
        style.color = path.stroke
        if (!style.color) throw new Error('Path stroke must be a valid CSS color, or none.')
      }
      if (
        path.strokeWidth != null &&
        (typeof path.strokeWidth !== 'number' ||
          !Number.isFinite(path.strokeWidth) ||
          path.strokeWidth < 0)
      ) {
        throw new Error('Path strokeWidth must be a finite non-negative number.')
      }
      if (
        path.opacity != null &&
        (typeof path.opacity !== 'number' ||
          !Number.isFinite(path.opacity) ||
          path.opacity < 0 ||
          path.opacity > 1)
      ) {
        throw new Error('Path opacity must be a number between 0 and 1.')
      }
    } catch (error) {
      throw new Error(`Path ${index + 1}: ${error.message}`)
    }
  }
  return paths
}
