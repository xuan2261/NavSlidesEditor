import {
  generateRevealHTML,
  resolveEffectiveTransition,
} from 'revealjs-shared'

function getResolution(presentation) {
  const width = Number(presentation?.resolution?.width)
  const height = Number(presentation?.resolution?.height)
  return {
    width: Number.isFinite(width) && width > 0 ? width : 960,
    height: Number.isFinite(height) && height > 0 ? height : 540,
  }
}

function formatSlideAddress(parentIndex, verticalIndex = 0) {
  return verticalIndex > 0
    ? `${parentIndex + 1}.${verticalIndex}`
    : `${parentIndex + 1}`
}

function flattenPreviewSlide(slide) {
  if (!slide?.children?.length) return slide
  const flattened = { ...slide }
  delete flattened.children
  return flattened
}

export function resolveTransitionPreviewSlides({
  presentation,
  currentSlideIndex = 0,
  verticalEdit = null,
}) {
  const slides = Array.isArray(presentation?.slides) ? presentation.slides : []
  const fallbackIndex = Number.isInteger(currentSlideIndex) ? currentSlideIndex : 0
  let parentIndex = Math.min(Math.max(fallbackIndex, 0), Math.max(slides.length - 1, 0))
  let childIndex = null
  const trackedParentIndex = verticalEdit?.parentId
    ? slides.findIndex((slide) => slide?.id === verticalEdit.parentId)
    : -1

  if (trackedParentIndex >= 0) parentIndex = trackedParentIndex
  if (trackedParentIndex >= 0 && Number.isInteger(verticalEdit?.child)) {
    const child = slides[parentIndex]?.children?.[verticalEdit.child]
    if (child) childIndex = verticalEdit.child
  }

  const parentSlide = slides[parentIndex]
  const currentSlide = childIndex === null
    ? parentSlide
    : parentSlide?.children?.[childIndex]
  let nextSlide = null
  let nextParentIndex = parentIndex
  let nextVerticalIndex = 0

  if (childIndex !== null && childIndex + 1 < (parentSlide?.children?.length || 0)) {
    nextSlide = parentSlide.children[childIndex + 1]
    nextVerticalIndex = childIndex + 2
  } else if (childIndex === null && (parentSlide?.children?.length || 0) > 0) {
    nextSlide = parentSlide.children[0]
    nextVerticalIndex = 1
  } else {
    nextSlide = slides[parentIndex + 1] || null
    nextParentIndex = parentIndex + 1
  }

  return {
    currentSlide,
    nextSlide,
    currentAddress: formatSlideAddress(parentIndex, childIndex === null ? 0 : childIndex + 1),
    nextAddress: nextSlide ? formatSlideAddress(nextParentIndex, nextVerticalIndex) : null,
  }
}

export function buildTransitionPreviewPresentation({
  presentation,
  currentSlide,
  nextSlide,
  transitionOverride,
}) {
  const effective = resolveEffectiveTransition({
    presentation,
    currentSlide,
    nextSlide,
  })
  const targetSlide = flattenPreviewSlide({
    ...nextSlide,
    transition: transitionOverride || effective.transition,
    transitionDirection: effective.direction === 'default' ? undefined : effective.direction,
    transitionDuration: effective.duration === null ? undefined : effective.duration,
  })
  return {
    ...presentation,
    autoSlide: 0,
    autoSlideLoop: false,
    kioskMode: false,
    transition: effective.transition,
    transitionSpeed: effective.speed,
    resolution: getResolution(presentation),
    slides: [flattenPreviewSlide(currentSlide), targetSlide],
  }
}

export function buildTransitionPreviewHtml(options) {
  const previewPresentation = buildTransitionPreviewPresentation(options)
  const html = generateRevealHTML(previewPresentation)
  const replayScript = `<script>
(function() {
  function replay() {
    if (typeof Reveal === 'undefined' || !Reveal.on) return;
    var advance = function() { setTimeout(function() { Reveal.next(); }, 800); };
    if (Reveal.isReady && Reveal.isReady()) advance();
    else Reveal.on('ready', advance);
  }
  replay();
})();
</script>`
  return {
    html: html.replace('</body>', `${replayScript}</body>`),
    effective: resolveEffectiveTransition({
      presentation: options.presentation,
      currentSlide: options.currentSlide,
      nextSlide: options.nextSlide,
    }),
    resolution: previewPresentation.resolution,
  }
}
