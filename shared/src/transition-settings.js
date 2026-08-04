const TRANSITION_TYPES = Object.freeze(['none', 'fade', 'slide', 'convex', 'concave', 'zoom'])
const TRANSITION_DIRECTIONS = Object.freeze(['default', 'left', 'right', 'up', 'down'])
const TRANSITION_SPEEDS = Object.freeze(['default', 'fast', 'slow'])
const MAX_TRANSITION_DURATION_MS = 10000

function normalizeTransition(value, fallback = 'slide') {
  return TRANSITION_TYPES.includes(value) ? value : fallback
}

function normalizeTransitionDirection(value) {
  return TRANSITION_DIRECTIONS.includes(value) ? value : 'default'
}

function normalizeTransitionDuration(value) {
  if (value === '' || value === null || value === undefined) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.min(MAX_TRANSITION_DURATION_MS, Math.max(0, Math.round(parsed)))
}

function normalizeTransitionSpeed(value) {
  return TRANSITION_SPEEDS.includes(value) ? value : 'default'
}

function resolveEffectiveTransition({ presentation = {}, currentSlide, nextSlide } = {}) {
  const targetSlide = nextSlide || currentSlide || {}
  const presentationTransition = normalizeTransition(presentation.transition, 'slide')
  return {
    transition: normalizeTransition(targetSlide.transition, presentationTransition),
    direction: normalizeTransitionDirection(targetSlide.transitionDirection),
    duration: normalizeTransitionDuration(targetSlide.transitionDuration),
    speed: normalizeTransitionSpeed(presentation.transitionSpeed),
    autoSlide: Number.isFinite(Number(presentation.autoSlide))
      ? Math.max(0, Number(presentation.autoSlide))
      : 0,
    autoSlideLoop: presentation.autoSlideLoop === true,
    kioskMode: presentation.kioskMode === true,
  }
}

module.exports = {
  TRANSITION_TYPES,
  TRANSITION_DIRECTIONS,
  TRANSITION_SPEEDS,
  MAX_TRANSITION_DURATION_MS,
  normalizeTransition,
  normalizeTransitionDirection,
  normalizeTransitionDuration,
  normalizeTransitionSpeed,
  resolveEffectiveTransition,
}
