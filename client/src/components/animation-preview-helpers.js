import { resolveEffectiveSlide } from 'revealjs-shared'

export function getAnimationPreviewSteps(slide, layoutMasters) {
  const fragmentIndices = [
    ...new Set(
      (resolveEffectiveSlide(slide, layoutMasters).slide.elements || [])
        .filter((element) => element.fragment && !element.hidden)
        .map((element) =>
          Number.isFinite(element.fragmentIndex) && element.fragmentIndex > 0
            ? element.fragmentIndex
            : 1
        )
    ),
  ].sort((a, b) => a - b)

  return [0, ...fragmentIndices]
}

export function advanceAnimationPreviewStep(steps, currentStepIndex) {
  return Math.min(currentStepIndex + 1, Math.max(steps.length - 1, 0))
}

export function rewindAnimationPreviewStep(steps, currentStepIndex) {
  return Math.max(currentStepIndex - 1, 0)
}

export function getAnimationPreviewState(steps, currentStepIndex) {
  return {
    slideIndex: 0,
    verticalIndex: 0,
    // Reveal compacts rendered groups; authored orders are labels, not navigation coordinates.
    fragmentIndex: steps[currentStepIndex] === undefined ? -1 : currentStepIndex - 1,
  }
}

export function buildAnimationPreviewPresentation(presentation, slideIndex) {
  const currentSlide = presentation?.slides?.[slideIndex]

  return {
    ...presentation,
    presenterTools: null,
    slides: currentSlide
      ? [
          {
            ...currentSlide,
            children: [],
          },
        ]
      : [],
  }
}
