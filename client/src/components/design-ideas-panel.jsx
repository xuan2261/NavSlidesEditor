import { useMemo, useState, useCallback } from 'react'
import { Sparkles, RefreshCw, LayoutTemplate, Palette } from 'lucide-react'
import { suggestDesigns } from '../lib/design-ideas/suggest'

/**
 * Design Ideas side panel (presentational + a thin click layer).
 *
 * Analyzes the active slide and renders up to 5 heuristic suggestions. Apply
 * logic is delegated to the host via props so the panel stays pure UI; the
 * host performs the actual reposition / token write as one undoable step.
 *
 * Props:
 *   slide          - active slide ({ elements, designTokens, ... })
 *   presentation   - deck (used for the deck's current tokens)
 *   onApplyLayout  - (templateId: string) => void
 *   onApplyTheme   - (preset: { presetId, tokens }) => void
 *   onRefresh      - () => void   (host re-renders with a fresh slide ref)
 */
export default function DesignIdeasPanel({
  slide,
  presentation,
  onApplyLayout,
  onApplyTheme,
  onRefresh,
}) {
  // Bump on Refresh to force re-analysis even if the slide ref is unchanged.
  const [nonce, setNonce] = useState(0)
  const currentTokens = slide?.designTokens || presentation?.designTokens

  const suggestions = useMemo(
    () => suggestDesigns(slide, { currentTokens }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slide, currentTokens, nonce]
  )

  const handleRefresh = useCallback(() => {
    setNonce((n) => n + 1)
    onRefresh?.()
  }, [onRefresh])

  const apply = useCallback(
    (s) => {
      if (s.kind === 'layout') {
        onApplyLayout?.(s.templateId)
      } else {
        // Pass both id and tokens so the host can write deck tokens directly.
        onApplyTheme?.({ presetId: s.presetId, tokens: { colors: s.preview.colors } })
      }
    },
    [onApplyLayout, onApplyTheme]
  )

  return (
    <div
      className="design-ideas-panel w-60 shrink-0 bg-panel text-text-primary border-l border-border overflow-y-auto flex flex-col"
      role="complementary"
      aria-label="Design ideas panel"
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
          <Sparkles size={13} className="text-accent" />
          Design Ideas
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-text-secondary hover:bg-secondary hover:text-text-primary cursor-pointer"
          title="Refresh ideas"
          aria-label="Refresh ideas"
          onMouseDown={(e) => { e.preventDefault(); handleRefresh() }}
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {suggestions.length === 0 ? (
        <p className="px-3 py-3 text-[10px] text-text-muted">No ideas for this slide yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5 p-2">
          {suggestions.map((s) => (
            <li key={`${s.kind}:${s.templateId || s.presetId}`}>
              <SuggestionCard suggestion={s} onApply={() => apply(s)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SuggestionCard({ suggestion, onApply }) {
  const isLayout = suggestion.kind === 'layout'
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card p-1.5">
      {isLayout ? (
        <LayoutGlyph icon={suggestion.preview?.icon} />
      ) : (
        <ColorSwatch colors={suggestion.preview?.colors} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 truncate text-[11px] font-medium leading-tight">
          {isLayout ? <LayoutTemplate size={10} className="shrink-0 text-text-muted" />
            : <Palette size={10} className="shrink-0 text-text-muted" />}
          <span className="truncate">{suggestion.label}</span>
        </div>
        <div className="text-[9px] uppercase tracking-wide text-text-muted">
          {isLayout ? 'Layout' : 'Theme'}
        </div>
      </div>
      <button
        type="button"
        className="shrink-0 rounded bg-secondary px-2 py-1 text-[10px] text-text-primary hover:bg-primary hover:text-primary-foreground cursor-pointer transition-colors"
        aria-label={`Apply ${suggestion.label}`}
        title={`Apply ${suggestion.label}`}
        onMouseDown={(e) => { e.preventDefault(); onApply() }}
      >
        Apply
      </button>
    </div>
  )
}

function LayoutGlyph({ icon }) {
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border/60 bg-secondary text-[14px]"
      aria-hidden="true"
    >
      {icon || '▦'}
    </span>
  )
}

function ColorSwatch({ colors }) {
  const c = colors || {}
  return (
    <span
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border/60"
      style={{ background: c.bg || '#1e1e2e' }}
      aria-hidden="true"
    >
      <span className="flex gap-0.5">
        <span className="inline-block h-3 w-1.5 rounded-sm" style={{ background: c.accent || '#6366f1' }} />
        <span className="inline-block h-3 w-1.5 rounded-sm" style={{ background: c.accent2 || '#8b5cf6' }} />
      </span>
    </span>
  )
}
