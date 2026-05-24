import { useEffect, useMemo, useRef, useState } from 'react'
import RibbonFloatingOverlay from './ribbon/ribbon-floating-overlay'
import { Button } from './ui'

const INITIAL_LIMIT = 240
const SEARCH_LIMIT = 600

let _iconPathsCache = null

function useIconPaths() {
  const [paths, setPaths] = useState(_iconPathsCache || {})

  useEffect(() => {
    if (_iconPathsCache) return
    let cancelled = false
    import('../data/icon-paths.json').then((m) => {
      if (cancelled) return
      _iconPathsCache = m.default || m
      setPaths(_iconPathsCache)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  return paths
}

export function IconSvgPreview({ name, paths, size = 16, color = 'currentColor' }) {
  const fetched = useIconPaths()
  const resolved = paths || fetched
  const raw = resolved?.[name]
  if (!raw) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: raw }}
    />
  )
}

export default function IconGallery({ open, anchorRef, onSelect, onClose, iconPaths: injectedPaths }) {
  const [search, setSearch] = useState('')
  const fetched = useIconPaths()
  const paths = injectedPaths || fetched
  const searchRef = useRef(null)

  const handleClose = () => {
    setSearch('')
    onClose?.()
  }

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => searchRef.current?.focus(), 0)
      return () => window.clearTimeout(id)
    }
    return undefined
  }, [open])

  const allNames = useMemo(() => Object.keys(paths || {}).sort(), [paths])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allNames.slice(0, INITIAL_LIMIT)
    return allNames.filter((n) => n.toLowerCase().includes(q)).slice(0, SEARCH_LIMIT)
  }, [search, allNames])

  if (!open) return null

  const totalCount = allNames.length
  const truncated = !search.trim() && totalCount > INITIAL_LIMIT
  const noMatch = search.trim() && filtered.length === 0

  return (
    <RibbonFloatingOverlay
      open={open}
      anchorRef={anchorRef}
      onClose={handleClose}
      dataRibbonPopup="icon-gallery"
      className="bg-card border border-border rounded-lg p-3 shadow-xl w-[360px]"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-text-primary">Icons</div>
        {totalCount > 0 && (
          <div className="text-[10px] text-text-muted">{totalCount} available</div>
        )}
      </div>

      <input
        ref={searchRef}
        type="text"
        placeholder="Search icons (e.g. arrow, heart, check)..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        className="prop-input mb-2 text-xs w-full"
        aria-label="Search icons"
        data-testid="icon-gallery-search"
      />

      <div
        className="overflow-y-auto max-h-80"
        data-testid="icon-gallery-grid"
      >
        {totalCount === 0 ? (
          <div className="text-[11px] text-text-muted p-4 text-center">Loading icons...</div>
        ) : noMatch ? (
          <div className="text-[11px] text-text-muted p-4 text-center">
            No icons match &quot;{search}&quot;
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {filtered.map((name) => (
              <Button
                key={name}
                variant="ghost"
                className="ribbon-icon-gallery-button p-0 h-8 w-8 flex items-center justify-center border border-border bg-secondary hover:border-primary text-text-primary"
                title={name}
                aria-label={`Insert ${name} icon`}
                data-testid={`icon-gallery-item-${name}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelect?.(name)
                  handleClose()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect?.(name)
                    handleClose()
                  }
                }}
              >
                <IconSvgPreview name={name} paths={paths} size={16} />
              </Button>
            ))}
          </div>
        )}
      </div>

      {truncated && (
        <div className="text-[10px] text-text-muted mt-1.5 text-center">
          Showing first {INITIAL_LIMIT}. Type to search all {totalCount}.
        </div>
      )}
    </RibbonFloatingOverlay>
  )
}
