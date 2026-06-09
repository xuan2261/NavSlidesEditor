// Resolver for the editor's standalone document keydown listener.
//
// The shortcut registry (use-keyboard) owns find/replace and the chorded
// editor commands. This listener only retains responsibilities the registry
// does not model — currently the slide-sorter toggle — so the two paths never
// double-handle the same chord (which previously cancelled find/replace).

/**
 * @param {{ctrlKey?:boolean, metaKey?:boolean, shiftKey?:boolean, key?:string}} e
 * @returns {'toggle-sorter'|null}
 */
export function resolveLegacyEditorShortcut(e) {
  const ctrl = e.ctrlKey || e.metaKey
  if (!ctrl) return null
  if (e.shiftKey && e.key?.toLowerCase() === 's') return 'toggle-sorter'
  return null
}
