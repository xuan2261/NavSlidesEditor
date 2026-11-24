// DrawingML automatic-number text only. Unsupported locale/pictographic schemes
// require their own source/font profile; never coerce them to decimal numbers.
function numberText(scheme, ordinal) {
  const match = /^(arabic|alphaLc|alphaUc|romanLc|romanUc)(Plain|Period|ParenR|ParenBoth)$/.exec(scheme)
  if (!match || !Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > 32767) return null
  let text = ''
  if (match[1] === 'arabic') text = String(ordinal)
  else if (match[1].startsWith('alpha')) {
    for (let n = ordinal; n > 0; n = Math.floor((n - 1) / 26))
      text = String.fromCharCode(97 + (n - 1) % 26) + text
  } else {
    if (ordinal > 3999) return null
    let n = ordinal
    for (const [value, letters] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
      [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']])
      while (n >= value) { text += letters; n -= value }
    text = text.toLowerCase()
  }
  if (match[1].endsWith('Uc')) text = text.toUpperCase()
  return match[2] === 'Period' ? `${text}.` : match[2] === 'ParenR' ? `${text})` :
    match[2] === 'ParenBoth' ? `(${text})` : text
}

function createBulletNumbering() {
  const levels = new Map()
  return (properties) => {
    const level = properties.level ?? 0, bullet = properties.bullet
    for (const key of levels.keys()) if (key > level) levels.delete(key)
    if (bullet?.kind !== 'number') { levels.delete(level); return null }
    const previous = levels.get(level)
    const ordinal = bullet.startAt ?? (previous?.scheme === bullet.scheme ? previous.ordinal + 1 : 1)
    levels.set(level, { ordinal, scheme: bullet.scheme })
    return numberText(bullet.scheme, ordinal)
  }
}
module.exports = { createBulletNumbering }
