import { StrictMode, useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CodeEditorModal from './CodeEditorModal'
import StemSimulationPresetModal from './stem-simulation-preset-modal'

function CodeEditorExample() {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState({ language: 'javascript', content: 'const value = 1' })
  const [theme, setTheme] = useState('monokai')
  const [saved, setSaved] = useState(null)
  return (
    <>
      <button onClick={() => setOpen(true)}>Edit code</button>
      {open && (
        <CodeEditorModal
          state={state}
          onChange={setState}
          codeTheme={theme}
          onChangeTheme={setTheme}
          onApply={() => { setSaved({ ...state, theme }); setOpen(false) }}
          onCancel={() => setOpen(false)}
        />
      )}
      {saved && <output aria-label="Saved code">{JSON.stringify(saved)}</output>}
    </>
  )
}

async function openEditor(user) {
  render(<StrictMode><CodeEditorExample /></StrictMode>)
  const opener = screen.getByRole('button', { name: 'Edit code' })
  await user.click(opener)
  return opener
}

describe('CodeEditorModal accessibility', () => {
  it('edits source, language and highlight theme through named controls', async () => {
    const user = userEvent.setup()
    const opener = await openEditor(user)
    const source = screen.getByRole('textbox', { name: 'Code source' })
    expect(document.activeElement).toBe(source)
    await user.clear(source)
    await user.type(source, 'print(42)')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Code language' }), 'python')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Code highlight theme' }), 'github')
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    expect(JSON.parse(screen.getByRole('status', { name: 'Saved code' }).textContent)).toEqual({
      content: 'print(42)', language: 'python', theme: 'github',
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })

  it('indents a selection without losing focus and lets Shift+Tab reach dialog controls', async () => {
    const user = userEvent.setup()
    await openEditor(user)
    const source = screen.getByRole('textbox', { name: 'Code source' })
    source.setSelectionRange(0, 6)
    await user.tab()
    expect(source.value).toBe('  value = 1')
    expect(document.activeElement).toBe(source)
    await waitFor(() => expect(source.selectionStart).toBe(2))

    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Apply' }))
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Code highlight theme' }))
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Code language' }))
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(source)
  })

  it.each(['Escape', 'Cancel', 'backdrop'])('restores opener focus after %s dismissal', async (action) => {
    const user = userEvent.setup()
    const opener = await openEditor(user)
    if (action === 'Escape') await user.keyboard('{Escape}')
    else if (action === 'Cancel') await user.click(screen.getByRole('button', { name: 'Cancel' }))
    else await user.click(screen.getByRole('dialog', { name: 'Code Block' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
    expect(screen.queryByRole('status', { name: 'Saved code' })).toBeNull()
  })

  it('uses the current cancellation callback after the parent rerenders', () => {
    const previousCancel = vi.fn()
    const currentCancel = vi.fn()
    const props = {
      state: { language: 'javascript', content: '' },
      onChange: vi.fn(), onApply: vi.fn(), onChangeTheme: vi.fn(),
    }
    const { rerender } = render(<CodeEditorModal {...props} onCancel={previousCancel} />)
    rerender(<CodeEditorModal {...props} onCancel={currentCancel} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(previousCancel).not.toHaveBeenCalled()
    expect(currentCancel).toHaveBeenCalledTimes(1)
  })

  it('leaves the code dialog open when Escape dismisses a dialog above it', () => {
    const closeCode = vi.fn()
    const closeSimulation = vi.fn()
    render(
      <>
        <CodeEditorModal
          state={{ language: 'javascript', content: '' }}
          onChange={vi.fn()}
          onApply={vi.fn()}
          onChangeTheme={vi.fn()}
          onCancel={closeCode}
        />
        <StemSimulationPresetModal onCancel={closeSimulation} />
      </>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(closeSimulation).toHaveBeenCalledTimes(1)
    expect(closeCode).not.toHaveBeenCalled()
  })
})
