const DEFAULT_TIMELINE_DATE = '2000-01-01'

function validTimestamp(value) {
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

export function getSafeMidpointDate(startDate, endDate) {
  const start = validTimestamp(startDate)
  const end = validTimestamp(endDate)
  const timestamp =
    start !== null && end !== null
      ? start + (end - start) / 2
      : start ?? end
  if (timestamp === null) return DEFAULT_TIMELINE_DATE
  return new Date(timestamp).toISOString().split('T')[0]
}
