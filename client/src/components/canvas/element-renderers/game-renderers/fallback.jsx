
export function FallbackRenderer({ element }) {
  const label = element.gameType || 'Game'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 10, width: '100%', height: '100%',
    }}>
      <div style={{ fontSize: 40, lineHeight: 1 }}>❓</div>
      <div style={{ fontSize: 13, fontWeight: 'bold', color: element.accentColor || '#888' }}>
        Game: {label}
      </div>
    </div>
  )
}
