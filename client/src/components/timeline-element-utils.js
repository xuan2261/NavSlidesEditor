export function parseDatePos(d, startDate, endDate, w, pad, yearMode) {
  if (yearMode) {
    const y0 = parseInt(startDate) || 0
    const y1 = parseInt(endDate) || 0
    const yr = y1 - y0 || 1
    return pad + (((parseInt(d) || 0) - y0) / yr) * (w - pad * 2)
  }
  const t0 = new Date(startDate).getTime()
  const t1 = new Date(endDate).getTime()
  const range = t1 - t0 || 1
  return pad + ((new Date(d).getTime() - t0) / range) * (w - pad * 2)
}

export function buildTicks(startDate, endDate, spacing, yearMode = true) {
  const ticks = []
  if (yearMode) {
    const y0 = parseInt(startDate) || 0
    const y1 = parseInt(endDate) || 0
    const step =
      spacing === '1000year' ? 1000
      : spacing === '100year' ? 100
      : spacing === '10year' ? 10
      : Math.abs(y1 - y0) > 8 ? 2 : 1
    const sY = y0 < y1 ? Math.ceil(y0 / step) * step : Math.floor(y0 / step) * step
    for (let y = sY; y0 < y1 ? y <= y1 : y >= y1; y += y0 < y1 ? step : -step) {
      ticks.push({ date: String(y), label: String(y) })
    }
    return ticks
  }

  const d0 = new Date(startDate)
  const d1 = new Date(endDate)
  if (spacing === 'day') {
    const step = 86400000
    for (let t = d0.getTime(); t <= d1.getTime(); t += step) {
      const d = new Date(t)
      ticks.push({ date: d.toISOString().split('T')[0], label: `${d.getMonth() + 1}/${d.getDate()}` })
    }
  } else if (spacing === 'month') {
    for (let d = new Date(d0.getFullYear(), d0.getMonth(), 1); d <= d1; d.setMonth(d.getMonth() + 1)) {
      ticks.push({
        date: d.toISOString().split('T')[0],
        label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      })
    }
  } else {
    const t0 = d0.getTime()
    const t1 = d1.getTime()
    const yearSpan = (t1 - t0) / (365.25 * 24 * 3600000)
    const step = yearSpan > 8 ? 2 : 1
    for (let y = d0.getFullYear(); y <= d1.getFullYear(); y += step) {
      ticks.push({ date: `${y}-01-01`, label: String(y) })
    }
  }
  return ticks
}

export function getTimelineRange(element) {
  return {
    startDate: element.timelineStart ?? element.startDate ?? '2000',
    endDate: element.timelineEnd ?? element.endDate ?? '2025',
  }
}

export function getTimelineItems(element) {
  return (element.events || element.items || []).map((item) => ({
    ...item,
    label: item.title ?? item.label ?? '',
    image: item.imageUrl ?? item.image ?? '',
    detailedDescription: item.detailedDescription ?? item.details ?? '',
    connectorLength: item.connectorLength ?? item.connectorOffset ?? element.connectorOffset ?? 0,
  }))
}
