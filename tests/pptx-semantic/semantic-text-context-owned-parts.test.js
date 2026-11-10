import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { fixture, slide, layout, master } from './semantic-text-style-context-fixture'

const require = createRequire(import.meta.url)
const { buildSemanticInventory } = require('../../server/services/pptx-import/semantic-inventory')
const { createContextSourceFactory } = require('../../server/services/pptx-import/ooxml-semantic-text-context-source')
const { readSemanticTextStyleContext, buildSemanticTextStyleContexts } = require('../../server/services/pptx-import/ooxml-semantic-text-context')
const masterRelations = 'ppt/slideMasters/_rels/arbitrary.xml.rels'

async function request() {
  const zip = await fixture(), inventory = await buildSemanticInventory(zip)
  const occurrenceIds = [slide, layout, master].map((part) => inventory.occurrences.find((o) =>
    o.definitionId === `${part}#shape:${part === slide ? 2 : part === layout ? 8 : 4}`).id)
  return { zip, inventory, occurrenceIds }
}

it('rejects source tree mutation and keeps occurrence receipts independent', async () => {
  const { zip, inventory } = await request()
  const factory = createContextSourceFactory(zip, inventory)
  const first = factory.createSource(), second = factory.createSource()
  const a = await first.part(master), b = await second.part(master)
  const nativeLocal = b.root.children[0].local
  expect(Reflect.set(a.root.children[0], 'local', 'forged')).toBe(false)
  expect(b.root.children[0].local).toBe(nativeLocal)
  a.receipt(a.root)
  const before = structuredClone(first.provenance)
  b.receipt(b.root.children[0])
  await second.related(b, 'theme')
  expect(first.provenance).toEqual(before)
  expect(first.relationships).toEqual([])
})

it('preserves exact standalone receipt order and independently mutable result data', async () => {
  const input = await request()
  const standalone = []
  for (const occurrenceId of input.occurrenceIds)
    standalone.push(await readSemanticTextStyleContext({ ...input, occurrenceId }))
  const batch = await buildSemanticTextStyleContexts(input)
  expect(batch).toEqual(standalone)
  const later = structuredClone(batch[1])
  batch[0].relationships[0].source.path = 'forged'
  batch[0].provenance[0].source.path = 'forged'
  batch[0].theme.colors.dk1 = 'FFFFFF'
  batch[0].paragraphs[0].run.entries.find((e) => e.kind === 'masterList').properties.color.transforms[0].value = 0
  expect(batch[1]).toEqual(later)
})

it('owns inventory and selection before the first asynchronous read', async () => {
  const input = await request()
  const selected = [...input.occurrenceIds]
  const pending = buildSemanticTextStyleContexts(input)
  input.occurrenceIds.push('not-an-occurrence')
  input.inventory.occurrences.forEach((o) => { o.relationshipChain[0] = 'forged' })
  input.inventory.definitions.forEach((d) => { d.componentLocators[0].path = [999] })
  const contexts = await pending
  expect(contexts.map((c) => c.occurrenceId)).toEqual(selected)
  expect(contexts.map((c) => c.relationships.map((r) => r.relationshipId))).toEqual(
    selected.map(() => ['actualSlide', 'actualLayout', 'actualMaster', 'actualTheme'])
  )
})

it.each([master, masterRelations])('rehashes reused %s before every occurrence', async (part) => {
  const { zip, inventory } = await request()
  const factory = createContextSourceFactory(zip, inventory)
  await factory.createSource().part(master)
  zip.file(part, (await zip.file(part).async('string')) + ' ')
  await expect(factory.createSource().part(master)).rejects.toMatchObject({
    code: 'PPTX_SEMANTIC_ADMISSION_FAILED', sourceLocation: { partUri: part },
  })
})

it('does not reuse parsed authority across independent calls with changed inventory or bytes', async () => {
  const input = await request()
  await buildSemanticTextStyleContexts(input)
  const source = input.inventory.definitions.find((d) => d.id === `${master}#shape:4`)
  const original = source.componentLocators[0].path
  source.componentLocators[0].path = [0]
  await expect(buildSemanticTextStyleContexts(input)).rejects.toThrow(/stale definition/)
  source.componentLocators[0].path = original
  input.zip.file(master, (await input.zip.file(master).async('string')) + ' ')
  await expect(buildSemanticTextStyleContexts(input)).rejects.toThrow(/stale part/)
})
