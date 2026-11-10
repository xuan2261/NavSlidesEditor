import { describe, expect, it } from 'vitest'
import styleResolution from '../../shared/src/pptx-geometry-style-resolution'
import semantic from '../../shared/src/pptx-semantic-presentation'
import { importTableFixture, linkedTableShape } from './table-import-fixture'

const cases = [
  [
    'reflection',
    '<a:reflection dist="9525" stA="50000" endA="0" rotWithShape="0"/>',
    [{ kind: 'reflection', dist: 9525, stA: 50000, endA: 0, rotWithShape: false }],
  ],
  [
    'preset shadow',
    '<a:prstShdw prst="shdw1" dist="0" dir="0"><a:srgbClr val="123456"/></a:prstShdw>',
    [
      {
        kind: 'prstShdw',
        prst: 'shdw1',
        dist: 0,
        dir: 0,
        color: { kind: 'srgb', value: '123456' },
      },
    ],
  ],
  [
    'fill overlay',
    '<a:fillOverlay blend="mult"><a:solidFill><a:srgbClr val="123456"/></a:solidFill></a:fillOverlay>',
    [{ kind: 'fillOverlay', blend: 'mult', fill: { color: { kind: 'srgb', value: '123456' } } }],
  ],
  [
    'ordered effects',
    '<a:blur rad="0" grow="0"/><a:glow rad="19050"><a:srgbClr val="123456"/></a:glow><a:reflection dist="9525"/>',
    [
      { kind: 'blur', rad: 0, grow: false },
      { kind: 'glow', rad: 19050, color: { kind: 'srgb', value: '123456' } },
      { kind: 'reflection', dist: 9525 },
    ],
  ],
]
const dag =
  '<a:effectDag type="sib" name="authored"><a:effect ref="brush"/><a:cont name="brush" type="tree"><a:blur rad="0" grow="0"/></a:cont></a:effectDag>'
function graphic(effect) {
  return linkedTableShape.replace('</p:spPr>', `${effect}</p:spPr>`)
}
function effective(presentation) {
  const document = presentation.pptxSemantic
  const instanceId = presentation.slides[0].elements[0].pptxInstanceId
  return document.schemaVersion === 2
    ? styleResolution.materializeGeometry(document, instanceId)
    : document.definitions[document.instances[instanceId].definitionId].content.geometry
}

describe.each([false, true])('effect programs through actual projector (linked=%s)', (linked) => {
  it.each(cases)('imports %s with exact optional fields', async (_, xml, expected) => {
    const { presentation, hash } = await importTableFixture({
      graphic: graphic(`<a:effectLst>${xml}</a:effectLst>`),
      geometryInheritance: linked,
    })
    expect(effective(presentation).style.effects).toEqual({ kind: 'list', effects: expected })
    const instance = Object.values(presentation.pptxSemantic.instances)[0]
    expect(
      presentation.pptxSemantic.definitions[instance.definitionId].source.preconditionHash
    ).toBe(hash)
    const serialized = JSON.parse(JSON.stringify(presentation))
    expect(semantic.normalizeSemanticPresentation(serialized)).toEqual(serialized)
  })

  it('imports and reopens a forward-referenced authored DAG', async () => {
    const { presentation } = await importTableFixture({
      graphic: graphic(dag),
      geometryInheritance: linked,
    })
    expect(effective(presentation).style.effects).toEqual({
      kind: 'dag',
      type: 'sib',
      name: 'authored',
      effects: [
        { kind: 'effect', ref: 'brush' },
        {
          kind: 'cont',
          name: 'brush',
          type: 'tree',
          effects: [{ kind: 'blur', rad: 0, grow: false }],
        },
      ],
    })
    const serialized = JSON.parse(JSON.stringify(presentation))
    expect(semantic.normalizeSemanticPresentation(serialized)).toEqual(serialized)
  })
})
