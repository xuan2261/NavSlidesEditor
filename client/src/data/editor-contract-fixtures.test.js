import { describe, expect, it } from 'vitest'
import {
  CONTRACT_ELEMENT_TYPES,
  buildEditorContractPresentation,
} from '../../../shared/tests/fixtures/editor-contract-fixtures'
import { ELEMENT_DEFAULTS } from './element-defaults'

describe('editor contract fixtures', () => {
  it('covers every canonical type with deterministic unique identifiers', () => {
    expect(CONTRACT_ELEMENT_TYPES).toEqual(Object.keys(ELEMENT_DEFAULTS))
    const first = buildEditorContractPresentation()
    const second = buildEditorContractPresentation()
    expect(second).toEqual(first)
    const ids = first.slides.flatMap((slide) => [
      ...(slide.elements || []).map((element) => element.id),
      ...(slide.children || []).flatMap((child) => child.elements.map((element) => element.id)),
    ])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps legacy slides free of additive action, layout, and media metadata', () => {
    const legacy = buildEditorContractPresentation().slides[1]
    expect(legacy).not.toHaveProperty('layoutId')
    expect(legacy.elements[0]).not.toHaveProperty('action')
    expect(legacy.elements[0]).not.toHaveProperty('tracks')
  })

  it('combines action, media, connector, layout, and vertical-slide metadata in one deck', () => {
    const presentation = buildEditorContractPresentation()
    const parent = presentation.slides[0]
    const child = parent.children[0]

    expect(parent.layoutId).toBe('contract-layout')
    expect(presentation.layoutMasters[0].fixedElements[0].id).toBe('contract-master-band')
    expect(parent.elements.find((element) => element.type === 'shape').action).toMatchObject({
      kind: 'next',
      label: 'Continue',
      hotspot: true,
    })
    expect(parent.elements.find((element) => element.type === 'video').tracks[0]).toMatchObject({
      kind: 'captions',
      srcLang: 'en',
    })
    expect(child.elements.find((element) => element.type === 'video').transcript).toBe(
      'Child video transcript'
    )
    expect(child.elements.find((element) => element.type === 'video').tracks[0].srcLang).toBe('en')
    expect(child.elements.find((element) => element.type === 'line').connections.start).toEqual({
      targetId: 'contract-child-image',
      anchor: 'e',
    })
  })
})
