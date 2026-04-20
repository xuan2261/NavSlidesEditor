import { Node } from '@tiptap/core'
import katex from 'katex'

export const MathNode = Node.create({
  name: 'mathNode',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      latex: { default: '' },
      display: { default: false },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-math-latex]',
        getAttrs: (el) => ({
          latex: el.getAttribute('data-math-latex'),
          display: el.getAttribute('data-math-display') === 'true',
        }),
      },
    ]
  },

  renderHTML({ node }) {
    return [
      'span',
      {
        'data-math-latex': node.attrs.latex,
        'data-math-display': String(node.attrs.display),
        class: `math-node ${node.attrs.display ? 'math-display' : 'math-inline'}`,
      },
    ]
  },

  addNodeView() {
    return ({ node, updateAttributes }) => {
      const dom = document.createElement('span')
      dom.classList.add('math-node', node.attrs.display ? 'math-display' : 'math-inline')

      const render = (latex, display) => {
        try {
          dom.innerHTML = ''
          katex.render(latex, dom, { throwOnError: false, displayMode: display })
          dom.setAttribute('data-math-latex', latex)
          dom.setAttribute('data-math-display', String(display))
        // eslint-disable-next-line unused-imports/no-unused-vars
        } catch (e) {
          dom.textContent = `$${latex}$`
        }
      }
      render(node.attrs.latex, node.attrs.display)

      dom.style.cursor = 'pointer'
      dom.title = 'Click to edit LaTeX'
      dom.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        // Create an inline input overlay instead of window.prompt
        const existing = dom.querySelector('.math-edit-input')
        if (existing) return
        const input = document.createElement('input')
        input.className = 'math-edit-input'
        input.type = 'text'
        input.value = node.attrs.latex
        Object.assign(input.style, {
          position: 'absolute', top: '0', left: '0', width: '100%',
          minWidth: '200px', padding: '4px 8px', fontSize: '13px',
          background: '#1e1e28', color: '#f0f0f5', border: '1px solid #6366f1',
          borderRadius: '4px', zIndex: '100', boxSizing: 'border-box',
        })
        dom.style.position = 'relative'
        dom.appendChild(input)
        input.focus()
        input.select()
        const commit = () => {
          const val = input.value
          if (val !== null && val !== node.attrs.latex) updateAttributes({ latex: val })
          if (input.parentNode) input.parentNode.removeChild(input)
        }
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') { ke.preventDefault(); commit() }
          if (ke.key === 'Escape') { if (input.parentNode) input.parentNode.removeChild(input) }
        })
        input.addEventListener('blur', commit)
      })

      return {
        dom,
        update(updatedNode) {
          if (updatedNode.type.name !== 'mathNode') return false
          render(updatedNode.attrs.latex, updatedNode.attrs.display)
          return true
        },
      }
    }
  },

  addCommands() {
    return {
      insertMath:
        (latex, display = false) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { latex, display } }),
    }
  },
})
