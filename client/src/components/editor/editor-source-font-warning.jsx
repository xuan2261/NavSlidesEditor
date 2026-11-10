import { useContext } from 'react'
import { PptxSourceFontContext } from '../../contexts/pptx-source-font-context'

export default function EditorSourceFontWarning() {
  const { status, issues } = useContext(PptxSourceFontContext)
  if (status !== 'unavailable') return null

  return (
    <div
      role="alert"
      className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-1.5 text-xs text-text-primary flex flex-wrap items-center gap-2 z-40"
    >
      <span className="font-semibold">Source Fonts Unavailable (Unmeasured Preview):</span>
      {(issues ?? []).map((issue, idx) => (
        <span key={`${issue.code}-${issue.typeface}-${issue.part}-${idx}`} className="inline-flex flex-wrap items-center gap-1 break-words">
          {issue.typeface && <span className="font-medium underline">{issue.typeface}</span>}
          {issue.part && <span className="opacity-75">({issue.part})</span>}
          <span>{issue.code}</span>
        </span>
      ))}
      <span className="text-[11px] opacity-75">
        Source font measurement is unavailable; text uses an unmeasured preview fallback, not a qualified native rendering.
      </span>
    </div>
  )
}
