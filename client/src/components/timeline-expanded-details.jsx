export function TimelineExpandedDetails({ item, textColor, fontSize, dateLabel, onClose }) {
  if (!item || (!item.image && !item.detailedDescription)) return null

  return (
    <div
      data-testid="timeline-expanded"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 16,
        cursor: 'pointer',
        zIndex: 10,
      }}
    >
      {item.image && (
        <img
          src={item.image}
          alt={item.label}
          style={{
            maxWidth: item.detailedDescription ? '45%' : '80%',
            maxHeight: '85%',
            objectFit: 'contain',
            borderRadius: 6,
            flexShrink: 0,
          }}
        />
      )}
      <div
        style={{
          flex: item.image ? 1 : undefined,
          maxWidth: item.image ? '45%' : '80%',
          overflow: 'auto',
          maxHeight: '85%',
        }}
      >
        <div style={{ color: textColor, fontWeight: 700, fontSize: fontSize + 4, marginBottom: 4 }}>
          {item.label}
        </div>
        <div style={{ color: textColor, opacity: 0.5, fontSize: fontSize - 1, marginBottom: 8 }}>
          {dateLabel(item.date)}
        </div>
        {item.description && (
          <div style={{ color: textColor, opacity: 0.7, fontSize, marginBottom: 8 }}>
            {item.description}
          </div>
        )}
        {item.detailedDescription && (
          <div style={{ color: textColor, opacity: 0.85, fontSize: fontSize + 1, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {item.detailedDescription}
          </div>
        )}
      </div>
    </div>
  )
}
