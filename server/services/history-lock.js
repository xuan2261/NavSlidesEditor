const historyTails = new Map()

async function withHistoryLock(presentationId, action) {
  const previous = historyTails.get(presentationId) || Promise.resolve()
  let release
  const current = new Promise((resolve) => { release = resolve })
  historyTails.set(presentationId, current)
  await previous
  try {
    return await action()
  } finally {
    release()
    if (historyTails.get(presentationId) === current) historyTails.delete(presentationId)
  }
}

module.exports = { withHistoryLock }
