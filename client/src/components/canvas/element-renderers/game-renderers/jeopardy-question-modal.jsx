
export function JeopardyQuestionModal({ question, pts, isDailyDouble, showAnswer, timeLeft, onReveal, onCorrect, onWrong, onClose, accentColor }) {
  const flipStyle = {
    perspective: '800px',
    width: '100%',
    maxWidth: 480,
    height: 260,
    cursor: 'pointer',
    position: 'relative',
  }
  const cardStyle = {
    position: 'relative',
    width: '100%',
    height: '100%',
    transformStyle: 'preserve-3d',
    transition: 'transform 0.6s',
    transform: showAnswer ? 'rotateY(180deg)' : 'rotateY(0deg)',
  }
  const faceStyle = {
    position: 'absolute',
    inset: 0,
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    boxSizing: 'border-box',
    gap: 12,
  }
  const frontStyle = {
    ...faceStyle,
    background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)`,
    border: `2px solid ${accentColor}`,
  }
  const backStyle = {
    ...faceStyle,
    background: `linear-gradient(135deg, #1a2e1a 0%, #162116 100%)`,
    border: '2px solid #22c55e',
    transform: 'rotateY(180deg)',
  }
  const questionText = question?.question || 'No question configured'
  const answerText = question?.answer || question?.correctIndex != null
    ? String(question.options?.[question.correctIndex] || 'Answer')
    : (question?.answer || 'No answer')

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      zIndex: 9999,
      padding: 16,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%', maxWidth: 500 }}>
        <button
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: 'white', padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}
        >
          ✕
        </button>
        <div style={{
          flex: 1,
          background: isDailyDouble ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' : accentColor,
          borderRadius: 6,
          padding: '4px 12px',
          textAlign: 'center',
          fontWeight: 'bold',
          color: isDailyDouble ? '#1a1a2e' : '#fff',
          fontSize: 13,
        }}>
          {isDailyDouble ? 'DAILY DOUBLE!' : `${pts} Points`}
        </div>
        {timeLeft != null && (
          <div style={{
            background: timeLeft <= 5 ? '#ef4444' : 'rgba(255,255,255,0.1)',
            borderRadius: 6,
            padding: '4px 12px',
            color: timeLeft <= 5 ? 'white' : 'rgba(255,255,255,0.7)',
            fontSize: 12,
            fontWeight: 'bold',
            minWidth: 48,
            textAlign: 'center',
          }}>
            {timeLeft}s
          </div>
        )}
      </div>

      {/* Flip card */}
      <div style={flipStyle} onClick={!showAnswer ? onReveal : undefined}>
        <div style={cardStyle}>
          {/* Front: question */}
          <div style={frontStyle}>
            {!showAnswer && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                Click to reveal answer
              </div>
            )}
            <div data-testid="game-question" style={{ fontSize: 14, color: 'white', textAlign: 'center', lineHeight: 1.5, fontFamily: 'sans-serif', maxHeight: 160, overflow: 'auto', width: '100%' }}>
              {questionText}
            </div>
            {question?.options && question.options.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
                {question.options.map((opt, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', padding: '2px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {String.fromCharCode(65 + i)}. {opt}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Back: answer */}
          <div style={backStyle}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
              Answer
            </div>
            <div style={{ fontSize: 16, color: '#22c55e', textAlign: 'center', fontWeight: 'bold', fontFamily: 'sans-serif', lineHeight: 1.4 }}>
              {answerText}
            </div>
          </div>
        </div>
      </div>

      {/* Answer buttons */}
      {showAnswer && (
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onCorrect}
            style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}
          >
            ✓ Correct
          </button>
          <button
            onClick={onWrong}
            style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}
          >
            ✗ Wrong
          </button>
        </div>
      )}

      {/* Reveal button */}
      {!showAnswer && (
        <button
          onClick={onReveal}
          style={{ background: accentColor, color: 'white', border: 'none', borderRadius: 8, padding: '10px 28px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}
        >
          Reveal Answer
        </button>
      )}
    </div>
  )
}
