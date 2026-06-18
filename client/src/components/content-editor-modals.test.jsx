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

    expect(screen.getByTestId('html-trusted-content-warning').textContent).toContain(
      'Trusted author content'
    )
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '<p>safe by author policy</p>' },
    })
    fireEvent.click(screen.getByText('Apply'))
    fireEvent.click(screen.getByText('Cancel'))

    expect(onChange).toHaveBeenCalledWith({
      elementId: 'html-1',
      content: '<p>safe by author policy</p>',
    })
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('[cap:element.html depth:behavior] edits Mermaid source and shows length feedback', () => {
    const onChange = vi.fn()
    render(
      <HtmlEditorModal
        state={{ elementId: 'html-1', embedKind: 'mermaid', mermaidSource: 'flowchart TD\nA-->B' }}
        onChange={onChange}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('Mermaid Diagram')).toBeTruthy()
    expect(screen.getByTestId('mermaid-source-count').textContent).toContain('/12000')
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'sequenceDiagram\nA->>B: Hi' },
    })

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        embedKind: 'mermaid',
        mermaidSource: 'sequenceDiagram\nA->>B: Hi',
      })
    )
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

    expect(onChange).toHaveBeenCalledWith({
      elementId: 'code-1',
      content: 'print(1)',
      language: 'javascript',
    })
    expect(onChange).toHaveBeenCalledWith({
      elementId: 'code-1',
      content: 'const a = 1',
      language: 'python',
    })
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

  it('[cap:element.latex depth:behavior] inserts common symbols and snippets at the cursor', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <LatexEditorModal
        state={{ elementId: 'latex-1', content: 'x + y', fontSize: 20, textColor: '#ffffff' }}
        onChange={onChange}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    const textarea = screen.getByRole('textbox')
    textarea.focus()
    textarea.setSelectionRange(2, 2)
    fireEvent.click(screen.getByTestId('latex-symbol-alpha'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'x \\alpha+ y' })
    )

    rerender(
      <LatexEditorModal
        state={{ elementId: 'latex-1', content: 'x \\alpha+ y', fontSize: 20, textColor: '#ffffff' }}
        onChange={onChange}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    fireEvent.click(screen.getByTestId('latex-snippet-fraction'))
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'x \\alpha+ y\\frac{a}{b}' })
    )
  })

  it('[cap:element.latex depth:behavior] shows friendly errors without losing invalid content', () => {
    const onChange = vi.fn()
    render(
      <LatexEditorModal
        state={{ elementId: 'latex-1', content: '\\frac{a', fontSize: 20, textColor: '#ffffff' }}
        onChange={onChange}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByTestId('latex-parse-feedback').textContent).toContain('Check LaTeX syntax')
    expect(screen.getByTestId('latex-parse-feedback').getAttribute('role')).toBe('alert')
    expect(screen.getByRole('textbox').value).toBe('\\frac{a')
  })

  it('[cap:element.latex depth:behavior] accepts documented display math wrappers', () => {
    render(
      <LatexEditorModal
        state={{ elementId: 'latex-1', content: '\\[ E = mc^2 \\]', fontSize: 20, textColor: '#ffffff' }}
        onChange={vi.fn()}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByLabelText('LaTeX source')).toBeTruthy()
    expect(screen.getByTestId('latex-parse-feedback').textContent).toContain('LaTeX syntax looks valid')
    expect(screen.getByTestId('latex-parse-feedback').getAttribute('aria-live')).toBe('polite')
    expect(screen.getByTitle('LaTeX Preview').getAttribute('srcdoc')).toContain('E = mc^2')
    expect(screen.getByTitle('LaTeX Preview').getAttribute('srcdoc')).not.toContain('\\\\[')
  })

  it('[cap:element.latex depth:behavior] allows Tab navigation out of the editor', () => {
    const onChange = vi.fn()
    render(
      <LatexEditorModal
        state={{ elementId: 'latex-1', content: 'x', fontSize: 20, textColor: '#ffffff' }}
        onChange={onChange}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    fireEvent.keyDown(screen.getByLabelText('LaTeX source'), { key: 'Tab' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('[cap:element.latex depth:behavior] keeps TikZ preview path unchanged', () => {
    render(
      <LatexEditorModal
        state={{
          elementId: 'latex-1',
          content: '\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}',
          fontSize: 20,
          textColor: '#ffffff',
        }}
        onChange={vi.fn()}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByTitle('LaTeX Preview').getAttribute('srcdoc')).toContain('text/tikz')
  })
})
