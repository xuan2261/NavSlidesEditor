import { useCallback, useEffect, useRef } from 'react'

function getDistance(first, second) {
  const dx = second.clientX - first.clientX
  const dy = second.clientY - first.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function readZoom(container) {
  const zoom = Number.parseFloat(container?.dataset.zoom)
  return Number.isFinite(zoom) ? zoom : 1
}

export function usePinchZoom({
  containerRef,
  onZoomChange,
  minZoom = 0.25,
  maxZoom = 4,
  enabled = true,
  onPinchStart,
  onPinchActiveChange,
}) {
  const contactsRef = useRef(new Map())
  const initialDistanceRef = useRef(0)
  const initialZoomRef = useRef(1)
  const latestZoomRef = useRef(1)
  const activeRef = useRef(false)

  const setActive = useCallback(
    (isActive) => {
      activeRef.current = isActive
      onPinchActiveChange?.(isActive)
    },
    [onPinchActiveChange]
  )

  const clear = useCallback(() => {
    contactsRef.current.clear()
    initialDistanceRef.current = 0
    setActive(false)
  }, [setActive])

  const rebaseline = useCallback(() => {
    const contacts = Array.from(contactsRef.current.values())
    setActive(contacts.length >= 2)
    if (contacts.length !== 2) {
      initialDistanceRef.current = 0
      return
    }
    const distance = getDistance(contacts[0], contacts[1])
    initialDistanceRef.current = distance > 0 ? distance : 0
    initialZoomRef.current = latestZoomRef.current || readZoom(containerRef.current)
  }, [containerRef, setActive])

  useEffect(() => {
    if (!enabled) clear()
    return clear
  }, [clear, enabled])

  const handlePointerDown = useCallback(
    (event) => {
      if (!enabled || event.pointerType !== 'touch') return
      const hadPinch = activeRef.current
      contactsRef.current.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      })
      if (!hadPinch && contactsRef.current.size === 2) {
        latestZoomRef.current = readZoom(containerRef.current)
        onPinchStart?.()
      }
      rebaseline()
    },
    [activeRef, containerRef, enabled, onPinchStart, rebaseline]
  )

  const handlePointerMove = useCallback(
    (event) => {
      if (!enabled || event.pointerType !== 'touch' || !contactsRef.current.has(event.pointerId)) return
      contactsRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })
      if (contactsRef.current.size !== 2 || initialDistanceRef.current <= 0) return
      const contacts = Array.from(contactsRef.current.values())
      const zoom = Math.min(
        maxZoom,
        Math.max(minZoom, initialZoomRef.current * (getDistance(contacts[0], contacts[1]) / initialDistanceRef.current))
      )
      latestZoomRef.current = zoom
      onZoomChange?.(zoom)
    },
    [enabled, maxZoom, minZoom, onZoomChange]
  )

  const handlePointerEnd = useCallback(
    (event) => {
      if (event.pointerType !== 'touch') return
      contactsRef.current.delete(event.pointerId)
      rebaseline()
    },
    [rebaseline]
  )

  return {
    containerProps: {
      onPointerDownCapture: handlePointerDown,
      onPointerMoveCapture: handlePointerMove,
      onPointerUpCapture: handlePointerEnd,
      onPointerCancelCapture: handlePointerEnd,
      onLostPointerCapture: handlePointerEnd,
      style: { touchAction: 'none' },
    },
  }
}
