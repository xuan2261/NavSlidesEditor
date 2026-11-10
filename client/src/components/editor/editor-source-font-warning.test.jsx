import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { PptxSourceFontContext } from '../../contexts/pptx-source-font-context'
import EditorSourceFontWarning from './editor-source-font-warning'

afterEach(cleanup)

function warning(value) {
  return <PptxSourceFontContext.Provider value={value}>
    <EditorSourceFontWarning />
  </PptxSourceFontContext.Provider>
}

it('discloses unavailable font measurement when server roots are not configured', () => {
  const view = render(warning({ status: 'unavailable', issues: [
    { code: 'source-font-roots-unconfigured' },
  ] }))
  expect(screen.getByRole('alert').textContent).toMatch(/unmeasured preview/i)
  expect(screen.getByRole('alert').textContent).toContain('source-font-roots-unconfigured')
  view.rerender(warning({ status: 'ready', issues: [] }))
  expect(screen.queryByRole('alert')).toBeNull()
})

it('retains located ambiguous and missing faces without claiming a measured fallback', () => {
  render(warning({ status: 'unavailable', issues: [
    { code: 'font-ambiguous', typeface: 'Arial', part: 'ppt/slides/slide2.xml' },
    { code: 'font-unavailable', typeface: 'Aptos', part: 'ppt/slides/slide3.xml' },
  ] }))
  const alert = screen.getByRole('alert').textContent
  expect(alert).toContain('Arial')
  expect(alert).toContain('font-ambiguous')
  expect(alert).toContain('ppt/slides/slide2.xml')
  expect(alert).toContain('Aptos')
  expect(alert).toContain('ppt/slides/slide3.xml')
  expect(alert).toMatch(/unmeasured preview/i)
})

it('discloses an unavailable runtime even without per-face diagnostics', () => {
  render(warning({ status: 'unavailable', issues: [] }))
  expect(screen.getByRole('alert').textContent).toMatch(/unmeasured preview/i)
})

it.each(['idle', 'loading', 'ready'])('does not report stale issues while %s', (status) => {
  render(warning({ status, issues: [{ code: 'font-unavailable', typeface: 'Arial' }] }))
  expect(screen.queryByRole('alert')).toBeNull()
})
