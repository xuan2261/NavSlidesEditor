const { assertSnapshotBudget, canonicalEditableSnapshot } = require('./canonical-snapshot')
const { cloneFrozen, isPlainRecord } = require('./own-plain-data')

function invalid(message) { throw new TypeError(`Invalid generic journal: ${message}`) }
function safeSnapshot(value, budgets) {
  try { return canonicalEditableSnapshot(cloneFrozen(value), budgets) } catch { invalid('snapshot') }
}
function list(value, name) { if (!Array.isArray(value)) invalid(name); return value }
function assertUniqueSnapshot(snapshot, budgets = {}) {
  assertSnapshotBudget(snapshot, budgets)
  const slideIds = new Set(); let elementCount = 0
  const optionalList = (value, name) => value === undefined ? [] : list(value, name)
  const visitSlides = (slides) => {
    for (const slide of list(slides, 'slides')) {
      if (!isPlainRecord(slide) || typeof slide.id !== 'string' || !slide.id || slideIds.has(slide.id)) invalid('duplicate slide identity')
      slideIds.add(slide.id)
      if (slideIds.size > (budgets.maxSlides ?? 500)) throw new RangeError('Snapshot slide budget exceeded')
      const ids = new Set()
      const visitElements = (elements) => {
        for (const element of optionalList(elements, 'elements')) {
          if (!isPlainRecord(element) || typeof element.id !== 'string' || !element.id || ids.has(element.id)) invalid('duplicate element identity')
          ids.add(element.id); elementCount += 1
          if (elementCount > (budgets.maxElements ?? 20000)) throw new RangeError('Snapshot element budget exceeded')
          visitElements(element.elements); visitElements(element.children)
        }
      }
      visitElements(slide.elements); visitSlides(optionalList(slide.children, 'children'))
    }
  }
  visitSlides(snapshot?.slides)
  return snapshot
}
function cloneReplaySnapshot(value) {
  try { return assertUniqueSnapshot(structuredClone(cloneFrozen(value))) } catch { invalid('snapshot') }
}
function findSlide(snapshot, slideId) {
  const matches = []
  const visit = (slides) => {
    for (const slide of slides) {
      if (slide.id === slideId) matches.push(slide)
      visit(slide.children || [])
    }
  }
  visit(snapshot.slides)
  if (matches.length > 1) invalid('ambiguous slide identity')
  return matches[0] || null
}
function findElement(elements, id, parent = null) {
  const found = []
  const visit = (items, owner) => {
    for (let index = 0; index < items.length; index += 1) {
      const element = items[index]
      if (element.id === id) found.push({ element, items, index, parent: owner })
      visit(element.elements || [], element); visit(element.children || [], element)
    }
  }
  visit(elements || [], parent)
  if (found.length > 1) invalid('ambiguous element identity')
  return found[0] || null
}
function elementList(slide, parentId, collectionKey) {
  if (parentId == null) return slide?.elements || null
  const parent = findElement(slide?.elements, parentId)?.element
  return parent ? collectionKey ? parent[collectionKey] || null : parent.elements || parent.children || null : null
}
function slideList(snapshot, parentSlideId) {
  return parentSlideId == null ? snapshot.slides : findSlide(snapshot, parentSlideId)?.children || null
}
module.exports = { assertUniqueSnapshot, cloneReplaySnapshot, elementList, findElement, findSlide, safeSnapshot, slideList }
