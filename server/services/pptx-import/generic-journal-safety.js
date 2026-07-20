const { canonicalEditableSnapshot } = require('./canonical-snapshot')
const { cloneFrozen, isPlainRecord } = require('./own-plain-data')

function invalid(message) { throw new TypeError(`Invalid generic journal: ${message}`) }
function safeSnapshot(value, budgets) {
  try { return canonicalEditableSnapshot(cloneFrozen(value), budgets) } catch { invalid('snapshot') }
}
function list(value, name) { if (!Array.isArray(value)) invalid(name); return value }
function assertUniqueSnapshot(snapshot) {
  const slides = list(snapshot?.slides, 'slides'); const slideIds = new Set()
  for (const slide of slides) {
    if (!isPlainRecord(slide) || typeof slide.id !== 'string' || slideIds.has(slide.id)) invalid('duplicate slide identity')
    slideIds.add(slide.id); const ids = new Set()
    const visit = (elements) => {
      for (const element of list(elements || [], 'elements')) {
        if (!isPlainRecord(element) || typeof element.id !== 'string' || ids.has(element.id)) invalid('duplicate element identity')
        ids.add(element.id); visit(element.elements || element.children || [])
      }
    }
    visit(slide.elements)
  }
  return snapshot
}
function cloneReplaySnapshot(value) {
  try { return assertUniqueSnapshot(structuredClone(cloneFrozen(value))) } catch { invalid('snapshot') }
}
function findSlide(snapshot, slideId) {
  const matches = snapshot.slides.filter((slide) => slide.id === slideId)
  if (matches.length > 1) invalid('ambiguous slide identity')
  return matches[0] || null
}
function findElement(elements, id, parent = null) {
  const found = []
  const visit = (items, owner) => {
    for (let index = 0; index < items.length; index += 1) {
      const element = items[index]
      if (element.id === id) found.push({ element, items, index, parent: owner })
      visit(element.elements || element.children || [], element)
    }
  }
  visit(elements || [], parent)
  if (found.length > 1) invalid('ambiguous element identity')
  return found[0] || null
}
function elementList(slide, parentId) {
  if (parentId == null) return slide?.elements || null
  const parent = findElement(slide?.elements, parentId)?.element
  return parent ? parent.elements || parent.children || null : null
}
module.exports = { assertUniqueSnapshot, cloneReplaySnapshot, elementList, findElement, findSlide, safeSnapshot }
