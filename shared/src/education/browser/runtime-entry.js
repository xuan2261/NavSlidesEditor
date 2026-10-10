const { mount } = require('./mount.js')
const { attachRevealLifecycle } = require('./reveal-lifecycle.js')
const { createLiveHostTransport } = require('./live-host-transport.js')
if (typeof window !== 'undefined')
  window.__navslidesEducationTransport = createLiveHostTransport(window)
function boot() {
  const reveal = window.Reveal
  if (!reveal || !document.querySelector('.reveal .slides')) return
  const ready = () => attachRevealLifecycle(document, reveal, window.__navslidesEducationTransport)
  if (reveal.isReady()) ready()
  else reveal.on('ready', ready)
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot, { once: true })
  else boot()
}
module.exports = { mount }
