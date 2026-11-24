import { useCallback, useLayoutEffect, useRef, useState } from 'react'

// Receipts belong to React state, never the persisted presentation. Ordinary
// presentation updates retain them until their owning state actually commits.
export function usePresentationState(initial = null) {
  const [state, setState] = useState(() => ({ presentation: initial, pendingEffects: [] }))
  const published = useRef(new WeakSet())
  const setPresentation = useCallback((update) => {
    setState((previous) => {
      const presentation = typeof update === 'function' ? update(previous.presentation) : update
      return presentation === previous.presentation ? previous : { ...previous, presentation }
    })
  }, [])
  const commitPresentationTransaction = useCallback((prepare, onCommit) => {
    setState((previous) => {
      const result = prepare(previous.presentation)
      if (!result) return previous
      return {
        presentation: result.presentation,
        pendingEffects: [...previous.pendingEffects, { receipt: result.receipt, onCommit }],
      }
    })
  }, [])
  useLayoutEffect(() => {
    if (!state.pendingEffects.length) return
    for (const effect of state.pendingEffects) {
      if (published.current.has(effect)) continue
      published.current.add(effect)
      effect.onCommit(effect.receipt)
    }
    setState((previous) => ({
      ...previous,
      pendingEffects: previous.pendingEffects.filter((effect) => !published.current.has(effect)),
    }))
  }, [state.pendingEffects])
  return [state.presentation, setPresentation, commitPresentationTransaction]
}
