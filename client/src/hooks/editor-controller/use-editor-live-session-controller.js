import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { showError } from '../../utils/app-feedback'
import { createPresenterPopupBridge } from '../../utils/presenter-popup-bridge'

export function useEditorLiveSessionController({
  presentationId,
  setShowLiveModal,
  activeGameElement,
  currentGameType,
}) {
  const presentationIdRef = useRef(presentationId)
  const routeGenerationRef = useRef(0)
  const popupBridgeRef = useRef(null)
  const [liveRoomCode, setLiveRoomCode] = useState(null)
  const [livePresenterToken, setLivePresenterToken] = useState(null)
  const [liveRemoteToken, setLiveRemoteToken] = useState(null)
  const [liveSpeakerToken, setLiveSpeakerToken] = useState(null)
  const [livePresentationId, setLivePresentationId] = useState(null)

  const getPresenterPopupBridge = useCallback(() => {
    if (typeof window === 'undefined') return null
    if (!popupBridgeRef.current) {
      popupBridgeRef.current = createPresenterPopupBridge(window.location.origin)
    }
    return popupBridgeRef.current
  }, [])

  const isPresenterPopupActive = useCallback(
    () => getPresenterPopupBridge()?.isActiveFor(presentationId) === true,
    [getPresenterPopupBridge, presentationId]
  )
  const isLiveSessionForCurrentPresentation = livePresentationId === presentationId
  const currentLiveRemoteToken = isLiveSessionForCurrentPresentation ? liveRemoteToken : null
  const currentLiveSpeakerToken = isLiveSessionForCurrentPresentation ? liveSpeakerToken : null
  const currentLiveRoomCode = isLiveSessionForCurrentPresentation ? liveRoomCode : null
  const currentLivePresenterToken = isLiveSessionForCurrentPresentation ? livePresenterToken : null

  useEffect(() => {
    const popupBridge = getPresenterPopupBridge()
    if (!popupBridge) return undefined
    const handlePopupMessage = (event) => popupBridge.handleMessage(event)
    window.addEventListener('message', handlePopupMessage)
    return () => {
      window.removeEventListener('message', handlePopupMessage)
      popupBridge.clear()
    }
  }, [getPresenterPopupBridge, presentationId])

  useLayoutEffect(() => {
    presentationIdRef.current = presentationId
    routeGenerationRef.current += 1
    setLivePresentationId(null)
    setLiveRoomCode(null)
    setLivePresenterToken(null)
    setLiveRemoteToken(null)
    setLiveSpeakerToken(null)
    setShowLiveModal(false)
  }, [presentationId, setShowLiveModal])

  const handleStartLive = useCallback(async () => {
    const requestPresentationId = presentationIdRef.current
    const requestRouteGeneration = routeGenerationRef.current
    const isCurrentRequest = () => (
      requestPresentationId === presentationIdRef.current &&
      requestRouteGeneration === routeGenerationRef.current
    )

    try {
      const response = await fetch('/api/live/room', { method: 'POST' })
      if (!isCurrentRequest()) return
      if (!response.ok) throw new Error('Live room creation failed')
      const data = await response.json()
      if (
        typeof data?.roomCode !== 'string' ||
        !data.roomCode ||
        typeof data?.presenterToken !== 'string' ||
        !data.presenterToken ||
        typeof data?.remoteToken !== 'string' ||
        !data.remoteToken ||
        typeof data?.speakerToken !== 'string' ||
        !data.speakerToken
      ) {
        throw new Error('Invalid response')
      }
      setLivePresentationId(requestPresentationId)
      setLiveRoomCode(data.roomCode)
      setLivePresenterToken(data.presenterToken)
      setLiveRemoteToken(data.remoteToken)
      setLiveSpeakerToken(data.speakerToken)
      setShowLiveModal(true)
    } catch {
      if (isCurrentRequest()) showError('Failed to create live room')
    }
  }, [setShowLiveModal])

  const handlePresenterWindowOpened = useCallback(
    ({ presenterWindow, presentationId: openedPresentationId, roomCode }) => {
      if (openedPresentationId !== presentationId || roomCode !== currentLiveRoomCode) return
      getPresenterPopupBridge()?.register({
        presenterWindow,
        presentationId: openedPresentationId,
        roomCode,
      })
    },
    [currentLiveRoomCode, getPresenterPopupBridge, presentationId]
  )
  const emitGameShortcutAction = useCallback(
    (action, payload = {}) => {
      if (!activeGameElement || typeof window === 'undefined') return
      const detail = { action, elementId: activeGameElement.id, gameType: currentGameType, ...payload }
      window.dispatchEvent(new CustomEvent('navslides:game-shortcut', { detail }))
      getPresenterPopupBridge()?.post({
        type: 'navslides:game-shortcut',
        presentationId,
        detail,
      })
    },
    [activeGameElement, currentGameType, getPresenterPopupBridge, presentationId]
  )

  return {
    currentLiveRoomCode,
    currentLivePresenterToken,
    currentLiveRemoteToken,
    currentLiveSpeakerToken,
    getPresenterPopupBridge,
    handlePresenterWindowOpened,
    handleStartLive,
    isPresenterPopupActive,
  }
}
