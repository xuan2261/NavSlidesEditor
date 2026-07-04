import { resolveColorField } from 'revealjs-shared'

export const ARROWHEAD_MARKERS = {
  arrow: (id, color) => (
    <marker
      key={id}
      id={id}
      markerWidth="10"
      markerHeight="7"
      refX="9"
      refY="3.5"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <polygon points="0 0, 10 3.5, 0 7" fill={color} />
    </marker>
  ),
  diamond: (id, color) => (
    <marker
      key={id}
      id={id}
      markerWidth="10"
      markerHeight="10"
      refX="5"
      refY="5"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <polygon points="5 0, 10 5, 5 10, 0 5" fill={color} />
    </marker>
  ),
  circle: (id, color) => (
    <marker
      key={id}
      id={id}
      markerWidth="8"
      markerHeight="8"
      refX="4"
      refY="4"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <circle cx="4" cy="4" r="3" fill={color} />
    </marker>
  ),
  square: (id, color) => (
    <marker
      key={id}
      id={id}
      markerWidth="8"
      markerHeight="8"
      refX="4"
      refY="4"
      orient="auto"
      markerUnits="strokeWidth"
    >
      <rect x="1" y="1" width="6" height="6" fill={color} />
    </marker>
  ),
}

export function getLineMarkerUid(id) {
  const str = String(id == null ? 'line' : id)
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return `l${h.toString(36)}`
}

export function LineArrowRenderer({ element }) {
  const w = element.width,
    h = element.height
  const x1 = element.x1 ?? 0,
    y1 = element.y1 ?? h / 2
  const x2 = element.x2 ?? w,
    y2 = element.y2 ?? h / 2
  const cx = element.cx,
    cy = element.cy
  const color = resolveColorField(element.stroke, 'line', 'stroke') || '#ffffff'
  const sw = element.strokeWidth || 2
  const dash = element.dashArray || ''
  const startType = element.arrowStart || 'none'
  const endType = element.arrowEnd || 'none'
  const uid = getLineMarkerUid(element.id)

  const markers = []
  let markerStart = undefined,
    markerEnd = undefined
  if (startType !== 'none' && ARROWHEAD_MARKERS[startType]) {
    const sid = `ms-${uid}`
    markers.push(ARROWHEAD_MARKERS[startType](sid, color))
    markerStart = `url(#${sid})`
  }
  if (endType !== 'none' && ARROWHEAD_MARKERS[endType]) {
    const eid = `me-${uid}`
    markers.push(ARROWHEAD_MARKERS[endType](eid, color))
    markerEnd = `url(#${eid})`
  }

  const pathD =
    cx != null && cy != null
      ? `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`
      : `M ${x1} ${y1} L ${x2} ${y2}`

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        <defs>{markers}</defs>
        <path
          d={pathD}
          stroke={color}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={dash}
          markerStart={markerStart}
          markerEnd={markerEnd}
          style={{ pointerEvents: 'stroke' }}
        />
        <path
          d={pathD}
          stroke="transparent"
          strokeWidth={Math.max(sw + 10, 12)}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={dash}
          style={{ pointerEvents: 'stroke' }}
          data-line-hit-target="true"
        />
      </svg>
    </div>
  )
}
