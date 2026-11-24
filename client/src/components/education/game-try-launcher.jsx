import { useState } from 'react'
import { getGameCapabilities } from 'revealjs-shared'
import { Button, ModalShell } from '../ui'
import NativeGameTryAdapter from './native-game-try-adapter'

export default function GameTryLauncher({ element, effectiveSlideId, variables }) {
  const [open, setOpen] = useState(false)
  if (!getGameCapabilities(element.gameType).local) return null
  return (
    <>
      <Button variant="secondary" className="w-full my-2" onClick={() => setOpen(true)}>
        Try game
      </Button>
      {open && (
        <ModalShell
          title="Try game"
          titleId="native-game-try-title"
          size="2xl"
          onClose={() => setOpen(false)}
        >
          <NativeGameTryAdapter
            element={element}
            effectiveSlideId={effectiveSlideId}
            variables={variables}
          />
        </ModalShell>
      )}
    </>
  )
}
