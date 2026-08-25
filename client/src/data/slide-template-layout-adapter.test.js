import { describe, expect, it } from 'vitest'
import { SLIDE_TEMPLATES } from './slide-templates'
import { getSystemLayoutMaster, getSystemLayoutMasters } from './slide-template-layout-adapter'

describe('slide template layout adapter', () => {
  it('derives one deterministic read-only system layout per stable template key', () => {
    const first = getSystemLayoutMasters()
    const second = getSystemLayoutMasters()
    expect(first.map((layout) => layout.id)).toEqual(Object.keys(SLIDE_TEMPLATES))
    expect(second).toEqual(first)
    for (const id of Object.keys(SLIDE_TEMPLATES)) {
      expect(getSystemLayoutMaster(id)).toMatchObject({ id, system: true, name: SLIDE_TEMPLATES[id].label })
    }
  })
})
