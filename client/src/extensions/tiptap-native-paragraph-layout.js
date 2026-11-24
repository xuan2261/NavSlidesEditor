import { Extension, Node } from '@tiptap/core'
import { sanitizeRichTextStyle } from 'revealjs-shared/src/rich-text-style-sanitizer.js'
import { attachNativeTabLayout } from 'revealjs-shared/src/native-tab-layout.js'
import { Plugin } from '@tiptap/pm/state'

const paragraphStyles = {
  nativeWhiteSpace: 'white-space',
  nativeTabSize: 'tab-size',
  nativeIndent: 'text-indent',
  nativeMarginLeft: 'margin-left',
  nativeBefore: 'padding-top',
  nativeAfter: 'padding-bottom',
  nativeMarginRight: 'margin-right',
  nativeMarginTop: 'margin-top',
  nativeMarginBottom: 'margin-bottom',
  nativeTabStops: '--pptx-tab-stops',
}
export const NativeParagraphLayout = Extension.create({
  name: 'nativeParagraphLayout',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'listItem'],
        attributes: Object.fromEntries(
          Object.entries(paragraphStyles).map(([key, property]) => [
            key,
            {
              default: null,
              parseHTML: (el) => el.style.getPropertyValue(property) || null,
              renderHTML: (attrs) => {
                const style = sanitizeRichTextStyle(`${property}:${attrs[key] || ''}`)
                return style ? { style } : {}
              },
            },
          ])
        ),
      },
    ]
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        view: (view) => {
          const attach = () =>
            view.dom.innerHTML.includes('--pptx-tab-stops')
              ? attachNativeTabLayout(view.dom)
              : () => {}
          let dispose = attach()
          return {
            update: (currentView, previousState) => {
              if (currentView.state.doc === previousState.doc) return
              dispose()
              dispose = attach()
            },
            destroy: () => dispose(),
          }
        },
      }),
    ]
  },
})
export const NativeTab = Node.create({
  name: 'nativeTab',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: false,
  parseHTML: () => [
    {
      tag: 'span',
      getAttrs: (el) =>
        el.style.getPropertyValue('--pptx-tab').trim() === '1' && el.textContent === '\t'
          ? {}
          : false,
    },
  ],
  renderHTML: () => ['span', { style: '--pptx-tab:1' }, '\t'],
  renderText: () => '\t',
  addNodeView() {
    return () => {
      const dom = document.createElement('span')
      dom.style.cssText =
        '--pptx-tab:1;display:inline-block;overflow:hidden;vertical-align:baseline;width:0px;height:0px;transition:none'
      dom.textContent = '\t'
      return {
        dom,
        ignoreMutation: (mutation) =>
          mutation.type === 'attributes' && mutation.attributeName === 'style',
      }
    }
  },
})
