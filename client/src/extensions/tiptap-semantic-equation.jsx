import React from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import { NodeSelection, Plugin } from '@tiptap/pm/state'
import contract from 'revealjs-shared/src/pptx-omml-document.js'
import { semanticTextFromTipTap } from '../utils/pptx-semantic-text-bridge'
import NativeOmmlRenderer from '../components/properties/native-omml-renderer'

function EquationAtom({ node, editor, getPos, selected }) {
  return <NodeViewWrapper as="span" contentEditable={false}
    className={selected ? 'semantic-equation ProseMirror-selectednode' : 'semantic-equation'}
    data-pptx-equation="1" role="math" aria-label="Native inline equation"
    onMouseDown={(event) => {
      if (event.button !== 0) return
      const position = getPos()
      if (typeof position !== 'number') return
      event.preventDefault()
      editor.commands.setNodeSelection(position)
    }}>
    <NativeOmmlRenderer inline document={node.attrs.pptxRun.run.ommlDocument}
      textDefaults={node.attrs.pptxEquationStyle?.textDefaults} theme={node.attrs.pptxEquationStyle?.theme} />
  </NodeViewWrapper>
}
function jsonAttribute(element, name) {
  const value = element.getAttribute(name)
  if (!value || value.length > 8388608) return null
  try { return JSON.parse(value) } catch { return null }
}

export const SemanticEquation = Node.create({
  name: 'semanticEquation', group: 'inline', inline: true, atom: true,
  selectable: true, draggable: true, marks: '',
  addAttributes() {
    return {
      pptxRun: {
        default: null,
        parseHTML: (element) => jsonAttribute(element, 'data-pptxrun'),
        renderHTML: (attrs) => attrs.pptxRun ? { 'data-pptxrun': JSON.stringify(attrs.pptxRun) } : {},
      },
      pptxEquationStyle: {
        default: null,
        parseHTML: (element) => jsonAttribute(element, 'data-pptx-equation-style'),
        renderHTML: (attrs) => attrs.pptxEquationStyle
          ? { 'data-pptx-equation-style': JSON.stringify(attrs.pptxEquationStyle) } : {},
      },
    }
  },
  parseHTML: () => [{ tag: 'span[data-pptx-equation]', getAttrs: (element) => {
    const native = jsonAttribute(element, 'data-pptxrun')
    if (native?.run?.kind !== 'equation' || Object.hasOwn(native.run, 'text') || Object.hasOwn(native.run, 'field')) return false
    try { contract.normalizeOmmlDocument(native.run.ommlDocument); return null } catch { return false }
  } }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, {
    'data-pptx-equation': '1', contenteditable: 'false', role: 'math', 'aria-label': 'Native inline equation',
  })],
  // Clipboard plain text must not substitute a flattened formula for the native AST.
  renderText: () => '\uFFFC',
  addNodeView: () => ReactNodeViewRenderer(EquationAtom),
  addCommands() {
    return { updateSelectedSemanticEquation: (input) => ({ state, dispatch }) => {
      if (!(state.selection instanceof NodeSelection) || state.selection.node.type.name !== this.name) return false
      const document = contract.normalizeOmmlDocument(input)
      const node = state.selection.node, native = node.attrs.pptxRun
      if (native?.run?.kind !== 'equation') return false
      if (dispatch) {
        const position = state.selection.from
        const transaction = state.tr.setNodeMarkup(position, undefined, {
          ...node.attrs, pptxRun: { ...native, run: { ...native.run, ommlDocument: document } },
        })
        dispatch(transaction.setSelection(NodeSelection.create(transaction.doc, position)))
      }
      return true
    } }
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction: (transactions, _oldState, state) => {
        if (!transactions.some((transaction) => transaction.docChanged) || !state.doc.firstChild?.attrs.pptxParagraph) return null
        const atoms = []
        state.doc.descendants((node, position) => {
          if (node.type.name === this.name) atoms.push({ node, position })
        })
        if (!atoms.length) return null
        // Keep the live atoms' identities equal to the canonical body produced by
        // paste/duplication. This also ensures subsequent token edits target the
        // newly owned AST rather than reusing clipboard/source identities.
        const document = semanticTextFromTipTap(state.doc.toJSON())
        const equations = document.paragraphs.flatMap((paragraph) => paragraph.runs.filter((run) => run.kind === 'equation'))
        let index = 0
        const transaction = state.tr
        atoms.forEach(({ node, position }) => {
          const run = equations[index++]
          if (JSON.stringify(node.attrs.pptxRun.run) === JSON.stringify(run) &&
              node.attrs.pptxRun.identitySeed === run.componentId) return
          transaction.setNodeMarkup(position, undefined, { ...node.attrs,
            pptxRun: { ...node.attrs.pptxRun, run, identitySeed: run.componentId } })
        })
        return transaction.docChanged ? transaction.setMeta('addToHistory', false) : null
      },
    })]
  },
})
