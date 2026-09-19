import React from 'react'
import { LoadingFallback, getNamePickerInteractiveP } from './shared.jsx'
export function WheelRenderer({ element }) {
  const colors = element.wheelColors && element.wheelColors.length > 0
    ? element.wheelColors
    : ['#FF5722', '#2196F3', '#4CAF50', '#FFC107', '#9C27B0', '#00BCD4', '#FF9800', '#795548']
  const segments = element.wheelSegments || 8
  const items = element.items || []
  const svgR = 70
  const cx = 90
  const cy = 90
  const radPerSeg = (2 * Math.PI) / segments
  const pointerH = 18

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%', height: '100%' }}>
      <svg width="180" height="196" viewBox="0 0 180 196" style={{ overflow: 'visible' }}>
        {/* Wheel body */}
        <circle cx={cx} cy={cy} r={svgR} fill="none" stroke={element.accentColor || '#6366f1'} strokeWidth="2" />
        {/* Segments */}
        {Array.from({ length: segments }).map((_, i) => {
          const startAngle = i * radPerSeg - Math.PI / 2
          const endAngle = startAngle + radPerSeg
          const x1 = cx + svgR * Math.cos(startAngle)
          const y1 = cy + svgR * Math.sin(startAngle)
          const x2 = cx + svgR * Math.cos(endAngle)
          const y2 = cy + svgR * Math.sin(endAngle)
          const fill = colors[i % colors.length]
          return (
            <path
              key={i}
              d={`M${cx},${cy} L${x1},${y1} A${svgR},${svgR} 0 0,1 ${x2},${y2} Z`}
              fill={fill}
              opacity="0.85"
            />
          )
        })}
        <circle cx={cx} cy={cy} r="14" fill={element.backgroundColor || '#1a1a2e'} />
        <circle cx={cx} cy={cy} r="14" fill="none" stroke={element.accentColor || '#6366f1'} strokeWidth="2" />
        {/* Pointer triangle */}
        <polygon
          points={`${cx},${cy - svgR - 2} ${cx - 7},${cy - svgR + pointerH} ${cx + 7},${cy - svgR + pointerH}`}
          fill={element.accentColor || '#6366f1'}
        />
        {/* Items label on wheel (show first 3 as text) */}
        {items.slice(0, 3).map((item, i) => {
          const angle = (i * 2 * Math.PI) / Math.min(items.length, 3) - Math.PI / 2
          const tx = cx + (svgR * 0.55) * Math.cos(angle)
          const ty = cy + (svgR * 0.55) * Math.sin(angle)
          return (
            <text
              key={i}
              x={tx}
              y={ty}
              fill="white"
              fontSize="8"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontFamily: 'sans-serif', fontWeight: 'bold', pointerEvents: 'none' }}
            >
              {String(item).slice(0, 6)}
            </text>
          )
        })}
      </svg>
      {items.length > 0 && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', maxWidth: 160, textAlign: 'center' }}>
          {items.length} items — {items.slice(0, 2).join(', ')}{items.length > 2 ? '…' : ''}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dice renderer (name-picker dice mode)
// ---------------------------------------------------------------------------
export function DiceRenderer({ element }) {
  const diceCount = element.diceCount || 2
  const _face = 6
  const diceSize = 28
  const gap = 8

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', gap, alignItems: 'center' }}>
        {Array.from({ length: diceCount }).map((_, i) => (
          <svg key={i} width={diceSize} height={diceSize} viewBox="0 0 28 28">
            <rect x="1" y="1" width="26" height="26" rx="4" fill={element.accentColor || '#6366f1'} />
            {/* Pip pattern for 5 */}
            <circle cx="7" cy="7" r="2.5" fill="white" />
            <circle cx="14" cy="14" r="2.5" fill="white" />
            <circle cx="21" cy="21" r="2.5" fill="white" />
            <circle cx="21" cy="7" r="2.5" fill="white" />
            <circle cx="7" cy="21" r="2.5" fill="white" />
          </svg>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
        {diceCount} Dice — {element.pickerMode || 'dice'} mode
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Name Picker renderer
// ---------------------------------------------------------------------------
export function NamePickerRenderer({ element, _isPresenting }) {
  const mode = element.pickerMode || 'wheel'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: '100%' }}>
      {mode === 'wheel' && <WheelRenderer element={element} />}
      {mode === 'dice' && <DiceRenderer element={element} />}
      {mode === 'button' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 32, color: element.accentColor || '#6366f1' }}>
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="30" fill={element.accentColor || '#6366f1'} opacity="0.2" />
              <circle cx="32" cy="32" r="22" fill={element.accentColor || '#6366f1'} opacity="0.4" />
              <circle cx="32" cy="32" r="14" fill={element.accentColor || '#6366f1'} />
              <text x="32" y="38" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold" style={{ fontFamily: 'sans-serif' }}>
                {element.items && element.items.length > 0 ? '?' : '!'}
              </text>
            </svg>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
            Button — {element.items ? `${element.items.length} choices` : 'no items'}
          </div>
        </div>
      )}
    </div>
  )
}


// Lazy wrapper for name-picker interactive mode
export function NamePickerInteractiveWrapper({ element, isPresenting }) {
  const [I, setI] = React.useState(null)
  React.useEffect(() => {
    getNamePickerInteractiveP().then(setI)
  }, [])
  if (!I) return <LoadingFallback />
  return <I element={element} isPresenting={isPresenting} />
}
