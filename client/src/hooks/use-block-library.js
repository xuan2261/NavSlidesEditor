import { useCallback } from 'react'
import { cloneEducationPreset } from 'revealjs-shared'
import { createElement } from '../utils/element-factory'
import { createGameElement } from '../constants/game-element-types-constants'

/** Clone canonical presets once, then insert the bundle through the real authoring mapper. */
export function useBlockLibrary({
  getActiveSlide,
  getDestinationElements,
  appendElements,
  commitHistoryTransaction,
}) {
  const insertPreset = useCallback(
    (presetOrId) => {
      const target = getActiveSlide()
      if (!target || target.locked) return null
      const cloned = cloneEducationPreset(presetOrId, {
        destinationElements: getDestinationElements(),
      })
      const elements = cloned.elements.map((element) =>
        element.type === 'game'
          ? createGameElement(element.gameType, element)
          : createElement(element.type, element)
      )
      // Flush the preceding edit/insert, not each element in this new bundle.
      commitHistoryTransaction()
      if (!appendElements(elements)) return null
      return { ...cloned, elements }
    },
    [getActiveSlide, getDestinationElements, appendElements, commitHistoryTransaction]
  )

  return { insertPreset }
}
