import { useState } from 'react'

function parseDatePos(d, startDate, endDate, w, pad, yearMode) {
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

function buildTicks(startDate, endDate, spacing, w, pad, yearMode) {
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

function getTimelineRange(element) {
  return {
    startDate: element.timelineStart ?? element.startDate ?? '2000',
    endDate: element.timelineEnd ?? element.endDate ?? '2025',
  }
}

function getTimelineItems(element) {
  return (element.events || element.items || []).map((item) => ({
    ...item,
    label: item.title ?? item.label ?? '',
    image: item.imageUrl ?? item.image ?? '',
    detailedDescription: item.detailedDescription ?? item.details ?? '',
    connectorLength: item.connectorLength ?? item.connectorOffset ?? element.connectorOffset ?? 0,
  }))
}

export default function TimelineElement({ element }) {
  const [expandedId, setExpandedId] = useState(null)
  const w = element.width || 800
  const h = element.height || 400
  const spacing = element.tickSpacing || 'auto'
  const { startDate, endDate } = getTimelineRange(element)
  const yearMode = ['year', '10year', '100year', '1000year'].includes(spacing) ||
    (spacing === 'auto' && /^-?\d+$/.test(String(startDate)))
  const lineY = h * 0.5
  const pad = 30
  const lineColor = element.lineColor || '#6366f1'
  const dotColor = element.dotColor || lineColor
  const textColor = element.textColor || '#fff'
  const fs = element.fontSize || 11
  const items = getTimelineItems(element)

  const ticks = buildTicks(startDate, endDate, spacing, w, pad, yearMode)
  const datePos = (d) => parseDatePos(d, startDate, endDate, w, pad, yearMode)
  const itemDateLabel = (d) => (yearMode ? String(parseInt(d) || d) : d)
  const expandedItem = expandedId ? items.find((i) => i.id === expandedId) : null

  return (
    <div style={{ position: 'relative', width: w, height: h }}>
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ display: 'block', overflow: 'visible' }}
        data-testid="timeline-svg"
      >
        <line
          data-testid="timeline-line"
          x1={pad}
          y1={lineY}
          x2={w - pad}
          y2={lineY}
          stroke={lineColor}
          strokeWidth={2}
        />
        {ticks.map((t, i) => {
          const x = datePos(t.date)
          return (
            <g key={i}>
              <line x1={x} y1={lineY - 4} x2={x} y2={lineY + 4} stroke={lineColor} strokeWidth={1.5} />
              <text
                x={x}
                y={lineY + 14}
                textAnchor="end"
                fill={textColor}
                fontSize={fs - 1}
                opacity={0.5}
                transform={`rotate(-45,${x},${lineY + 14})`}
              >
                {t.label}
              </text>
            </g>
          )
        })}
        {items.map((item) => {
          const x = datePos(item.date)
          const isTop = item.side !== 'bottom'
          const cl = item.connectorLength ?? 0
          const cardY = isTop ? 8 - cl : lineY + 28 + cl
          const cardH = isTop ? lineY - 36 : h - lineY - 36
          const connY1 = isTop ? cardY + cardH : lineY
          const connY2 = isTop ? lineY : cardY
          const imgH = item.image ? Math.min(cardH * 0.55, 60) : 0
          const isExpanded = expandedId === item.id
          return (
            <g
              key={item.id}
              style={{ cursor: item.image || item.detailedDescription ? 'pointer' : 'default' }}
              onClick={(e) => {
                if (item.image || item.detailedDescription) {
                  e.stopPropagation()
                  setExpandedId(isExpanded ? null : item.id)
                }
              }}
            >
              <line
                x1={x}
                y1={connY1}
                x2={x}
                y2={connY2}
                stroke={lineColor}
                strokeWidth={1}
                strokeDasharray="3,2"
                opacity={0.5}
              />
              <circle
                cx={x}
                cy={lineY}
                r={isExpanded ? 6 : 4}
                fill={dotColor}
                stroke={isExpanded ? textColor : 'none'}
                strokeWidth={1.5}
              />
              {isTop ? (
                <>
                  {(() => {
                    let ty = cardY + fs
                    const elems = []
                    elems.push(
                      <text key="l" x={x} y={ty} textAnchor="middle" fill={textColor} fontSize={fs} fontWeight={600}>
                        {item.label}
                      </text>
                    )
                    ty += fs + 2
                    if (item.description) {
                      elems.push(
                        <text key="d" x={x} y={ty} textAnchor="middle" fill={textColor} fontSize={fs - 1} opacity={0.6}>
                          {item.description}
                        </text>
                      )
                      ty += fs
                    }
                    elems.push(
                      <text key="dt" x={x} y={ty} textAnchor="middle" fill={textColor} fontSize={fs - 2} opacity={0.35}>
                        {itemDateLabel(item.date)}
                      </text>
                    )
                    ty += 4
                    return (
                      <>
                        {elems}
                        {item.image && (
                          <image
                            href={item.image}
                            x={x - 40}
                            y={ty}
                            width={80}
                            height={imgH}
                            preserveAspectRatio="xMidYMid meet"
                          />
                        )}
                      </>
                    )
                  })()}
                </>
              ) : (
                <>
                  {item.image && (
                    <image
                      href={item.image}
                      x={x - 40}
                      y={cardY}
                      width={80}
                      height={imgH}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  )}
                  <text x={x} y={cardY + imgH + fs + 2} textAnchor="middle" fill={textColor} fontSize={fs} fontWeight={600}>
                    {item.label}
                  </text>
                  {item.description && (
                    <text x={x} y={cardY + imgH + fs * 2 + 4} textAnchor="middle" fill={textColor} fontSize={fs - 1} opacity={0.6}>
                      {item.description}
                    </text>
                  )}
                  <text
                    x={x}
                    y={cardY + imgH + fs * (item.description ? 3 : 2) + 6}
                    textAnchor="middle"
                    fill={textColor}
                    fontSize={fs - 2}
                    opacity={0.35}
                  >
                    {itemDateLabel(item.date)}
                  </text>
                </>
              )}
            </g>
          )
        })}
      </svg>
      {expandedItem && (expandedItem.image || expandedItem.detailedDescription) && (
        <div
          data-testid="timeline-expanded"
          onClick={(e) => {
            e.stopPropagation()
            setExpandedId(null)
          }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            padding: 16,
            cursor: 'pointer',
            zIndex: 10,
          }}
        >
          {expandedItem.image && (
            <img
              src={expandedItem.image}
              alt={expandedItem.label}
              style={{
                maxWidth: expandedItem.detailedDescription ? '45%' : '80%',
                maxHeight: '85%',
                objectFit: 'contain',
                borderRadius: 6,
                flexShrink: 0,
              }}
            />
          )}
          <div
            style={{
              flex: expandedItem.image ? 1 : undefined,
              maxWidth: expandedItem.image ? '45%' : '80%',
              overflow: 'auto',
              maxHeight: '85%',
            }}
          >
            <div style={{ color: textColor, fontWeight: 700, fontSize: fs + 4, marginBottom: 4 }}>
              {expandedItem.label}
            </div>
            <div style={{ color: textColor, opacity: 0.5, fontSize: fs - 1, marginBottom: 8 }}>
              {itemDateLabel(expandedItem.date)}
            </div>
            {expandedItem.description && (
              <div style={{ color: textColor, opacity: 0.7, fontSize: fs, marginBottom: 8 }}>
                {expandedItem.description}
              </div>
            )}
            {expandedItem.detailedDescription && (
              <div style={{ color: textColor, opacity: 0.85, fontSize: fs + 1, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {expandedItem.detailedDescription}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
