function focusExistingWindow(window) {
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.focus()
}

function acquireSingleInstance({ app, onSecondInstance }) {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return false
  }
  app.on('second-instance', onSecondInstance)
  return true
}

module.exports = {
  acquireSingleInstance,
  focusExistingWindow,
}
