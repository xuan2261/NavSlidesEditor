import { create } from 'zustand';

/** @typedef {import('../../../shared/src/types/presentation').Presentation} Presentation */
/** @typedef {import('../../../shared/src/types/presentation').Slide} Slide */
/** @typedef {import('../../../shared/src/types/presentation').BaseElement} BaseElement */

/**
 * @typedef {Object} PresentationStoreState
 * @property {Presentation|null} presentation - Current presentation data
 * @property {number} currentSlideIndex - Active slide index
 * @property {boolean} loading - Whether presentation is loading
 * @property {(p: Presentation) => void} setPresentation
 * @property {(idx: number) => void} setCurrentSlide
 * @property {(slideIndex: number, updates: Partial<Slide>) => void} updateSlide
 * @property {(elementId: string, updates: Partial<BaseElement>) => void} updateElement
 * @property {(element: BaseElement) => void} addElement
 * @property {(elementId: string) => void} deleteElement
 * @property {(slide: Slide, afterIndex: number) => void} addSlide
 * @property {(index: number) => void} deleteSlide
 * @property {(fromIndex: number, toIndex: number) => void} reorderSlides
 */

/** @type {import('zustand').UseBoundStore<import('zustand').StoreApi<PresentationStoreState>>} */
// eslint-disable-next-line unused-imports/no-unused-vars
export const usePresentationStore = create((set, get) => ({
  presentation: null,
  currentSlideIndex: 0,
  loading: true,
  
  // Actions
  setLoading: (loading) => set({ loading }),
  setPresentation: (p) => set({ presentation: p, loading: false }),
  setCurrentSlide: (idx) => set({ currentSlideIndex: idx }),
  
  updateSlide: (slideIndex, updates) => set(state => ({
    presentation: {
      ...state.presentation,
      slides: state.presentation.slides.map((s, i) =>
        i === slideIndex ? { ...s, ...updates } : s
      )
    }
  })),
  
  updateElement: (elementId, updates) => set(state => {
    const idx = state.currentSlideIndex;
    return {
      presentation: {
        ...state.presentation,
        slides: state.presentation.slides.map((s, i) =>
          i === idx ? {
            ...s,
            elements: s.elements.map(el =>
              el.id === elementId ? { ...el, ...updates } : el
            )
          } : s
        )
      }
    };
  }),
  
  addElement: (element) => set(state => {
    const idx = state.currentSlideIndex;
    return {
      presentation: {
        ...state.presentation,
        slides: state.presentation.slides.map((s, i) =>
          i === idx ? { ...s, elements: [...s.elements, element] } : s
        )
      }
    };
  }),
  
  deleteElement: (elementId) => set(state => {
    const idx = state.currentSlideIndex;
    return {
      presentation: {
        ...state.presentation,
        slides: state.presentation.slides.map((s, i) =>
          i === idx ? {
            ...s,
            elements: s.elements.filter(el => el.id !== elementId)
          } : s
        )
      }
    };
  }),
  
  // Slide management
  addSlide: (slide, afterIndex) => set(state => {
    const slides = [...state.presentation.slides];
    slides.splice(afterIndex + 1, 0, slide);
    return {
      presentation: { ...state.presentation, slides },
      currentSlideIndex: afterIndex + 1
    };
  }),
  
  deleteSlide: (index) => set(state => {
    if (state.presentation.slides.length <= 1) return state;
    const slides = state.presentation.slides.filter((_, i) => i !== index);
    return {
      presentation: { ...state.presentation, slides },
      currentSlideIndex: Math.min(state.currentSlideIndex, slides.length - 1)
    };
  }),
  
  reorderSlides: (fromIndex, toIndex) => set(state => {
    const slides = [...state.presentation.slides];
    const [moved] = slides.splice(fromIndex, 1);
    slides.splice(toIndex, 0, moved);
    return {
      presentation: { ...state.presentation, slides },
      currentSlideIndex: toIndex
    };
  }),
}));
