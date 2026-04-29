/**
 * CanvasFooterOverlay — renders footer section name and/or page number.
 * Supports two modes: 'basic' (left/right split) and 'sequence' (centred sections + page number).
 */
const sequenceFooterStyle = {
  position: 'absolute',
  bottom: 6,
  left: 16,
  right: 16,
  zIndex: 900,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 0,
  fontSize: 'inherit',
  fontFamily: 'inherit',
  pointerEvents: 'none',
  boxSizing: 'border-box',
}

const sequenceFooterTrackStyle = {
  display: 'flex',
  flex: 1,
  justifyContent: 'space-evenly',
  alignItems: 'center',
}

const sequenceFooterPageNumberStyle = {
  marginLeft: 12,
  flexShrink: 0,
}

const basicFooterStyle = {
  position: 'absolute',
  bottom: 8,
  left: 16,
  right: 16,
  zIndex: 900,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  pointerEvents: 'none',
  boxSizing: 'border-box',
}

function getSequenceFooterSectionStyle(index, activeSection, footerColor, footerInactiveColor, footerFontSize) {
  return {
    color: activeSection === index ? (footerColor || 'rgba(255,255,255,0.9)') : footerInactiveColor,
    fontWeight: activeSection === index ? 700 : 400,
    fontSize: footerFontSize,
    transition: 'color 0.2s, font-weight 0.2s',
  }
}

/**
 * Props:
 *   showFooter          — bool
 *   showPageNumbers     — bool
 *   pageNumber          — number | null
 *   totalSlides         — number
 *   sectionName         — string
 *   footerFontSize      — number (default 14)
 *   footerFontFamily    — string
 *   footerColor         — string
 *   footerInactiveColor — string
 *   footerMode          — 'basic' | 'sequence'
 *   sequenceSections    — string[]
 *   activeSection       — number | null
 *   pageNumberFormat    — 'c/t' | 'n'
 */
export default function CanvasFooterOverlay({
  showFooter,
  showPageNumbers,
  pageNumber,
  totalSlides,
  sectionName,
  footerFontSize = 14,
  footerFontFamily = '-apple-system,sans-serif',
  footerColor = 'rgba(255,255,255,0.65)',
  footerInactiveColor = 'rgba(255,255,255,0.25)',
  footerMode = 'basic',
  sequenceSections = [],
  activeSection = null,
  pageNumberFormat,
}) {
  if (!showFooter && !showPageNumbers) return null

  const baseStyle = footerMode === 'sequence' ? sequenceFooterStyle : basicFooterStyle
  const fontStyle = {
    fontSize: footerFontSize,
    fontFamily: footerFontFamily,
    color: footerMode === 'basic' ? footerColor : undefined,
  }

  const renderPageNumber = () => {
    if (!showPageNumbers || pageNumber == null) return null
    const text = pageNumberFormat === 'c/t'
      ? `${pageNumber} / ${totalSlides}`
      : `${pageNumber}`
    const numStyle = footerMode === 'sequence'
      ? { ...fontStyle, ...sequenceFooterPageNumberStyle }
      : fontStyle
    return <span style={numStyle}>{text}</span>
  }

  if (footerMode === 'sequence' && sequenceSections.length > 0) {
    return (
      <div style={{ ...baseStyle, ...fontStyle }}>
        <div style={sequenceFooterTrackStyle}>
          {sequenceSections.map((sec, i) => (
            <span key={i} style={getSequenceFooterSectionStyle(i, activeSection, footerColor, footerInactiveColor, footerFontSize)}>
              {sec || `Section ${i + 1}`}
            </span>
          ))}
        </div>
        {renderPageNumber()}
      </div>
    )
  }

  return (
    <div style={{ ...baseStyle, ...fontStyle }}>
      <span>{showFooter ? sectionName : ''}</span>
      {renderPageNumber()}
    </div>
  )
}
