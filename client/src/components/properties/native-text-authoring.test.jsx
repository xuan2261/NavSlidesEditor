import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { normalizeTextDocument } from 'revealjs-shared/src/pptx-text-document.js'
import { mountNativeText, nativeTextFixture, savedText } from './native-text-test-harness'

afterEach(cleanup)
const change = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const apply = () => fireEvent.click(screen.getByRole('button', { name: 'Apply to selected occurrence' }))
const run = 'PPTX paragraph 1 run 1'
const paragraph = 'PPTX paragraph 1'

function unchanged(view) {
  expect(view.latest().pptxSemantic.definitions).toEqual(view.initial.pptxSemantic.definitions)
  expect(view.latest().pptxSemantic.styles).toEqual(view.initial.pptxSemantic.styles)
  expect(view.latest().pptxSemantic.instances.i2).toEqual(view.initial.pptxSemantic.instances.i2)
  const source = view.initial.pptxSemantic.definitions.definition.content.textDocument
  expect(savedText(view).paragraphs[0].runs[1]).toEqual(source.paragraphs[0].runs[1])
  expect(savedText(view).paragraphs[1]).toEqual(source.paragraphs[1])
  expect(normalizeTextDocument(savedText(view))).toEqual(savedText(view))
}

describe('native source text formatting through the real reducer', () => {
  it('authors sparse run formatting in points and preserves source identities and unsupported paint declarations', () => {
    const view = mountNativeText()
    change(`${run} font size (pt)`, '23.5')
    change(`${run} bold`, 'true')
    change(`${run} italic`, 'false')
    change(`${run} underline`, 'dbl')
    change(`${run} color kind`, 'srgb')
    change(`${run} color value`, '12abEF')
    apply()
    expect(savedText(view).paragraphs[0].runs[0]).toEqual({
      componentId: 'label', kind: 'text', text: 'Source label', proofing: { dirty: false },
      properties: { fontSizePt: 23.5, bold: true, italic: false, underline: 'dbl', color: { kind: 'srgb', value: '12abEF' } },
    })
    expect(savedText(view).paragraphs[0]).not.toHaveProperty('properties')
    expect(savedText(view).body).toEqual({ verticalText: 'mongolianVert' })
    unchanged(view)
  })

  it('authors paragraph direction, bullets and exact EMU tabs without populating unrelated defaults', () => {
    const view = mountNativeText()
    change(`${paragraph} alignment`, 'justLow')
    change(`${paragraph} direction`, 'rtl')
    change(`${paragraph} bullet kind`, 'number')
    change(`${paragraph} bullet numbering scheme`, 'romanUcPeriod')
    change(`${paragraph} bullet start`, '7')
    fireEvent.click(screen.getByRole('button', { name: `${paragraph} add tab stop` }))
    change(`${paragraph} tab 1 position (EMU)`, '-9525')
    change(`${paragraph} tab 1 alignment`, 'dec')
    apply()
    expect(savedText(view).paragraphs[0].properties).toEqual({ alignment: 'justLow', direction: 'rtl',
      bullet: { kind: 'number', scheme: 'romanUcPeriod', startAt: 7 }, tabs: [{ positionEmu: -9525, alignment: 'dec' }] })
    expect(savedText(view).paragraphs[0].runs[0]).not.toHaveProperty('properties')
    unchanged(view)
  })

  it('authors body insets and normal autofit without losing unsupported body values', () => {
    const view = mountNativeText()
    change('PPTX body left inset (EMU)', '0')
    change('PPTX body top inset (EMU)', '-9525')
    change('PPTX body autofit mode', 'normal')
    change('PPTX body font scale (1/1000%)', '90000')
    change('PPTX body line space reduction (1/1000%)', '10000')
    apply()
    expect(savedText(view).body).toEqual({ verticalText: 'mongolianVert', insetLeftEmu: 0, insetTopEmu: -9525,
      autofit: { mode: 'normal', fontScale: 90000, lineSpaceReduction: 10000 } })
    unchanged(view)
  })

  it('clears explicit false back to inheritance rather than authoring a default', () => {
    const initial = nativeTextFixture((p) => {
      p.pptxSemantic.definitions.definition.content.textDocument.paragraphs[0].runs[0].properties = { bold: false }
    })
    const view = mountNativeText(initial)
    change(`${run} bold`, '')
    apply()
    expect(savedText(view).paragraphs[0].runs[0]).not.toHaveProperty('properties')
    unchanged(view)
  })

  it('blocks invalid drafts and invalidates edit-all previews on formatting changes', () => {
    const view = mountNativeText()
    fireEvent.click(screen.getByRole('button', { name: 'Preview edit all occurrences' }))
    change(`${run} font size (pt)`, '20')
    expect(screen.queryByRole('region', { name: 'Edit all impact preview' })).toBeNull()
    change(`${run} font size (pt)`, '0')
    apply()
    expect(view.latest()).toBe(view.initial)
    expect(screen.getByRole('alert').textContent).toContain('from 1 to 4000')
    change(`${run} font size (pt)`, '')
    apply()
    expect(savedText(view).paragraphs[0].runs[0]).not.toHaveProperty('properties')
  })

  it('keeps asynchronous submission rejection visible without changing source or siblings', async () => {
    const view = mountNativeText(nativeTextFixture(), async () => { throw new Error('Source write rejected') })
    change(`${run} bold`, 'true')
    apply()
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Source write rejected'))
    expect(view.latest()).toBe(view.initial)
  })
})
