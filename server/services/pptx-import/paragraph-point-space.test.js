import { describe, expect, it } from 'vitest'
import { parseXml } from './ooxml-text-run-xml.js'
import paragraphModule from './ooxml-native-text-style-paragraph.js'

const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const source = (attrs, stops = '') => parseXml(`<a:pPr xmlns:a="${A}" ${attrs}>${stops}</a:pPr>`)[0]

describe('paragraph coordinates share importer point space', () => {
  it.each([1, 0.75, 1.5])('converts defaults, margins, signed indent and explicit stops before scale %s', (scale) => {
    const node = source('indent="-457200" marL="304800" marR="152400" defTabSz="914400"',
      '<a:tabLst><a:tab pos="457200" algn="l"/><a:tab pos="1828800" algn="r"/></a:tabLst>')
    const { style, unsupported } = paragraphModule.nativeParagraphLayout([node], { x: scale, y: 2 }, true)
    expect(unsupported).toBe(false)
    expect(style).toMatchObject({
      'text-indent': `${-36 * scale}px`, 'margin-left': `${24 * scale}px`,
      'margin-right': `${12 * scale}px`, 'tab-size': `${72 * scale}px`,
      '--pptx-tab-stops': `${36 * scale}:l,${144 * scale}:r`,
    })
  })
})
