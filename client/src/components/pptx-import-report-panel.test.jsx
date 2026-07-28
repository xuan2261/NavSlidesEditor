import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PptxImportReportPanel from './pptx-import-report-panel'

describe('PptxImportReportPanel', () => {
  it('renders neutral empty state when presentation has no report', () => {
    render(<PptxImportReportPanel presentation={{ id: 'p1', title: 'Blank' }} />)
    expect(screen.getByTestId('pptx-import-report-panel').textContent).toContain(
      'No import diagnostics available'
    )
  })

  it('renders bounded summary from server-owned report without job id leakage', () => {
    render(
      <PptxImportReportPanel
        presentation={{
          id: 'p2',
          _pptxImportReport: {
            schemaVersion: 1,
            jobId: 'secret-job-id-must-not-render',
            summary: {
              warningCount: 2,
              byType: { 'media-missing': 1, 'geometry-clamped': 1 },
              omittedCount: 0,
            },
            diagnostics: [{ type: 'media-missing', message: 'raw path C:\\secret\\file.pptx' }],
          },
        }}
      />
    )
    expect(screen.getByTestId('pptx-import-report-summary')).toBeTruthy()
    expect(screen.getByTestId('pptx-import-report-types').textContent).toContain('media-missing')
    expect(screen.queryByText(/secret-job-id/i)).toBeNull()
    expect(screen.queryByText(/C:\\secret/i)).toBeNull()
  })

  it('survives reload-shaped presentation props (report on loaded presentation)', () => {
    const reloaded = {
      id: 'p3',
      title: 'Reloaded',
      _pptxImportReport: {
        schemaVersion: 1,
        summary: { warningCount: 1, byType: { 'media-missing': 1 }, omittedCount: 0 },
      },
    }
    const { rerender } = render(<PptxImportReportPanel presentation={null} />)
    rerender(<PptxImportReportPanel presentation={reloaded} />)
    expect(screen.getByTestId('pptx-import-report-summary')).toBeTruthy()
  })
})
