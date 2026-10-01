import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import shared from 'revealjs-shared'
import { ELEMENT_DEFAULTS, DEFAULT_POSITIONS } from '../../client/src/data/element-defaults.js'
import schemas from '../../server/middleware/schemas.js'
import { AgentError, id, object } from './contracts.mjs'

const properties = { properties: object }
const slideTarget = { slideId: id }
export const editOperation = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add_slide'), slide: object, at: z.number().int().positive().optional(), parentSlideId: id.optional() }).strict(),
  z.object({ op: z.literal('update_slide'), ...slideTarget, ...properties }).strict(),
  z.object({ op: z.literal('remove_slide'), ...slideTarget }).strict(),
  z.object({ op: z.literal('move_slide'), ...slideTarget, to: z.number().int().positive() }).strict(),
  z.object({ op: z.literal('add_element'), ...slideTarget, element: object }).strict(),
  z.object({ op: z.literal('update_element'), ...slideTarget, elementId: id, ...properties }).strict(),
  z.object({ op: z.literal('remove_element'), ...slideTarget, elementId: id }).strict(),
])

const fail = (code, message) => { throw new AgentError(code, message, 'Read the deck using get_presentation; use current IDs and inspect edit_presentation --help.') }
const has = (obj, field) => Object.hasOwn(obj, field)

export function makeElement(source) {
  const defaults = ELEMENT_DEFAULTS[source.type]
  const pos = DEFAULT_POSITIONS[source.type] || { x: 0, y: 0 }
  const size = { ...defaults, ...source }
  const result = { ...defaults, x: pos.x === 'center' ? (960 - size.width) / 2 : pos.x, y: pos.y === 'center' ? (540 - size.height) / 2 : pos.y, ...source, id: source.id || randomUUID() }
  return source.type === 'line' ? shared.normalizeLineElement(result) : result
}

export function makeSlide(source) {
  return { ...source, id: source.id || randomUUID(), elements: (source.elements || []).map(makeElement), ...(source.children ? { children: source.children.map(makeSlide) } : {}) }
}

function locate(slides, slideId) {
  for (let i = 0; i < slides.length; i++) {
    if (slides[i].id === slideId) return { slide: slides[i], siblings: slides, index: i }
    const found = locate(slides[i].children || [], slideId)
    if (found) return found
  }
  return null
}

function forbidIdentity(properties) {
  if (['id', 'type'].some((key) => has(properties, key))) fail('IMMUTABLE_IDENTITY', 'An edit cannot replace an existing ID or element type.')
}

export function validateSlideIdentities(slides) {
  const slideIds = new Set()
  const elementIds = new Set()
  function visit(items) {
    for (const slide of items) {
      if (!slide.id || slideIds.has(slide.id)) fail('DUPLICATE_ID', 'Every slide must have a unique nonempty ID.')
      slideIds.add(slide.id)
      for (const element of slide.elements || []) {
        if (!element.id || elementIds.has(element.id)) fail('DUPLICATE_ID', 'Every element must have a unique nonempty ID across the deck.')
        elementIds.add(element.id)
      }
      visit(slide.children || [])
    }
  }
  visit(slides)
}

export function applyEdits(presentation, operations) {
  const slides = structuredClone(presentation.slides || [])
  for (const op of operations) {
    if (op.op === 'add_slide') {
      const parent = op.parentSlideId ? locate(slides, op.parentSlideId)?.slide : null
      if (op.parentSlideId && !parent) fail('SLIDE_NOT_FOUND', 'Parent slide ID was not found.')
      const target = parent ? (parent.children ||= []) : slides
      const at = op.at === undefined ? target.length : op.at - 1
      if (at > target.length) fail('INVALID_POSITION', 'Insert position must be between 1 and slide count + 1.')
      target.splice(at, 0, makeSlide(op.slide))
      continue
    }
    const found = locate(slides, op.slideId)
    if (!found) fail('SLIDE_NOT_FOUND', `Slide ${op.slideId} was not found.`)
    const { slide, siblings, index } = found
    if (op.op === 'update_slide') {
      forbidIdentity(op.properties)
      Object.assign(slide, op.properties)
    } else if (op.op === 'remove_slide') {
      siblings.splice(index, 1)
    } else if (op.op === 'move_slide') {
      if (op.to > siblings.length) fail('INVALID_POSITION', 'Move destination must be within the sibling slide count.')
      siblings.splice(index, 1)
      siblings.splice(op.to - 1, 0, slide)
    } else if (op.op === 'add_element') {
      slide.elements ||= []
      slide.elements.push(makeElement(op.element))
    } else {
      const ei = (slide.elements || []).findIndex((e) => e.id === op.elementId)
      if (ei < 0) fail('ELEMENT_NOT_FOUND', `Element ${op.elementId} was not found on slide ${op.slideId}.`)
      if (op.op === 'remove_element') slide.elements.splice(ei, 1)
      else {
        forbidIdentity(op.properties)
        Object.assign(slide.elements[ei], op.properties)
        if (slide.elements[ei].type === 'line') slide.elements[ei] = shared.normalizeLineElement(slide.elements[ei])
      }
    }
  }
  validateSlideIdentities(slides)
  const parsed = schemas.updatePresentationSchema.parse({ slides, ...(presentation.layoutMasters ? { layoutMasters: presentation.layoutMasters } : {}) })
  return parsed.slides
}

export function requireGeneration(deck, expected) {
  if (expected !== undefined && expected !== deck.aggregateGeneration) {
    throw new AgentError('STALE_GENERATION', 'The deck generation changed or is not generation-backed.', 'Read current state and review the changes before editing.', 409)
  }
}
