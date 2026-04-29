import { create } from 'zustand'

/** @typedef {import('../../../shared/src/types/presentation').Presentation} Presentation */

/**
 * @typedef {Object} PresentationStoreState
 * @property {Presentation|null} presentation - Current presentation data
 * @property {boolean} loading - Whether presentation is loading
 * @property {(p: Presentation) => void} setPresentation
 * @property {(loading: boolean) => void} setLoading
 */

/** @type {import('zustand').UseBoundStore<import('zustand').StoreApi<PresentationStoreState>>} */
// eslint-disable-next-line unused-imports/no-unused-vars
export const usePresentationStore = create((set, get) => ({
  presentation: null,
  loading: true,

  setLoading: (loading) => set({ loading }),
  setPresentation: (p) => set({ presentation: p, loading: false }),
}))
