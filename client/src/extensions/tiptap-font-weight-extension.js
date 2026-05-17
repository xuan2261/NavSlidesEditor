import { Extension } from '@tiptap/core'

export const FontWeight = Extension.create({
  name: 'fontWeight',
  addOptions() {
    return { types: ['textStyle'] }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontWeight: {
            default: null,
            parseHTML: (el) => el.style.fontWeight || null,
            renderHTML: (attrs) =>
              attrs.fontWeight ? { style: `font-weight: ${attrs.fontWeight}` } : {},
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontWeight:
        (fontWeight) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontWeight }).run(),
      unsetFontWeight:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontWeight: null }).removeEmptyTextStyle().run(),
    }
  },
})
