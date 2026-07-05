function getBackgroundStyle(background) {
  if (!background) return { backgroundColor: 'var(--bg-card)' }
  if (typeof background === 'string') return { backgroundColor: background }
  if (background.type === 'color') return { backgroundColor: background.color || 'var(--bg-card)' }
  if (background.type === 'gradient') return { background: background.gradient || 'var(--bg-card)' }
  if (background.type === 'image' && background.image) {
    return {
      backgroundImage: `url(${background.image})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return { backgroundColor: 'var(--bg-card)' }
}

function getElementStyle(element) {
  return {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    overflow: 'hidden',
    zIndex: element.zIndex || 1,
  }
}

function getFrameStyle(slide, width, height, style) {
  return {
    width,
    height,
    position: 'relative',
    ...getBackgroundStyle(slide.background),
    ...style,
  }
}

function getTextStyle(element) {
  return { color: element.color || element.textColor || '#fff' }
}

function getImageStyle(element) {
  return { objectFit: element.objectFit || 'contain' }
}

export default function TemplateSlideThumbnail({ slide, width = 960, height = 540, style }) {
  if (!slide) return null

  return (
    <div
      className="relative overflow-hidden"
      data-testid="template-slide-thumbnail"
      style={getFrameStyle(slide, width, height, style)}
    >
      {(slide.elements || []).map((element) => (
        <div key={element.id} style={getElementStyle(element)}>
          {element.type === 'text' && (
            <div
              className="text-sm leading-[1.4] break-words"
              style={getTextStyle(element)}
              dangerouslySetInnerHTML={{ __html: element.content || '' }}
            />
          )}
          {element.type === 'image' && (
            <img
              src={element.src}
              alt=""
              className="w-full h-full block"
              style={getImageStyle(element)}
              draggable={false}
            />
          )}
          {element.type === 'shape' && (
            <div className="w-full h-full flex items-center justify-center">
              <svg viewBox={element.viewBox || '0 0 100 100'} className="w-full h-full">
                <path
                  d={element.path || ''}
                  fill={element.fill || '#6366f1'}
                  stroke={element.stroke || 'none'}
                  strokeWidth={element.strokeWidth || 0}
                />
              </svg>
            </div>
          )}
          {element.type === 'code' && (
            <pre className="m-0 p-3 bg-black/60 text-lime-200 rounded-md overflow-auto w-full h-full font-mono text-xs">
              <code>{element.content || ''}</code>
            </pre>
          )}
          {element.type === 'latex' && (
            <div className="w-full h-full bg-black/30 flex items-center justify-center text-white font-serif italic text-lg">
              TeX: {(element.content || '').substring(0, 60)}
            </div>
          )}
          {['html', 'chart', 'table', 'markdown'].includes(element.type) && (
            <div className="w-full h-full bg-primary/15 flex items-center justify-center text-white/50 text-sm">
              {element.type === 'html' && '</> HTML'}
              {element.type === 'chart' && 'Chart'}
              {element.type === 'table' && 'Table'}
              {element.type === 'markdown' && 'MD'}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
