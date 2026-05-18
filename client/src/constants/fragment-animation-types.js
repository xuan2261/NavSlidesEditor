/**
 * Centralized fragment animation types for reveal.js fragments.
 * Used by: common-element-controls, AnimationTimeline, AnimationsTabContent.
 * Do NOT add zoom-out during this migration (deferred to follow-up).
 */
export const FRAGMENT_ANIMATION_TYPES = [
  { value: 'fade-in', label: 'Fade In' },
  { value: 'fade-out', label: 'Fade Out' },
  { value: 'fade-up', label: 'Fade Up' },
  { value: 'fade-down', label: 'Fade Down' },
  { value: 'fade-left', label: 'Fade Left' },
  { value: 'fade-right', label: 'Fade Right' },
  { value: 'strike', label: 'Strike' },
  { value: 'grow', label: 'Grow' },
  { value: 'shrink', label: 'Shrink' },
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'highlight-red', label: 'Highlight Red' },
  { value: 'highlight-green', label: 'Highlight Green' },
  { value: 'highlight-blue', label: 'Highlight Blue' },
]
