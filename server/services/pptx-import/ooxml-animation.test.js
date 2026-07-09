import { describe, expect, it } from 'vitest'
import { parseSlideAnimations, classifyUnsupportedPackageFeatures } from './ooxml-animation.js'

describe('ooxml-animation (T8.3 T8.6)', () => {
  it('T8.3 maps entrance fade preset to fragment hint', () => {
    const xml = `
      <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:timing>
          <p:tnLst>
            <p:par>
              <p:cTn>
                <p:childTnLst>
                  <p:animEffect transition="in" filter="fade" presetID="2" presetClass="entr"/>
                </p:childTnLst>
              </p:cTn>
            </p:par>
          </p:tnLst>
        </p:timing>
      </p:sld>`
    const result = parseSlideAnimations(xml)
    expect(result.animations.length).toBeGreaterThan(0)
    expect(result.fragmentHints).toContain('fade')
  })

  it('classifies unknown anim as unsupported-animation', () => {
    const xml = `<p:timing><p:animMotion path="M0,0 L1,1"/></p:timing>`
    const result = parseSlideAnimations(xml)
    expect(result.unsupported.some((u) => u.classification === 'unsupported-animation')).toBe(true)
  })

  it('T8.6 classifies macros and OLE entries', () => {
    const features = classifyUnsupportedPackageFeatures([
      'ppt/vbaProject.bin',
      'ppt/embeddings/oleObject1.bin',
      'ppt/activeX/activeX1.xml',
      'ppt/slides/slide1.xml',
    ])
    expect(features.some((f) => f.feature === 'macros')).toBe(true)
    expect(features.some((f) => f.feature === 'ole')).toBe(true)
    expect(features.some((f) => f.feature === 'activex')).toBe(true)
  })
})
