import React, { useLayoutEffect, useRef, useState } from 'react'
import { LayoutGrid, Maximize, Play } from 'lucide-react'
import { useUIStore } from '../../stores/ui-store'
import { useEditorStore } from '../../stores/editor-store'

function ZoomControls() {
  const zoom = useUIStore((s) => s.zoom)
  const zoomIn = useUIStore((s) => s.zoomIn)
  const zoomOut = useUIStore((s) => s.zoomOut)
  const fitZoom = useUIStore((s) => s.fitZoom)
  const setZoom = useUIStore((s) => s.setZoom)
  const setUserZoomMode = useUIStore((s) => s.setUserZoomMode)
  const pct = Math.round(zoom * 100)

  return (
    <div className="flex items-center gap-1 text-[11px]">
      <button
        type="button"
        data-testid="statusbar-zoom-out"
        title="Zoom out"
        aria-label="Zoom out"
        onClick={zoomOut}
        className="ui-coarse-target ui-coarse-target-square h-7 w-7 sm:h-5 sm:w-5 flex items-center justify-center rounded hover:bg-black/10 transition-colors cursor-pointer leading-none"
      >
        −
      </button>
      <input
        type="range"
        data-testid="statusbar-zoom-slider"
        aria-label="Zoom level"
        min={10}
        max={400}
        step={5}
        value={pct}
        onChange={(e) => {
          setZoom(parseInt(e.target.value, 10) / 100)
          setUserZoomMode(true)
        }}
        className="ui-coarse-target h-6 w-28 sm:h-1 sm:w-24 cursor-pointer accent-white/80"
      />
      <button
        type="button"
        data-testid="statusbar-zoom-in"
        title="Zoom in"
        aria-label="Zoom in"
        onClick={zoomIn}
        className="ui-coarse-target ui-coarse-target-square h-7 w-7 sm:h-5 sm:w-5 flex items-center justify-center rounded hover:bg-black/10 transition-colors cursor-pointer leading-none"
      >
        +
      </button>
      <button
        type="button"
        data-testid="statusbar-zoom-fit"
        title="Fit to window"
        aria-label="Fit to window"
        onClick={fitZoom}
        className="ui-coarse-target h-7 sm:h-5 px-2 sm:px-1.5 rounded hover:bg-black/10 transition-colors cursor-pointer whitespace-nowrap"
      >
        Fit
      </button>
      <span
        data-testid="statusbar-zoom-display"
        className="ml-1 tabular-nums min-w-[36px] text-right"
      >
        {pct}%
      </span>
    </div>
  )
}

function SlidePosition({ current, total, vertical, masterName }) {
  const label = masterName
    ? `Editing master: ${masterName}`
    : `Slide ${current + 1}${vertical != null ? `.${vertical + 1}` : ''} / ${total}`
  return (
    <span data-testid="statusbar-slide-position" title={label} className="min-w-0 truncate tabular-nums">
      {label}
    </span>
  )
}

function ViewSwitcher() {
  const viewMode = useEditorStore((s) => s.viewMode)
  const setViewMode = useEditorStore((s) => s.setViewMode)
  const presentHandler = useUIStore((s) => s.presentHandler)

  const btn =
    'ui-coarse-target ui-coarse-target-square h-7 w-7 sm:w-6 sm:h-5 flex items-center justify-center rounded transition-colors cursor-pointer'
  const active = 'bg-black/20'
  const idle = 'hover:bg-black/10'

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        data-testid="statusbar-view-normal"
        title="Normal view"
        aria-label="Normal view"
        aria-pressed={viewMode === 'normal'}
        onClick={() => setViewMode('normal')}
        className={`${btn} ${viewMode === 'normal' ? active : idle}`}
      >
        <Maximize size={12} />
      </button>
      <button
        type="button"
        data-testid="statusbar-view-sorter"
        title="Slide Sorter"
        aria-label="Slide Sorter"
        aria-pressed={viewMode === 'sorter'}
        onClick={() => setViewMode('sorter')}
        className={`${btn} ${viewMode === 'sorter' ? active : idle}`}
      >
        <LayoutGrid size={12} />
      </button>
      <button
        type="button"
        data-testid="statusbar-view-present"
        title="Present"
        aria-label="Present"
        onClick={() => presentHandler?.()}
        className={`${btn} ${idle}`}
      >
        <Play size={12} />
      </button>
    </div>
  )
}

export function getStatusBarDensity(width) {
  if (width < 640) return 'compact'
  if (width < 1024) return 'standard'
  return 'wide'
}


export default function StatusBar() {
  const slidePosition = useUIStore((s) => s.slidePosition)
  const editorActive = slidePosition.total > 0
  const footerRef = useRef(null)
  const [density, setDensity] = useState('standard')

  useLayoutEffect(() => {
    const node = footerRef.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(([entry]) => {
      setDensity(getStatusBarDensity(entry.contentRect.width))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <footer
      ref={footerRef}
      data-density={density}
      className="min-h-8 sm:min-h-6 bg-brand-hover text-white flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2 text-[11px] select-none z-[100] shrink-0 font-medium sm:px-6"
    >
      {editorActive && <SlidePosition {...slidePosition} />}
      {density === 'wide' && (
        <div data-testid="statusbar-attribution" className="flex min-w-0 flex-1 items-center gap-4 overflow-hidden">
          <span className="truncate" title="NavSlides Editor">NavSlides Editor</span>
          <span className="min-w-0 truncate" title="Designed by Xuan Bui Thanh - Department of Fundamental Engineering - Vietnam Naval Academy">
            Designed by Xuan Bui Thanh - Department of Fundamental Engineering - Vietnam Naval Academy
          </span>
        </div>
      )}
      <div
        data-testid="statusbar-critical-controls"
        className="ml-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-4"
      >
        {editorActive && <><ViewSwitcher /><ZoomControls /></>}
        {density !== 'compact' && (
          <span title="Version">{`v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}`}</span>
        )}
      </div>
    </footer>
  )
}
