const MAX_TIMELINE_TICKS = 256

function boundedTicks(first, last, step, makeTick) {
  if (![first, last, step].every(Number.isFinite) || step === 0) return []
  const intervals = Math.floor((last - first) / step)
  if (intervals < 0) return []
  const stride = Math.max(1, Math.ceil(intervals / (MAX_TIMELINE_TICKS - 1)))
  const ticks = []
  for (let index = 0; index <= intervals; index += stride) {
    ticks.push(makeTick(first + index * step))
  }
  if (intervals % stride !== 0) ticks.push(makeTick(first + intervals * step))
  return ticks
}

function yearValue(value) {
  const year = Number(value)
  return String(value).trim() !== '' && Number.isSafeInteger(year) ? year : NaN
}

function parseDatePos(value, startDate, endDate, width, padding, yearMode) {
  const start = yearMode ? yearValue(startDate) : new Date(startDate).getTime()
  const end = yearMode ? yearValue(endDate) : new Date(endDate).getTime()
  const date = yearMode ? yearValue(value) : new Date(value).getTime()
  if (![start, end, date].every(Number.isFinite)) return padding
  return padding + ((date - start) / (end - start || 1)) * (width - padding * 2)
}

function automaticYearStep(start, end, availableWidth, fontSize) {
  const labelWidth =
    Math.max(8, fontSize) * (Math.max(String(start).length, String(end).length) + 1)
  const intervals = Math.max(1, Math.floor(availableWidth / labelWidth))
  const minimum = Math.max(1, Math.abs(end - start) / intervals)
  const power = 10 ** Math.floor(Math.log10(minimum))
  if (minimum <= power) return power
  if (minimum <= power * 2) return power * 2
  if (minimum <= power * 5) return power * 5
  return power * 10
}

function buildTicks(
  startDate,
  endDate,
  spacing,
  yearMode = true,
  availableWidth = 740,
  fontSize = 10
) {
  if (yearMode) {
    const start = yearValue(startDate)
    const end = yearValue(endDate)
    if (![start, end].every(Number.isFinite)) return []
    const step =
      spacing === '1000year'
        ? 1000
        : spacing === '100year'
          ? 100
          : spacing === '10year'
            ? 10
            : spacing === 'year'
              ? 1
              : automaticYearStep(start, end, availableWidth, fontSize)
    const direction = start <= end ? 1 : -1
    const first = direction > 0 ? Math.ceil(start / step) * step : Math.floor(start / step) * step
    return boundedTicks(first, end, direction * step, (year) => ({
      date: String(year),
      label: String(year),
    }))
  }

  const start = new Date(startDate)
  const end = new Date(endDate)
  if (![start.getTime(), end.getTime()].every(Number.isFinite) || start > end) return []
  if (spacing === 'day') {
    return boundedTicks(start.getTime(), end.getTime(), 86400000, (time) => {
      const date = new Date(time)
      return {
        date: date.toISOString().split('T')[0],
        label: `${date.getMonth() + 1}/${date.getDate()}`,
      }
    })
  }
  if (spacing === 'month') {
    const first = start.getFullYear() * 12 + start.getMonth()
    const last = end.getFullYear() * 12 + end.getMonth()
    return boundedTicks(first, last, 1, (month) => {
      const date = new Date(start)
      date.setFullYear(Math.floor(month / 12), ((month % 12) + 12) % 12, 1)
      return {
        date: date.toISOString().split('T')[0],
        label: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      }
    })
  }
  const step =
    spacing === 'year'
      ? 1
      : automaticYearStep(start.getFullYear(), end.getFullYear(), availableWidth, fontSize)
  return boundedTicks(start.getFullYear(), end.getFullYear(), step, (year) => ({
    date: `${year}-01-01`,
    label: String(year),
  }))
}

module.exports = { MAX_TIMELINE_TICKS, buildTicks, parseDatePos }
