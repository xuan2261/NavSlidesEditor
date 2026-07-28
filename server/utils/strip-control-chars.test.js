const { stripControlChars } = require('./strip-control-chars')
const { sanitizeDiagnostic } = require('../services/pptx-import/diagnostics')
const { buildBoundedImportReport } = require('../services/pptx-import/import-report')

// eslint-disable-next-line no-control-regex -- asserting these never survive
const CONTROL_CHARS = new RegExp('[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f-\\u009f]')
const C = String.fromCharCode

// An ANSI colour escape, a terminal title-setting sequence, plus BEL/NUL/DEL —
// the bytes that let parsed document content repaint or hide an operator's log.
const HOSTILE = `parse failed ${C(27)}[31mFAKE ADMIN LOGIN${C(27)}[0m ` +
  `${C(7)}bel ${C(0)}nul ${C(27)}]0;pwned${C(7)} ${C(127)}del ${C(155)}csi end`

describe('stripControlChars', () => {
  it('removes C0, C1, and DEL while keeping the surrounding text', () => {
    const out = stripControlChars(HOSTILE)
    expect(CONTROL_CHARS.test(out)).toBe(false)
    expect(out).toContain('FAKE ADMIN LOGIN')
    expect(out).toContain('end')
  })

  it('separates rather than joins the text either side of a stripped byte', () => {
    expect(stripControlChars(`a${C(0)}b`)).toBe('a b')
  })

  it('coerces nullish input to an empty string', () => {
    expect(stripControlChars(null)).toBe('')
    expect(stripControlChars(undefined)).toBe('')
  })
})

// These are the sanitizers that untrusted parser output actually flows through.
// Each one previously shipped without control-character stripping, so assert the
// invariant at the boundary rather than only on the shared helper.
describe('control characters never survive a sanitizer boundary', () => {
  it('sanitizeDiagnostic strips them from worker and route diagnostics', () => {
    const out = sanitizeDiagnostic(new Error(HOSTILE))
    expect(CONTROL_CHARS.test(out)).toBe(false)
    expect(out).toContain('FAKE ADMIN LOGIN')
  })

  it('import report diagnostics strip them from both message and type', () => {
    const report = buildBoundedImportReport(
      [{ type: `shape${C(27)}[31m`, message: HOSTILE, slideIndex: 0 }],
      {},
      { jobId: 'job-1' }
    )
    const [diagnostic] = report.diagnostics
    expect(CONTROL_CHARS.test(diagnostic.message)).toBe(false)
    expect(CONTROL_CHARS.test(diagnostic.type)).toBe(false)
    expect(CONTROL_CHARS.test(JSON.stringify(report))).toBe(false)
  })
})
