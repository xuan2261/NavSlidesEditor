import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SlidePanel from '../SlidePanel'

export function registerNavigatorSemanticCases(defaultProps) {
  const deck = Array.from({ length: 5 }, (_, index) => ({ id: `stable-${index}`, elements: [] }))
  const button = (index) => screen.getByRole('button', { name: `Select slide ${index + 1}`, exact: true })
  describe('navigator stable identity and keyboard characterization', () => {
    it('Home/End and bounded arrows move focus without selecting; Space activates', () => {
      const props = defaultProps({ slides: deck })
      render(<SlidePanel {...props} />)
      button(0).focus()
      for (const [key, destination] of [['ArrowUp', 0], ['End', 4], ['ArrowDown', 4], ['Home', 0]]) {
        fireEvent.keyDown(document.activeElement, { key })
        expect(document.activeElement).toBe(button(destination))
        expect(button(destination).tabIndex).toBe(0)
      }
      expect(props.onSelect).not.toHaveBeenCalled()
      fireEvent.keyDown(button(0), { key: ' ' })
      expect(props.onSelect).toHaveBeenCalledWith(0)
    })

    it.each(['ctrlKey', 'metaKey'])('%s selection and bulk actions follow IDs through reorder', (modifier) => {
      const props = defaultProps({ slides: deck })
      const { rerender } = render(<SlidePanel {...props} />)
      fireEvent.click(button(2), { [modifier]: true })
      const reordered = [deck[4], deck[2], deck[1], deck[0], deck[3]]
      rerender(<SlidePanel {...props} slides={reordered} currentIndex={1} />)
      expect(reordered.filter((_, index) => button(index).getAttribute('aria-pressed') === 'true').map((slide) => slide.id))
        .toEqual(['stable-2', 'stable-0'])
      fireEvent.click(screen.getByTitle('Duplicate all selected'))
      expect(props.onDuplicateSelected).toHaveBeenCalledWith([1, 3])
      fireEvent.click(screen.getByTitle('Delete all selected'))
      expect(props.onDeleteSelected).toHaveBeenCalledWith([1, 3])
      fireEvent.click(button(3), { [modifier]: true })
      expect(screen.queryByTitle('Delete all selected')).toBeNull()
      expect(button(1).getAttribute('aria-pressed')).toBe('true')
    })

    it('Shift ranges use logical deck order and bulk deletion cannot remove every slide', () => {
      const props = defaultProps({ slides: deck })
      render(<SlidePanel {...props} />)
      fireEvent.click(button(1))
      fireEvent.click(button(3), { shiftKey: true })
      fireEvent.click(screen.getByTitle('Delete all selected'))
      expect(props.onDeleteSelected).toHaveBeenCalledWith([1, 2, 3])
      fireEvent.click(button(0))
      fireEvent.click(button(4), { shiftKey: true })
      expect(screen.getByTitle('Delete all selected').disabled).toBe(true)
      expect(props.onDeleteSelected).toHaveBeenCalledTimes(1)
    })

    it('removes deleted IDs from bulk indices while preserving remaining selections', () => {
      const props = defaultProps({ slides: deck })
      const { rerender } = render(<SlidePanel {...props} />)
      fireEvent.click(button(2), { ctrlKey: true })
      fireEvent.click(button(4), { ctrlKey: true })
      rerender(<SlidePanel {...props} slides={[deck[0], deck[1], deck[3], deck[4]]} currentIndex={3} />)
      fireEvent.click(screen.getByTitle('Delete all selected'))
      expect(props.onDeleteSelected).toHaveBeenCalledWith([0, 3])
    })

    it('children expose executable keyboard buttons and current identity after parent reorder', () => {
      const child = { id: 'stable-child', elements: [] }
      const props = defaultProps({ slides: [{ ...deck[0], children: [child] }, deck[1]], currentVerticalIndex: { parent: 0, child: 0 } })
      const { rerender } = render(<SlidePanel {...props} />)
      const childButton = screen.getByRole('button', { name: 'Select vertical slide 1.1' })
      childButton.focus()
      expect(document.activeElement).toBe(childButton)
      expect(childButton.tabIndex).toBe(0)
      expect(childButton.getAttribute('aria-current')).toBe('true')
      const onSelectVertical = defaultProps().onSelect
      rerender(<SlidePanel {...props} onSelectVertical={onSelectVertical} slides={[deck[1], { ...deck[0], children: [child] }]} currentIndex={1} currentVerticalIndex={{ parent: 1, child: 0 }} />)
      fireEvent.click(screen.getByRole('button', { name: 'Select vertical slide 2.1' }))
      expect(onSelectVertical).toHaveBeenCalledWith({ parent: 1, child: 0 })
      expect(screen.getByRole('button', { name: 'Select vertical slide 2.1' }).getAttribute('aria-current')).toBe('true')
    })

    it('drag callbacks translate full logical indices and ignore self/cancelled drops', () => {
      const props = defaultProps({ slides: deck })
      render(<SlidePanel {...props} />)
      fireEvent.dragStart(button(0))
      fireEvent.dragOver(button(4))
      fireEvent.drop(button(4))
      expect(props.onMove).toHaveBeenCalledWith(0, 4)
      fireEvent.dragStart(button(2))
      fireEvent.drop(button(2))
      fireEvent.dragStart(button(0))
      fireEvent.dragEnd(button(0))
      fireEvent.drop(button(3))
      expect(props.onMove).toHaveBeenCalledTimes(1)
    })

    it('recomputes child previews after master, token, content, and resolution replacement', () => {
      const element = { id: 'brand', type: 'text', x: 0, y: 0, width: 100, height: 50, content: 'Before' }
      const props = defaultProps({ slides: [{ ...deck[0], children: [{ id: 'child', layoutId: 'master', elements: [] }] }], layoutMasters: [{ id: 'master', name: 'Brand', placeholders: [], fixedElements: [element] }] })
      const { rerender } = render(<SlidePanel {...props} />)
      const child = screen.getByRole('button', { name: 'Select vertical slide 1.1' })
      expect(within(child).getByText('Before')).toBeTruthy()
      rerender(<SlidePanel {...props} resolution={{ width: 800, height: 600 }} designTokens={{ colors: { bg: '#101020' } }} layoutMasters={[{ ...props.layoutMasters[0], fixedElements: [{ ...element, content: 'After' }] }]} />)
      expect(within(child).queryByText('Before')).toBeNull()
      expect(within(child).getByText('After')).toBeTruthy()
      expect(child.querySelector('[inert]').style.aspectRatio).toBe('800 / 600')
      expect(child.querySelector('[inert]').style.backgroundColor).toBe('rgb(16, 16, 32)')
    })

    it('keyboard context actions target the focused off-tail slide and Escape preserves its focus', async () => {
      const props = defaultProps({ slides: deck })
      render(<SlidePanel {...props} />)
      button(0).focus()
      fireEvent.keyDown(button(0), { key: 'End' })
      fireEvent.keyDown(button(4), { key: 'F10', shiftKey: true })
      const menu = screen.getByRole('menu', { name: 'Slide actions' })
      expect(within(menu).getByRole('menuitem', { name: 'Move Down' }).disabled).toBe(true)
      fireEvent.keyDown(document.activeElement, { key: 'Escape' })
      await waitFor(() => expect(document.activeElement).toBe(button(4)))
      fireEvent.keyDown(button(4), { key: 'F10', shiftKey: true })
      fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate', exact: true }))
      expect(props.onDuplicate).toHaveBeenCalledWith(4)
    })
  })
}
