import { createPluginPeerBridge } from '../../../shared/src/education/plugin-message-contract.js'

let data = {}
const valueElement = document.getElementById('value')
const labelElement = document.getElementById('label')
function render(nextData) {
  data = { ...data, ...nextData }
  const value = Number(data.value || 0)
  valueElement.textContent = `${data.prefix || ''}${value}${data.suffix || ''}`
  valueElement.style.color = data.color || '#22c55e'
  valueElement.style.fontSize = `${Number(data.fontSize || 64)}px`
  labelElement.textContent = data.label || ''
}
const peer = createPluginPeerBridge({
  peerWindow: window,
  parentWindow: window.parent,
  onData: render,
})
window.navslides = { updateData: (patch) => peer.updateData(patch) }
window.addEventListener('pagehide', () => peer.destroy(), { once: true })
