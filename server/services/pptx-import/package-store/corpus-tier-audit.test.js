import fs from 'node:fs/promises'
import path from 'node:path'
import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import auditModule from './corpus-tier-audit.js'
import inventoryModule from './opc-inventory.js'

const { auditCorpus } = auditModule
const { buildOpcInventory } = inventoryModule
const CORPUS = path.resolve('server/data/test-corpus')

describe('production OPC corpus tier audit', () => {
  it('classifies every complex object and unknown part with an explicit result', async () => {
    const result = await auditCorpus(CORPUS)

    expect(result).toEqual(expect.objectContaining({
      schemaVersion: 1,
      classified: true,
      decks: expect.any(Array),
    }))
    expect(result.decks.length).toBeGreaterThan(0)
    for (const deck of result.decks) {
      expect(deck.classified).toBe(true)
      for (const object of deck.objects) {
        expect(object.tier).toMatchObject({
          import: expect.any(String),
          editedExport: expect.any(String),
          originalRecovery: 'exact',
        })
        expect(object.preservation).toMatchObject({
          result: object.tier.editedExport,
          closure: { parts: expect.any(Array), relationships: expect.any(Array) },
        })
      }
    }
  }, 60_000)

  it('keeps every opaque object relationship closure byte-identical after an adjacent edit', async () => {
    const audit = await auditCorpus(CORPUS)
    for (const deck of audit.decks) {
      if (!deck.objects.length) continue
      const input = await fs.readFile(path.join(CORPUS, deck.deck))
      const source = await JSZip.loadAsync(input)
      const editedPackages = new Map()
      for (const object of deck.objects) {
        const protectedParts = new Set(object.preservation.closure.parts)
        const editable = Object.keys(source.files).find((name) =>
          /^ppt\/(?:presentation|slides\/slide\d+)\.xml$/.test(name) &&
          !protectedParts.has(name)) || Object.keys(source.files).find((name) =>
          /\.xml$/.test(name) && !protectedParts.has(name))
        expect(editable, `adjacent part for ${object.id}`).toBeTruthy()
        if (!editedPackages.has(editable)) {
          const before = await JSZip.loadAsync(input)
          const original = await before.file(editable).async('nodebuffer')
          before.file(editable, Buffer.concat([original, Buffer.from('\n')]))
          editedPackages.set(editable, await JSZip.loadAsync(
            await before.generateAsync({ type: 'nodebuffer' })
          ))
        }
        const edited = editedPackages.get(editable)
        for (const part of protectedParts) {
          const left = source.file(part)
          const right = edited.file(part)
          expect(Boolean(right), `${deck.deck}:${part}`).toBe(Boolean(left))
          if (left) {
            expect((await right.async('nodebuffer')).equals(
              await left.async('nodebuffer')
            ), `${deck.deck}:${part}`).toBe(true)
          }
        }
      }
    }
  }, 60_000)

  it('keeps normalized package-root corpus targets non-dangling', async () => {
    const decks = (await fs.readdir(CORPUS)).filter((name) => /\.pptx$/i.test(name))
    const rootTargets = []
    for (const deck of decks) {
      const inventory = await buildOpcInventory(path.join(CORPUS, deck))
      rootTargets.push(...inventory.relationships.filter((relationship) =>
        /^\/(?!\/)/.test(relationship.target || '')
      ))
    }

    expect(rootTargets).not.toHaveLength(0)
    for (const relationship of rootTargets) {
      expect(relationship.normalizedTarget).not.toMatch(/^\//)
      expect(relationship.dangling).toBe(false)
    }
  }, 60_000)
})
