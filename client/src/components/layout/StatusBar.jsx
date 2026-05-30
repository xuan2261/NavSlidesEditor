import React from 'react'
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
        className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/15 transition-colors cursor-pointer leading-none"
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
        className="w-24 h-1 cursor-pointer accent-white/80"
      />
      <button
        type="button"
        data-testid="statusbar-zoom-in"
        title="Zoom in"
        aria-label="Zoom in"
        onClick={zoomIn}
        className="w-5 h-5 flex items-center justify-center rounded hover:bg-white/15 transition-colors cursor-pointer leading-none"
      >
        +
      </button>
      <button
        type="button"
        data-testid="statusbar-zoom-fit"
        title="Fit to window"
        aria-label="Fit to window"
        onClick={fitZoom}
        className="px-1.5 h-5 rounded hover:bg-white/15 transition-colors cursor-pointer whitespace-nowrap"
      >
        Fit
      </button>
      <span data-testid="statusbar-zoom-display" className="ml-1 opacity-75 tabular-nums min-w-[36px] text-right">
        {pct}%
      </span>
    </div>
  )
}

function SlidePosition({ current, total }) {
  return (
    <span data-testid="statusbar-slide-position" className="opacity-90 tabular-nums whitespace-nowrap">
      Slide {current + 1} / {total}
    </span>
  )
}

function ViewSwitcher() {
  const viewMode = useEditorStore((s) => s.viewMode)
  const setViewMode = useEditorStore((s) => s.setViewMode)
  const presentHandler = useUIStore((s) => s.presentHandler)

  const btn = 'w-6 h-5 flex items-center justify-center rounded transition-colors cursor-pointer'
  const active = 'bg-white/25'
  const idle = 'hover:bg-white/15'

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

const iconCls = 'w-[11px] h-[11px]'

function AttributionItem({ title, path, children }) {
  return (
    <span
      className="flex items-center gap-1.5 opacity-90 transition-opacity hover:opacity-100"
      title={title}
    >
      <svg className={iconCls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {path}
      </svg>
      {children}
    </span>
  )
}

export default function StatusBar() {
  const { current, total } = useUIStore((s) => s.slidePosition)
  const editorActive = total > 0

  return (
    <footer className="h-6 bg-accent text-white flex items-center justify-between px-6 text-[11px] select-none z-[100] shrink-0 font-medium">
      <div className="flex items-center h-full gap-4">
        <AttributionItem title="Application Name" path={<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />}>
          NavSlides Editor
        </AttributionItem>
        {editorActive && <SlidePosition current={current} total={total} />}
      </div>

      <div className="flex items-center h-full gap-4">
        {editorActive && (
          <>
            <ViewSwitcher />
            <ZoomControls />
          </>
        )}
        <AttributionItem title="Author Signature" path={<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}>
          Designed by Xuan Bui Thanh - Department of Fundamental Engineering - Vietnam Naval Academy
        </AttributionItem>
        <AttributionItem
          title="Version"
          path={<><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>}
        >
          {`v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}`}
        </AttributionItem>
      </div>
    </footer>
  )
}
