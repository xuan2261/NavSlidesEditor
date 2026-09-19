
export function HotPotatoRenderer({ element, _isPresenting }) {
  const question = element.questions && element.questions[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', height: '100%' }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>🔥</div>
      <div style={{ fontSize: 14, fontWeight: 'bold', color: 'white' }}>{element.title || 'Hot Potato Quiz'}</div>
      {question && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', textAlign: 'center', padding: '0 16px', maxWidth: 300 }}>
          {question.question}
        </div>
      )}
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
        {element.questions ? `${element.questions.length} question${element.questions.length !== 1 ? 's' : ''}` : 'No questions'}
      </div>
    </div>
  )
}
