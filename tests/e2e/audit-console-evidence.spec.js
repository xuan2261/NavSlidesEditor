import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import { createAuditRunPaths } from './pages/pptx-import-audit-helper.js'
import { writeAuditReports } from './pages/pptx-import-audit-report-helper.js'

test('audit report preserves only bounded console provenance without document text', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'navslides-audit-privacy-'))
  try {
    const paths = createAuditRunPaths(root, 'safe-console')
    const input = {
      kind: 'resource-load',
      stage: 'slide',
      slide: 2,
      source: 'same-origin-upload',
      length: 117,
      documentText: 'secret presentation text',
      rawUrl: 'C:/private/deck.pptx',
    }
    writeAuditReports(paths, { generatedAt: '2026-09-28T00:00:00Z', corpus: 'fixture' }, [
      { deck: 'fixture.pptx', slideCount: 0, slides: [], consoleErrors: [input] },
    ])
    const report = fs.readFileSync(paths.reportJson, 'utf8')
    expect(JSON.parse(report).summary.consoleErrors).toBe(1)
    expect(JSON.parse(report).summary.strictFailures).toBe(1)
    expect(JSON.parse(report).decks[0].consoleErrors).toEqual([
      {
        kind: 'resource-load',
        stage: 'slide',
        slide: 2,
        source: 'same-origin-upload',
        length: 117,
      },
    ])
    expect(report).not.toContain('secret presentation text')
    expect(report).not.toContain('C:/private')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
