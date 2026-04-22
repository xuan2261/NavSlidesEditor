import React from 'react'

export default function StatusBar() {
  return (
    <footer className="h-6 bg-accent text-white flex items-center justify-between px-3 text-[11px] select-none z-[100] shrink-0 font-medium">
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
          Designed by Bui Thanh Xuan - Department of Fundamental Engineering - Vietnam Naval Academy
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
          v1.5.1
        </span>
      </div>
    </footer>
  )
}
