// Reveal may replace slide contents when entering or leaving responsive scroll view.
function attachMediaPlaybackRoot(root, attachPlayback) {
  const controllers = new Map()
  const selector = '[data-ns-media-playback]'
  function attach(media) {
    if (!root.contains(media) || controllers.has(media)) return
    controllers.set(
      media,
      attachPlayback(media, JSON.parse(media.getAttribute('data-ns-media-playback')))
    )
  }
  function attachTree(node) {
    if (node.nodeType !== 1) return
    if (node.matches(selector)) attach(node)
    node.querySelectorAll(selector).forEach(attach)
  }
  attachTree(root)
  const observer = new root.ownerDocument.defaultView.MutationObserver((records) => {
    if (records.some((record) => record.removedNodes.length)) {
      for (const [media, dispose] of controllers) {
        if (!root.contains(media)) {
          dispose()
          controllers.delete(media)
        }
      }
    }
    for (const record of records) record.addedNodes.forEach(attachTree)
  })
  observer.observe(root, { childList: true, subtree: true })
  return () => {
    observer.disconnect()
    controllers.forEach((dispose) => dispose())
    controllers.clear()
  }
}

module.exports = { attachMediaPlaybackRoot }
