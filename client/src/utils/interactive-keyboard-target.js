const FORM_CONTROL_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'])
const MEDIA_CONTROL_TAGS = new Set(['AUDIO', 'VIDEO'])
const INTERACTIVE_ROLES = new Set([
  'button',
  'checkbox',
  'combobox',
  'dialog',
  'grid',
  'gridcell',
  'listbox',
  'menu',
  'menuitem',
  'option',
  'radio',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'textbox',
  'tree',
  'treeitem',
])

function ownsKeyboardDirectly(element) {
  if (!element) return false
  const tag = String(element.tagName || '').toUpperCase()
  if (FORM_CONTROL_TAGS.has(tag) || MEDIA_CONTROL_TAGS.has(tag)) return true
  if (tag === 'A' && element.hasAttribute?.('href')) return true
  if (tag === 'SUMMARY') return true
  if (element.isContentEditable) return true
  const contentEditableProperty = String(element.contentEditable || '').toLowerCase()
  if (
    contentEditableProperty &&
    contentEditableProperty !== 'false' &&
    contentEditableProperty !== 'inherit'
  )
    return true

  const contentEditable = element.getAttribute?.('contenteditable')
  if (contentEditable != null && contentEditable.toLowerCase() !== 'false') return true
  if (element.hasAttribute?.('popover')) return true

  const role = element.getAttribute?.('role')?.toLowerCase()
  return INTERACTIVE_ROLES.has(role)
}

/**
 * True when the focused target, or one of its ancestors, owns keyboard input.
 * Canvas/editor shortcuts must stand down for these targets.
 */
export function isInteractiveKeyboardTarget(target) {
  let current = target?.nodeType === 3 ? target.parentElement : target
  while (current) {
    if (ownsKeyboardDirectly(current)) return true
    current = current.parentElement
  }
  return false
}
