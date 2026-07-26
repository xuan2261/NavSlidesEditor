import React, { useMemo } from 'react'
import { summarizePptxImportWarnings } from '../utils/pptx-import-summary'

/**
 * Editor-only bounded import diagnostics panel.
 * Does not display job IDs, capabilities, paths, or raw stderr.
 */
export default function PptxImportReportPanel({ presentation, className = '' }) {
  const report = presentation?._pptxImportReport
  const summaryText = useMemo(
    () => summarizePptxImportWarnings(presentation) || summarizePptxImportWarnings({ reportSummary: report?.summary }),
    [presentation, report]
  )

  if (!report && !summaryText) {
    return (
      <aside
        className={className}
        data-testid="pptx-import-report-panel"
        aria-label="PPTX import report unavailable"
      >
        <p className="text-sm text-slate-500">No import diagnostics available for this presentation.</p>
      </aside>
    )
  }

  const byType = report?.summary?.byType && typeof report.summary.byType === 'object'
    ? Object.entries(report.summary.byType)
    : []

  return (
    <aside
      className={className}
      data-testid="pptx-import-report-panel"
      aria-label="PPTX import diagnostics"
    >
      <h2 className="text-sm font-semibold text-slate-800">Import diagnostics</h2>
      {summaryText ? (
        <p className="mt-1 text-sm text-slate-700" data-testid="pptx-import-report-summary">
          {summaryText}
        </p>
      ) : null}
      {byType.length > 0 ? (
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-600" data-testid="pptx-import-report-types">
          {byType.map(([type, count]) => (
            <li key={type}>
              {type}: {Number(count) || 0}
            </li>
          ))}
        </ul>
      ) : null}
      {/* Never render report.jobId or raw diagnostics paths. */}
    </aside>
  )
}
