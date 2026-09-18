import { JEOPARDY_POINTS } from './jeopardy-shared.js'
export function JeopardyBoard({ element, usedCells, ddKeys, onCellClick }) {
  const cats = element.categories || []
  const accent = element.accentColor || '#f59e0b'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      flex: 1,
      minHeight: 0,
      overflow: 'hidden',
    }}>
      {/* Category header row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 3,
        marginBottom: 3,
        flexShrink: 0,
      }}>
        {JEOPARDY_POINTS.map((pts, i) => {
          const cat = cats[i]
          const catName = cat ? (cat.name || String(cat)) : `Category ${i + 1}`
          return (
            <div key={pts} style={{
              background: accent,
              borderRadius: 4,
              padding: '4px 2px',
              textAlign: 'center',
              fontSize: 9,
              fontWeight: 'bold',
              color: '#1a1a2e',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minHeight: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {catName}
            </div>
          )
        })}
      </div>

      {/* Point value rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minHeight: 0, overflow: 'auto' }}>
        {JEOPARDY_POINTS.map(pts => (
          <div key={pts} style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 3,
            flex: 1,
          }}>
            {JEOPARDY_POINTS.map((_, catIdx) => {
              const key = `${catIdx}-${pts}`
              const used = !!usedCells?.[key]
              const isDD = ddKeys?.has(key)
              const interactive = !!onCellClick
              const category = cats[catIdx]
              const categoryName = category ? (category.name || String(category)) : `Category ${catIdx + 1}`
              const cellStyle = {
                position: 'relative',
                background: used
                  ? 'rgba(0,0,0,0.4)'
                  : isDD
                    ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                    : `${accent}22`,
                border: isDD ? '2px solid #fbbf24' : `1px solid ${accent}55`,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 'bold',
                fontFamily: 'inherit',
                padding: 0,
                color: used ? 'rgba(255,255,255,0.3)' : isDD ? '#1a1a2e' : accent,
                cursor: interactive && !used ? 'pointer' : 'default',
                minHeight: 28,
                flex: 1,
                transition: 'background 0.2s',
                userSelect: 'none',
                boxSizing: 'border-box',
              }
              const content = used
                ? <span style={{ fontSize: 10 }}>✓</span>
                : <span>{pts}</span>

              if (interactive) {
                return (
                  <button
                    type="button"
                    key={key}
                    disabled={used}
                    onClick={() => onCellClick(catIdx, pts)}
                    aria-label={`${categoryName}, ${pts} points${isDD ? ', Daily Double' : ''}${used ? ', used' : ''}`}
                    aria-pressed={used}
                    style={cellStyle}
                  >
                    {content}
                  </button>
                )
              }
              return <div key={key} style={cellStyle}>{content}</div>
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
