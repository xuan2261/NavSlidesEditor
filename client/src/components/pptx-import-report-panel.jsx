import React, { useMemo } from 'react'
import {
  summarizePptxImportWarnings,
  WARNING_CATEGORY_EXPLANATIONS,
} from '../utils/pptx-import-summary'

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
        <p className="text-sm text-text-secondary">No import diagnostics available for this presentation.</p>
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
      <h2 className="text-sm font-semibold text-text-primary">Import diagnostics</h2>
      {summaryText ? (
        <p className="mt-1 text-sm text-text-secondary" data-testid="pptx-import-report-summary">
          {summaryText}
        </p>
      ) : null}
      {byType.length > 0 ? (
        <ul className="mt-2 list-disc pl-5 text-sm text-text-secondary" data-testid="pptx-import-report-types">
          {byType.map(([type, count]) => {
            const explanation = WARNING_CATEGORY_EXPLANATIONS[type]
            return (
              <li key={type}>
                <span>
                  {type}: {Number(count) || 0}
                </span>
                {explanation ? (
                  <p
                    className="mt-0.5 text-xs text-text-secondary"
                    data-testid={`pptx-import-report-explanation-${type}`}
                  >
                    {explanation}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      {/* Never render report.jobId or raw diagnostics paths. */}
    </aside>
  )
}
