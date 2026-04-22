import React, { useRef, useEffect, useState } from 'react'
import { Presentation } from 'lucide-react'

export default function SlideThumbnail({ id, bgProp, fallback, className = '' }) {
  const containerRef = useRef(null)
  const [scale, setScale] = useState(0.25)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        // Target width is 1920 to render high-res thumbnail scaled down
        setScale(entry.contentRect.width / 1920)
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex items-center justify-center relative overflow-hidden bg-card aspect-video ${className}`}
      style={bgProp}
    >
      <iframe
        loading="lazy"
        src={`/api/presentations/${id}/present?preview=true`}
        className="absolute top-0 left-0 pointer-events-none origin-top-left"
        style={{
          width: '1920px',
          height: '1080px',
          transform: `scale(${scale})`,
          border: 'none',
        }}
        scrolling="no"
        tabIndex={-1}
        title={`Thumbnail for ${id}`}
      />
      {fallback && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <Presentation size={36} className="text-text-muted opacity-50" />
        </div>
      )}
    </div>
  )
}
