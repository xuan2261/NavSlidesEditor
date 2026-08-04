export function handleRibbonKeyboardActivation(event, action) {
  if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return false
  event.preventDefault()
  action?.()
  return true
}
