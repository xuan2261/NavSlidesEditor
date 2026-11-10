// Kept self-contained: the generator embeds this function in its own Document.
function installSemanticPrintReadiness(win, autoPrint) {
  const document = win.document, nativePrint = win.print.bind(win)
  let resolveOther, rejectOther, autoPrinted = false, generation = 0
  const other = new Promise((resolve, reject) => { resolveOther = resolve; rejectOther = reject })
  other.catch(() => {})
  function update() {
    const token = ++generation
    win.__navslidesExportReady = false
    document.querySelector('#print-bar button')?.setAttribute('disabled', '')
    const handle = win.__navslidesSemanticOutput
    const ready = Promise.all([other, handle.ensureReady ? handle.ensureReady() : handle.ready])
      .then(() => {
        if (token !== generation || handle !== win.__navslidesSemanticOutput || handle.state !== 'ready')
          throw new Error('Semantic print generation replaced')
        win.__navslidesExportReady = true
        win.__navslidesExportError = null
        document.querySelector('#print-bar button')?.removeAttribute('disabled')
        if (autoPrint && !autoPrinted) { autoPrinted = true; nativePrint() }
      })
    ready.catch((error) => {
      if (token !== generation) return
      win.__navslidesExportReady = false
      win.__navslidesExportError = { code: 'semantic-output-print', message: error.message,
        issues: handle.issues }
    })
    win.__navslidesPrintReady = ready
    return ready
  }
  win.print = function () {
    return update().then(() => nativePrint())
  }
  win.addEventListener('navslides-semantic-output', update)
  update()
  return (promise) => Promise.resolve(promise).then(resolveOther, rejectOther)
}
module.exports = { installSemanticPrintReadiness }
