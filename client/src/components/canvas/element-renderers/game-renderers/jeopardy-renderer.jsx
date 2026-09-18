import { buildQuestionLookup, getDailyDoubleKeys } from './jeopardy-shared.js'
import { JeopardyBoard } from './jeopardy-board.jsx'
import { InteractiveJeopardyBoard } from './jeopardy-interactive-board.jsx'
export function JeopardyRenderer({ element, isPresenting }) {
  const categories = element.categories || []

  // Edit mode: full 5x5 static board preview
  if (!isPresenting) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', height: '100%', overflow: 'hidden' }}>
        <div style={{ fontSize: 28, lineHeight: 1, marginBottom: 2 }}>🏆</div>
        <div style={{ fontSize: 12, fontWeight: 'bold', color: element.accentColor || '#f59e0b', marginBottom: 4 }}>{element.title || 'Jeopardy'}</div>
        <JeopardyBoard
          element={element}
          usedCells={{}}
          qLookup={buildQuestionLookup(element)}
          ddKeys={getDailyDoubleKeys(element)}
          onCellClick={null}
        />
        {categories.length === 0 && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', marginTop: 4 }}>
            Configure categories and questions in properties panel
          </div>
        )}
      </div>
    )
  }

  // Presentation mode: full interactive board
  return <InteractiveJeopardyBoard element={element} />
}
