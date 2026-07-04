import { describe, expect, it } from 'vitest'
import { generateLatexIframeHtml } from './latex-element-renderer'

describe('latex element renderer', () => {
  it('[cap:element.latex depth:behavior] normalizes display math wrappers for preview rendering', () => {
    const html = generateLatexIframeHtml('\\[ E = mc^2 \\]')

    expect(html).toContain('E = mc^2')
    expect(html).not.toContain('\\\\[')
  })

  it('uses local vendor runtimes and escapes LaTeX/TikZ script-breakout content', () => {
    const latexHtml = generateLatexIframeHtml('</script><script>evil()</script>')
    const tikzHtml = generateLatexIframeHtml('\\begin{tikzpicture}</script><script>evil()</script>\\end{tikzpicture}')

    for (const html of [latexHtml, tikzHtml]) {
      expect(html).toContain('/vendor/katex/dist/katex.min.css')
      expect(html).toContain('/vendor/katex/dist/katex.min.js')
      expect(html).not.toContain('cdn.jsdelivr.net')
      expect(html).not.toContain('</script><script>evil()')
    }

    expect(tikzHtml).toContain('/vendor/tikzjax/fonts.css')
    expect(tikzHtml).toContain('/vendor/tikzjax/tikzjax.js')
    expect(tikzHtml).not.toContain('tikzjax.com')
    expect(tikzHtml).toContain('\\u003c/script>')
  })
})
