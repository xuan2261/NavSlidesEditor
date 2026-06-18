import { describe, expect, it } from 'vitest'
import { generateLatexIframeHtml } from './latex-element-renderer'

describe('latex element renderer', () => {
  it('[cap:element.latex depth:behavior] normalizes display math wrappers for preview rendering', () => {
    const html = generateLatexIframeHtml('\\[ E = mc^2 \\]')

    expect(html).toContain('E = mc^2')
    expect(html).not.toContain('\\\\[')
  })
})
