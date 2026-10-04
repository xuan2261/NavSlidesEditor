import { getBoardPoints } from './jeopardy-shared.js'
export function JeopardyBoard({ element, usedCells, ddKeys, onCellClick }) {
  const cats = element.categories || []
  const accent = element.accentColor || '#f59e0b'
  const points = getBoardPoints(element)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Category header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.max(1, cats.length)}, 1fr)`,
          gap: 3,
          marginBottom: 3,
          flexShrink: 0,
        }}
      >
        {cats.map((cat) => {
          const catName = cat.title
          return (
            <div
              key={cat.id}
              style={{
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
              }}
            >
              {catName}
            </div>
          )
        })}
      </div>

      {/* Point value rows */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
        }}
      >
        {points.map((pts) => (
          <div
            key={pts}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.max(1, cats.length)}, 1fr)`,
              gap: 3,
              flex: 1,
            }}
          >
            {cats.map((category) => {
              const question = category.questions.find((candidate) => candidate.points === pts)
              const key = question?.id
              const used = !!usedCells?.[key]
              const isDD = ddKeys?.has(key)
              const interactive = !!onCellClick && !!question
              const categoryName = category.title
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
              const content = used ? <span style={{ fontSize: 10 }}>✓</span> : <span>{pts}</span>

              if (interactive) {
                return (
                  <button
                    type="button"
                    key={key}
                    disabled={used}
                    onClick={() => onCellClick(category.id, question.id)}
                    aria-label={`${categoryName}, ${pts} points${isDD ? ', Daily Double' : ''}${used ? ', used' : ''}`}
                    aria-pressed={used}
                    style={cellStyle}
                  >
                    {content}
                  </button>
                )
              }
              return (
                <div key={question?.id || `${category.id}-empty-${pts}`} style={cellStyle}>
                  {question ? content : null}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
