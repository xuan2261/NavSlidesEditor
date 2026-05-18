import { useRef, useCallback } from 'react'

/**
 * Hook for preserving TipTap editor selection across ribbon interactions.
 * Uses onMouseDown + preventDefault() to keep TipTap text selection alive while ribbon controls run.
 */
export function useSelectionPreservation(editor) {
  const savedSelectionRef = useRef(null)

  const rememberSelection = useCallback(() => {
    if (!editor) return
    const { from, to } = editor.state.selection
    savedSelectionRef.current = { from, to }
  }, [editor])

  const getSelectionChain = useCallback(() => {
    if (!editor) return null
    const selection = savedSelectionRef.current
    const maxPos = editor.state.doc.content.size
    let chain = editor.chain().focus()
    if (selection && selection.from <= maxPos && selection.to <= maxPos) {
      chain = chain.setTextSelection(selection)
    }
    return chain
  }, [editor])

  const runTextCommand = useCallback(
    (command) => {
      if (!editor) return
      const chain = getSelectionChain()
      if (!chain) return
      command(chain).run()
      rememberSelection()
    },
    [editor, getSelectionChain, rememberSelection]
  )

  const handleTextCommandMouseDown = useCallback(
    (command, afterRun) => {
      return (e) => {
        e.preventDefault()
        rememberSelection()
        runTextCommand(command)
        afterRun?.()
      }
    },
    [rememberSelection, runTextCommand]
  )

  return {
    rememberSelection,
    getSelectionChain,
    runTextCommand,
    handleTextCommandMouseDown,
    savedSelectionRef,
  }
}
