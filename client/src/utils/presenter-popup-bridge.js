const MAX_PENDING_MESSAGES = 20

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

function hasMatchingContext(message, record) {
  return (
    message?.presentationId === record.presentationId &&
    message?.roomCode === record.roomCode
  )
}

function hasMatchingPresentation(message, record) {
  return message?.presentationId === record.presentationId
}

function canUsePopup(presenterWindow) {
  try {
    return Boolean(
      presenterWindow &&
        !presenterWindow.closed &&
        typeof presenterWindow.postMessage === 'function'
    )
  } catch {
    return false
  }
}

function postToPopup(presenterWindow, message, origin) {
  try {
    presenterWindow.postMessage(message, origin)
    return true
  } catch {
    return false
  }
}

export function createPresenterPopupBridge(origin) {
  let record = null

  const clear = () => {
    record = null
  }

  const register = ({ presenterWindow, presentationId, roomCode }) => {
    if (
      !canUsePopup(presenterWindow) ||
      !isNonEmptyString(presentationId) ||
      !isNonEmptyString(roomCode)
    ) {
      return false
    }

    record = {
      presenterWindow,
      presentationId,
      roomCode,
      ready: false,
      queuedMessages: [],
    }
    return true
  }

  const post = (message) => {
    if (
      !record ||
      message?.type !== 'navslides:game-shortcut' ||
      !hasMatchingPresentation(message, record)
    ) {
      return false
    }
    if (!canUsePopup(record.presenterWindow)) {
      clear()
      return false
    }
    const scopedMessage = {
      ...message,
      presentationId: record.presentationId,
      roomCode: record.roomCode,
    }
    if (!record.ready) {
      if (record.queuedMessages.length >= MAX_PENDING_MESSAGES) return false
      record.queuedMessages.push(scopedMessage)
      return true
    }
    if (postToPopup(record.presenterWindow, scopedMessage, origin)) return true
    clear()
    return false
  }

  const handleMessage = (event) => {
    const message = event?.data
    if (
      !record ||
      event?.origin !== origin ||
      event?.source !== record.presenterWindow ||
      !['navslides:presenter-ready', 'navslides:presenter-unready'].includes(message?.type) ||
      !hasMatchingContext(message, record)
    ) {
      return false
    }
    if (!canUsePopup(record.presenterWindow)) {
      clear()
      return false
    }
    if (message.type === 'navslides:presenter-unready') {
      record.ready = false
      return true
    }
    if (record.ready) return true

    record.ready = true
    const queuedMessages = record.queuedMessages.splice(0)
    for (const queuedMessage of queuedMessages) {
      if (!postToPopup(record.presenterWindow, queuedMessage, origin)) {
        clear()
        return false
      }
    }
    return true
  }

  const isActiveFor = (presentationId) => {
    if (!record || record.presentationId !== presentationId) return false
    if (canUsePopup(record.presenterWindow)) return true
    clear()
    return false
  }

  return { clear, handleMessage, isActiveFor, post, register }
}
