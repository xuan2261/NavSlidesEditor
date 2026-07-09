// Windows cold fork + NODE_PATH scan can exceed 1s; keep bounded but realistic.
const DEFAULT_ACK_TIMEOUT_MS = 15_000

function getWorkerAckTimeoutMs(value = process.env.PPTX_WORKER_ACK_MS, fallback = DEFAULT_ACK_TIMEOUT_MS) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function isParserWorkerResult(message) {
  return Boolean(message && typeof message === 'object' && typeof message.ok === 'boolean')
}

function isReadyMessage(message) {
  return Boolean(message && typeof message === 'object' && message.type === 'ready')
}

function isProgressMessage(message) {
  return Boolean(message && typeof message === 'object' && message.type === 'progress')
}

function waitForAck(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Parser worker did not send ready within ${timeoutMs}ms`))
    }, timeoutMs)

    const onMessage = (message) => {
      if (!isReadyMessage(message)) return
      cleanup()
      resolve()
    }
    const onExit = (code, signal) => {
      cleanup()
      reject(new Error(`Parser worker exited before ready (${signal || code})`))
    }
    const onError = (err) => {
      cleanup()
      reject(err)
    }
    const cleanup = () => {
      clearTimeout(timer)
      child.off('message', onMessage)
      child.off('exit', onExit)
      child.off('error', onError)
    }

    child.on('message', onMessage)
    child.once('exit', onExit)
    child.once('error', onError)
  })
}

module.exports = {
  getWorkerAckTimeoutMs,
  isParserWorkerResult,
  isProgressMessage,
  isReadyMessage,
  waitForAck,
}
