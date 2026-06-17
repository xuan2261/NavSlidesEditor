import { describe, expect, it } from 'vitest'
import { ELEMENT_DEFAULTS } from '../../client/src/data/element-defaults.js'
import { validateElementControlAuditMatrix } from './validate-element-control-audit-matrix.mjs'

const canonicalElements = Object.keys(ELEMENT_DEFAULTS)

function security(overrides = {}) {
  return {
    trustBoundary: 'trusted-author-content',
    inputSource: 'editor',
    sink: 'presentation-json',
    sanitizerOrEscaper: 'renderer-specific escaping',
    urlSchemePolicy: 'not applicable',
    negativeSecurityTests: 'adversarial payload coverage',
    ...overrides,
  }
}

function row({
  element,
  control = 'core-control',
  surface = 'editor',
  status = 'works',
  evidence = ['source file'],
  testCoverage = ['target test'],
  decision = 'included and verified',
  security: rowSecurity,
  ...overrides
}) {
  return {
    id: `${element}.${control}.${surface}`,
    element,
    control,
    surface,
    status,
    evidence,
    testCoverage,
    decision,
    security: rowSecurity,
    ...overrides,
  }
}

function expectedControl({
  element,
  control = 'core-control',
  surfaces = ['editor'],
  scope = 'included',
  rationale = 'baseline coverage',
  contentBearing = false,
} = {}) {
  return {
    element,
    control,
    surfaces,
    scope,
    rationale,
    contentBearing,
  }
}

function validate({ rows, expectedControls, canonical = canonicalElements }) {
  return validateElementControlAuditMatrix({
    canonicalElements: canonical,
    expectedControls,
    rows,
  })
}

describe('validateElementControlAuditMatrix', () => {
  it('tracks the 19 canonical element types from ELEMENT_DEFAULTS', () => {
    expect(canonicalElements).toHaveLength(19)
  })

  it('fails when a canonical element type has zero matrix rows', () => {
    const rows = canonicalElements
      .filter((element) => element !== 'svg')
      .map((element) => row({ element }))
    const expectedControls = canonicalElements.map((element) => expectedControl({ element }))
    const result = validate({ rows, expectedControls })

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('missing matrix rows for canonical element: svg')
  })

  it('fails when an expected control/surface has no matching matrix row', () => {
    const rows = [
      row({
        element: 'text',
        control: 'rich-text-formatting',
        surface: 'editor',
        security: security(),
      }),
    ]
    const expectedControls = [
      expectedControl({
        element: 'text',
        control: 'rich-text-formatting',
        surfaces: ['editor', 'canvas'],
        contentBearing: true,
        rationale: 'authoring control must be represented on each surface',
      }),
    ]
    const result = validate({ rows, expectedControls, canonical: ['text'] })

    expect(result.ok).toBe(false)
    expect(result.errors).toContain(
      'missing matrix row for expected control: text.rich-text-formatting.canvas'
    )
  })

  it('fails on a status outside works, partial, broken, export-gap', () => {
    const rows = [
      row({
        element: 'text',
        control: 'rich-text-formatting',
        status: 'stable',
      }),
    ]
    const expectedControls = [expectedControl({ element: 'text' })]
    const result = validate({ rows, expectedControls, canonical: ['text'] })

    expect(result.ok).toBe(false)
    expect(result.errors).toContain(
      'row text.rich-text-formatting.editor has invalid status stable'
    )
  })

  it('fails when a row mixes surfaces through a surfaces array', () => {
    const rows = [
      row({
        element: 'text',
        control: 'rich-text-formatting',
        surfaces: ['editor', 'canvas'],
      }),
    ]
    const expectedControls = [expectedControl({ element: 'text' })]
    const result = validate({ rows, expectedControls, canonical: ['text'] })

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('row text.rich-text-formatting.editor mixes surfaces')
  })

  it('fails when a row uses an aggregate surface value outside the expected contract', () => {
    const rows = [
      row({
        element: 'text',
        control: 'rich-text-formatting',
        surface: 'all',
        id: 'text.rich-text-formatting.all',
      }),
    ]
    const expectedControls = [
      expectedControl({
        element: 'text',
        control: 'rich-text-formatting',
        surfaces: ['editor', 'canvas'],
      }),
    ]
    const result = validate({ rows, expectedControls, canonical: ['text'] })

    expect(result.ok).toBe(false)
    expect(result.errors).toContain(
      'row text.rich-text-formatting.all is not an expected element/control/surface'
    )
  })

  it('fails when the matrix contains duplicate rows for one element/control/surface', () => {
    const rows = [row({ element: 'text' }), row({ element: 'text' })]
    const expectedControls = [expectedControl({ element: 'text' })]
    const result = validate({ rows, expectedControls, canonical: ['text'] })

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('duplicate matrix row: text.core-control.editor')
  })

  it('fails when an expected included control has no surfaces', () => {
    const rows = [row({ element: 'text' })]
    const expectedControls = [expectedControl({ element: 'text', surfaces: [] })]
    const result = validate({ rows, expectedControls, canonical: ['text'] })

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('expected control text.core-control has invalid surfaces')
  })

  it('fails when evidence and test coverage are missing', () => {
    const rows = [
      row({
        element: 'text',
        control: 'rich-text-formatting',
        evidence: [],
        testCoverage: [],
      }),
    ]
    const expectedControls = [expectedControl({ element: 'text' })]
    const result = validate({ rows, expectedControls, canonical: ['text'] })

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('row text.rich-text-formatting.editor missing evidence')
    expect(result.errors).toContain('row text.rich-text-formatting.editor missing target test coverage')
  })

  it('fails when a content-bearing row omits required security fields', () => {
    const rows = [
      row({
        element: 'html',
        control: 'trusted-html-content',
        security: security({
          negativeSecurityTests: '',
        }),
      }),
    ]
    const expectedControls = [
      expectedControl({
        element: 'html',
        control: 'trusted-html-content',
        contentBearing: true,
      }),
    ]
    const result = validate({ rows, expectedControls, canonical: ['html'] })

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('row html.trusted-html-content.editor missing security.negativeSecurityTests')
  })
})
