export function DrawingRenderer({ element }) {
  const paths = element.paths || []
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${element.width} ${element.height}`}
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0 }}
      >
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            stroke={p.stroke || element.strokeColor || '#ffffff'}
            strokeWidth={p.strokeWidth || element.strokeWidth || 3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={p.opacity ?? 1}
          />
        ))}
      </svg>
      {paths.length === 0 && (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.3)',
            fontSize: 14,
            fontFamily: 'sans-serif',
          }}
        >
          Drawing (empty)
        </div>
      )}
    </div>
  )
}
