import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CodeEditorModal from './CodeEditorModal'
import HtmlEditorModal from './HtmlEditorModal'
import LatexEditorModal from './LatexEditorModal'

describe('content editor modals', () => {
  it('[cap:element.html depth:behavior] saves, cancels, and warns that HTML is trusted active content', () => {
    const onChange = vi.fn()
    const onApply = vi.fn()
    const onCancel = vi.fn()
    render(
      <HtmlEditorModal
        state={{ elementId: 'html-1', content: '<script>window.x=1</script>' }}
        onChange={onChange}
        onApply={onApply}
        onCancel={onCancel}
      />
    )

    expect(screen.getByTestId('html-trusted-content-warning').textContent).toContain('Trusted author content')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '<p>safe by author policy</p>' } })
    fireEvent.click(screen.getByText('Apply'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(onChange).toHaveBeenCalledWith({ elementId: 'html-1', content: '<p>safe by author policy</p>' })
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('[cap:element.code depth:behavior] saves, cancels, and updates code language/theme state', () => {
    const onChange = vi.fn()
    const onApply = vi.fn()
    const onCancel = vi.fn()
    const onChangeTheme = vi.fn()
    render(
      <CodeEditorModal
        state={{ elementId: 'code-1', content: 'const a = 1', language: 'javascript' }}
        onChange={onChange}
        onApply={onApply}
        onCancel={onCancel}
        codeTheme="monokai"
        onChangeTheme={onChangeTheme}
      />
    )

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'print(1)' } })
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'python' } })
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'github' } })
    fireEvent.click(screen.getByText('Apply'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(onChange).toHaveBeenCalledWith({ elementId: 'code-1', content: 'print(1)', language: 'javascript' })
    expect(onChange).toHaveBeenCalledWith({ elementId: 'code-1', content: 'const a = 1', language: 'python' })
    expect(onChangeTheme).toHaveBeenCalledWith('github')
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('[cap:element.latex depth:behavior] saves, cancels, and updates LaTeX content', () => {
    const onChange = vi.fn()
    const onApply = vi.fn()
    const onCancel = vi.fn()
    render(
      <LatexEditorModal
        state={{ elementId: 'latex-1', content: 'x^2', fontSize: 20, textColor: '#ffffff' }}
        onChange={onChange}
        onApply={onApply}
        onCancel={onCancel}
      />
    )

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '\\frac{a}{b}' } })
    fireEvent.click(screen.getByText('Apply'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(onChange).toHaveBeenCalledWith({
      elementId: 'latex-1',
      content: '\\frac{a}{b}',
      fontSize: 20,
      textColor: '#ffffff',
    })
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
