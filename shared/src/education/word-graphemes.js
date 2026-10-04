const segmenter = new Intl.Segmenter('vi-VN', { granularity: 'grapheme' })

function segmentGraphemes(value) {
  if (typeof value !== 'string') throw new TypeError('Expected text')
  return Array.from(segmenter.segment(value.normalize('NFC')), (part) => part.segment)
}

function normalizeWord(value, { min = 2, max = 20 } = {}) {
  if (typeof value !== 'string' || value.length > 256) {
    const error = new RangeError('Use text of at most 256 code units')
    error.code = 'PUZZLE_OVERSIZE'
    throw error
  }
  const text = value.trim().normalize('NFC').toLocaleUpperCase('vi-VN').normalize('NFC')
  const tokens = segmentGraphemes(text)
  if (tokens.length > max) {
    const error = new RangeError(`Use at most ${max} graphemes`)
    error.code = 'PUZZLE_OVERSIZE'
    throw error
  }
  if (tokens.length < min || tokens.some((token) => !/^\p{L}[\p{L}\p{M}]*$/u.test(token))) {
    const error = new TypeError(`Use ${min}..${max} letter graphemes without spaces or punctuation`)
    error.code = 'INVALID_WORD'
    throw error
  }
  return { text, tokens }
}

module.exports = { segmentGraphemes, normalizeWord }
