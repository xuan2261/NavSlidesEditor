import { useEffect } from 'react'
import monokaiCSS from '../../../../node_modules/highlight.js/styles/monokai.min.css?raw'
import githubDarkCSS from '../../../../node_modules/highlight.js/styles/github-dark.min.css?raw'
import atomOneDarkCSS from '../../../../node_modules/highlight.js/styles/atom-one-dark.min.css?raw'
import tokyoNightCSS from '../../../../node_modules/highlight.js/styles/tokyo-night-dark.min.css?raw'
import vs2015CSS from '../../../../node_modules/highlight.js/styles/vs2015.min.css?raw'
import nightOwlCSS from '../../../../node_modules/highlight.js/styles/night-owl.min.css?raw'
import anOldHopeCSS from '../../../../node_modules/highlight.js/styles/an-old-hope.min.css?raw'
import atomOneLightCSS from '../../../../node_modules/highlight.js/styles/atom-one-light.min.css?raw'
import githubCSS from '../../../../node_modules/highlight.js/styles/github.min.css?raw'
import vsCSS from '../../../../node_modules/highlight.js/styles/vs.min.css?raw'

const CODE_THEME_CSS = {
  monokai: monokaiCSS,
  'github-dark': githubDarkCSS,
  'atom-one-dark': atomOneDarkCSS,
  'tokyo-night-dark': tokyoNightCSS,
  vs2015: vs2015CSS,
  'night-owl': nightOwlCSS,
  'an-old-hope': anOldHopeCSS,
  'atom-one-light': atomOneLightCSS,
  github: githubCSS,
  vs: vsCSS,
}

export function useEditorPreviewStylesController({ codeTheme, customCSS }) {
  useEffect(() => {
    let style = document.getElementById('hljs-theme-css')
    if (!style) {
      style = document.createElement('style')
      style.id = 'hljs-theme-css'
      document.head.appendChild(style)
    }
    style.textContent = CODE_THEME_CSS[codeTheme || 'monokai'] || CODE_THEME_CSS.monokai
  }, [codeTheme])

  useEffect(() => {
    let style = document.getElementById('custom-template-css')
    if (!style) {
      style = document.createElement('style')
      style.id = 'custom-template-css'
      document.head.appendChild(style)
    }
    style.textContent = customCSS || ''
    return () => {
      style.textContent = ''
    }
  }, [customCSS])
}
