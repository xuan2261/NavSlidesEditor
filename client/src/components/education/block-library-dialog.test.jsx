import { StrictMode, useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EDUCATION_PRESETS, PRESET_CATEGORIES } from 'revealjs-shared'
import BlockLibraryDialog from './block-library-dialog'
import InsertTabContent from '../ribbon/ribbon-insert-tab-element-galleries-panel'
import RibbonPanel from '../ribbon/ribbon-panel'
import { useUIStore } from '../../stores/ui-store'

function LibraryExample() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open library</button>
      {open && (
        <BlockLibraryDialog
          locale="en"
          onInsert={() => ({ elements: [], warnings: [] })}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

describe('Education block library', () => {
  it('keeps the Library open through contextual Format activation and restores the Insert opener on dismissal', async () => {
    const previous = useUIStore.getState()
    const storedTab = localStorage.getItem('navslides-ribbon-active-tab')
    let view
    try {
      useUIStore.setState({
        activeTab: 'insert',
        lastNonContextualTab: 'insert',
        formatContext: { hasSelection: false, elementType: null },
        formatAutoActivatedForSelection: false,
      })
      const user = userEvent.setup()
      view = render(
        <RibbonPanel
          selectedElementIds={[]}
          onInsertEducationPreset={() => {
            useUIStore.getState().setFormatContext({ hasSelection: true, elementType: 'game' })
            return { elements: [{ id: 'new-game' }], warnings: [] }
          }}
        />
      )
      const opener = screen.getByRole('button', { name: 'Education Library' })
      await user.click(opener)
      await user.selectOptions(screen.getByRole('combobox', { name: /Language|Ngôn ngữ/ }), 'en')
      await user.click(screen.getByRole('button', { name: 'Insert', exact: true }))
      expect(useUIStore.getState().activeTab).toBe('format')
      expect(screen.getByRole('dialog')).toBeTruthy()
      expect(screen.getByRole('status').textContent).toContain('Inserted')
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(useUIStore.getState().activeTab).toBe('insert')
      expect(document.activeElement).toBe(opener)
    } finally {
      view?.unmount()
      useUIStore.setState({
        activeTab: previous.activeTab,
        lastNonContextualTab: previous.lastNonContextualTab,
        formatContext: previous.formatContext,
        formatAutoActivatedForSelection: previous.formatAutoActivatedForSelection,
      })
      if (storedTab === null) localStorage.removeItem('navslides-ribbon-active-tab')
      else localStorage.setItem('navslides-ribbon-active-tab', storedTab)
    }
  })

  it('makes every native activity and exact local simulation reachable from Insert', async () => {
    const user = userEvent.setup()
    render(<InsertTabContent onInsertEducationPreset={() => ({ elements: [], warnings: [] })} />)
    await user.click(screen.getByRole('button', { name: 'Education Library' }))
    const dialog = screen.getByRole('dialog')
    const category = within(dialog).getByRole('combobox', { name: /Category|Danh mục/ })
    const locale = within(dialog).getByRole('combobox', { name: /Language|Ngôn ngữ/ })
    fireEvent.change(locale, { target: { value: 'en' } })
    for (const preset of EDUCATION_PRESETS)
      expect(within(dialog).getByRole('button', { name: preset.labels.en })).toBeTruthy()
    fireEvent.change(category, { target: { value: 'simulations' } })
    expect(
      within(dialog)
        .getAllByTestId('education-preset-card')
        .map((card) => card.dataset.presetId)
    ).toEqual([
      'sim-logic-gates',
      'sim-rlc-response',
      'sim-pid-tuning',
      'sim-bode-plot',
      'sim-3phase',
      'sim-gear-train',
    ])
    fireEvent.change(category, { target: { value: 'all' } })
    expect(within(dialog).getByRole('button', { name: 'Quiz' })).toBeTruthy()
  })

  it('supports accent-insensitive Vietnamese and English search with localized categories and empty-state recovery', () => {
    render(<BlockLibraryDialog locale="vi" onInsert={vi.fn()} onClose={vi.fn()} />)
    const search = screen.getByRole('searchbox', { name: 'Tìm kiếm' })
    fireEvent.change(search, { target: { value: 'cong logic' } })
    expect(screen.getByRole('button', { name: 'Cổng logic' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Điện ba pha' })).toBeNull()
    fireEvent.change(search, { target: { value: 'RLC Frequency' } })
    expect(screen.getByRole('button', { name: 'Đáp ứng tần số RLC' })).toBeTruthy()
    fireEvent.change(screen.getByRole('combobox', { name: 'Ngôn ngữ' }), {
      target: { value: 'en' },
    })
    for (const category of PRESET_CATEGORIES)
      expect(screen.getByRole('option', { name: category.labels.en })).toBeTruthy()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), {
      target: { value: 'not-in-this-catalog' },
    })
    expect(screen.getByText('No matching activities.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Insert' }).disabled).toBe(true)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'Insert' }).disabled).toBe(false)
  })

  it('shows meaningful simulation metadata without mounting any authored executable content', () => {
    const { container } = render(
      <BlockLibraryDialog locale="en" onInsert={vi.fn()} onClose={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Logic Gates' }))
    const preview = screen.getByRole('region', { name: 'Preview' })
    expect(preview.textContent).toContain('Logic Gates')
    expect(preview.textContent).toContain('No network dependencies')
    expect(preview.textContent).toContain('Works offline')
    expect(preview.textContent).toContain('Live room unavailable')
    expect(container.querySelector('iframe, script, canvas, object, embed')).toBeNull()
  })

  it('inserts the selected preset twice and visibly reports unresolved reference warnings', () => {
    const onInsert = vi.fn(() => ({
      elements: [{ id: 'copy' }],
      warnings: [
        {
          sourceElementId: 'copy',
          targetElementId: 'missing-target',
          error: 'Target is missing from this effective slide.',
        },
      ],
    }))
    render(<BlockLibraryDialog locale="en" onInsert={onInsert} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Quiz' }))
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }))
    expect(onInsert).toHaveBeenCalledWith('education-quiz')
    expect(screen.getByRole('alert').textContent).toContain('missing-target')
    expect(screen.getByRole('alert').textContent).toContain('Target is missing')
    expect(screen.getByRole('status').textContent).toContain('Inserted')
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }))
    expect(onInsert).toHaveBeenCalledTimes(2)
  })

  it.each(['locked', 'invalid'])(
    'reports %s insertion failure without claiming success',
    (reason) => {
      const onInsert = () => {
        if (reason === 'invalid') throw new Error('Invalid preset IDs')
        return null
      }
      render(<BlockLibraryDialog locale="en" onInsert={onInsert} onClose={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', { name: 'Insert' }))
      expect(screen.getByRole('alert').textContent).toMatch(
        reason === 'invalid' ? /Invalid preset IDs/ : /locked|unavailable/
      )
      expect(screen.queryByRole('status')).toBeNull()
    }
  )

  it('traps focus in both directions and returns it to the opener on Escape', async () => {
    const user = userEvent.setup()
    render(
      <StrictMode>
        <LibraryExample />
      </StrictMode>
    )
    const opener = screen.getByRole('button', { name: 'Open library' })
    await user.click(opener)
    const search = screen.getByRole('searchbox', { name: 'Search' })
    const insert = screen.getByRole('button', { name: 'Insert' })
    expect(document.activeElement).toBe(search)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(insert)
    await user.tab()
    expect(document.activeElement).toBe(search)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
})
