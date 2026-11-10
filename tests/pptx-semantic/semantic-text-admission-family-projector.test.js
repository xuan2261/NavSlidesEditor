import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { familyFixture } from './semantic-family-adapter-fixture'

const require = createRequire(import.meta.url)
const { baselineAdapter } = require('../../server/services/pptx-import/semantic-projector')

describe('production projector typed family dispatch', () => {
  it.each([
    ['8', 'chart', 'chartDocument'],
    ['9', 'diagram', 'smartArtDocument'],
    ['10', 'equation', 'ommlDocument'],
  ])('dispatches genuine source owner %s to %s admission', async (id, kind, field) => {
    const context = await familyFixture(id)
    const result = await baselineAdapter(context)
    expect(result.kind).toBe(kind)
    expect(result.content[field]).toBeDefined()
    expect(result.mappedDefinitionIds).toContain(context.source.id)
    expect(result.components.every((component) => component.locator.preconditionHash)).toBe(true)
  })
})
