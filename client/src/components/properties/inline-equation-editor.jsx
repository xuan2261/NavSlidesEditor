import React, { useCallback, useSyncExternalStore } from 'react'
import { NodeSelection } from '@tiptap/pm/state'
import NativeOmmlEditor from './native-omml-editor'

export default function InlineEquationEditor({ editor, instanceId, locked = false }) {
  const subscribe = useCallback((notify) => {
    if (!editor || editor.isDestroyed) return () => {}
    editor.on('transaction', notify)
    return () => editor.off('transaction', notify)
  }, [editor])
  const snapshot = useCallback(() => editor && !editor.isDestroyed ? editor.state : null, [editor])
  const state = useSyncExternalStore(subscribe, snapshot, () => null)
  const selection = state?.selection
  if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'semanticEquation') return null
  const node = selection.node, run = node.attrs.pptxRun?.run
  if (run?.kind !== 'equation') return null
  return <NativeOmmlEditor key={run.componentId} instanceId={instanceId}
    document={run.ommlDocument} textDefaults={node.attrs.pptxEquationStyle?.textDefaults}
    theme={node.attrs.pptxEquationStyle?.theme}
    locked={locked || !editor.isEditable}
    onDocumentChange={(document) => {
      if (locked || !editor.isEditable) return
      if (!editor.commands.updateSelectedSemanticEquation(document))
        throw new TypeError('Select the native inline equation before editing its structure')
    }} />
}
