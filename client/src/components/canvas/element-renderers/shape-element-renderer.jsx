export function ShapeRenderer({ element }) {
  const w = element.width,
    h = element.height
  const fill = element.fill || '#6366f1'
  const stroke = element.stroke || 'none'
  const sw = element.strokeWidth || 0
  const shape = element.shape || 'rect'

  const renderShape = () => {
    if (shape === 'line') {
      const lw = element.strokeWidth || 3
      return (
        <line
          x1={lw}
          y1={h / 2}
          x2={w - lw}
          y2={h / 2}
          stroke={fill}
          strokeWidth={lw}
          fill="none"
        />
      )
    }
    const gProps = { fill, stroke, strokeWidth: sw }
    switch (shape) {
      case 'rect':
        return (
          <g {...gProps}>
            <rect
              x={sw / 2}
              y={sw / 2}
              width={w - sw}
              height={h - sw}
              rx={element.borderRadius || 0}
            />
          </g>
        )
      case 'rounded-rect':
        return (
          <g {...gProps}>
            <rect x={sw / 2} y={sw / 2} width={w - sw} height={h - sw} rx={Math.min(w, h) * 0.15} />
          </g>
        )
      case 'circle':
        return (
          <g {...gProps}>
            <ellipse
              cx={w / 2}
              cy={h / 2}
              rx={Math.max(0, w / 2 - sw / 2)}
              ry={Math.max(0, h / 2 - sw / 2)}
            />
          </g>
        )
      case 'triangle':
        return (
          <g {...gProps}>
            <polygon points={`${w / 2},${sw} ${w - sw},${h - sw} ${sw},${h - sw}`} />
          </g>
        )
      case 'diamond':
        return (
          <g {...gProps}>
            <polygon
              points={`${w / 2},${sw} ${w - sw},${h / 2} ${w / 2},${h - sw} ${sw},${h / 2}`}
            />
          </g>
        )
      case 'arrow-right':
        return (
          <g {...gProps}>
            <polygon
              points={`${sw},${h * 0.35} ${w * 0.6},${h * 0.35} ${w * 0.6},${sw} ${w - sw},${h / 2} ${w * 0.6},${h - sw} ${w * 0.6},${h * 0.65} ${sw},${h * 0.65}`}
            />
          </g>
        )
      case 'star': {
        const cx = w / 2,
          cy = h / 2,
          outerR = Math.min(w, h) / 2 - sw,
          innerR = outerR * 0.4
        const pts = []
        for (let i = 0; i < 10; i++) {
          const a = (Math.PI / 5) * i - Math.PI / 2
          const r = i % 2 === 0 ? outerR : innerR
          pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`)
        }
        return (
          <g {...gProps}>
            <polygon points={pts.join(' ')} />
          </g>
        )
      }
      default:
        return (
          <g {...gProps}>
            <rect x={sw / 2} y={sw / 2} width={w - sw} height={h - sw} />
          </g>
        )
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: element.opacity || 1 }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        {renderShape()}
        {element.text && (
          <text
            x={w / 2}
            y={h / 2}
            dominantBaseline="middle"
            textAnchor="middle"
            fontSize={element.fontSize || 16}
            fill={element.textColor || '#ffffff'}
          >
            {element.text}
          </text>
        )}
      </svg>
    </div>
  )
}
