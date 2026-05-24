import React from 'react'
import { useUIStore } from '../../stores/ui-store'

const ZOOM_OPTIONS = [25, 50, 75, 100, 150, 200, 400]

function ZoomControls() {
  const zoom = useUIStore((s) => s.zoom)
  const zoomIn = useUIStore((s) => s.zoomIn)
  const zoomOut = useUIStore((s) => s.zoomOut)
  const fitZoom = useUIStore((s) => s.fitZoom)
  const setZoom = useUIStore((s) => s.setZoom)
  const setUserZoomMode = useUIStore((s) => s.setUserZoomMode)

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
      <select
        data-testid="statusbar-zoom-select"
        aria-label="Zoom level"
        value={`${Math.round(zoom * 100)}`}
        onChange={(e) => {
          const pct = parseInt(e.target.value, 10) / 100
          setZoom(pct)
          setUserZoomMode(true)
        }}
        className="bg-white/10 text-white border-none rounded px-1 py-0 text-[11px] min-w-[50px] text-center outline-none cursor-pointer"
      >
        {ZOOM_OPTIONS.map((pct) => (
          <option key={pct} value={pct} className="text-text-primary">{pct}%</option>
        ))}
      </select>
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
        {Math.round(zoom * 100)}%
      </span>
    </div>
  )
}

export default function StatusBar() {
  return (
    <footer className="h-6 bg-accent text-white flex items-center justify-between px-6 text-[11px] select-none z-[100] shrink-0 font-medium">
      <div className="flex items-center h-full">
        <span
          className="flex items-center gap-1.5 opacity-90 transition-opacity hover:opacity-100"
          title="Application Name"
        >
          <svg
            className="w-[11px] h-[11px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          </svg>
          NavSlides Editor
        </span>
      </div>

      <div className="flex items-center h-full gap-4">
        <ZoomControls />
        <span
          className="flex items-center gap-1.5 opacity-90 transition-opacity hover:opacity-100"
          title="Author Signature"
        >
          <svg
            className="w-[11px] h-[11px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Designed by Xuan Bui Thanh - Department of Fundamental Engineering - Vietnam Naval Academy
        </span>
        <span
          className="flex items-center gap-1.5 opacity-90 transition-opacity hover:opacity-100"
          title="Version"
        >
          <svg
            className="w-[11px] h-[11px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          {`v${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}`}
        </span>
      </div>
    </footer>
  )
}
