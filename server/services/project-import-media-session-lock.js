const operations = new Map()

async function withProjectImportSessionLock(sessionId, action) {
  const previous = operations.get(sessionId) || Promise.resolve()
  let release
  const current = new Promise((resolve) => {
    release = resolve
  })
  const tail = previous.then(() => current)
  operations.set(sessionId, tail)
  await previous
  try {
    return await action()
  } finally {
    release()
    if (operations.get(sessionId) === tail) operations.delete(sessionId)
  }
}

module.exports = { withProjectImportSessionLock }
