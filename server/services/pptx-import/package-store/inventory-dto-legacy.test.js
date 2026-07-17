import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { afterEach, describe, expect, it } from 'vitest'
import dto from './dto.js'
import inventory from './opc-inventory.js'
import storeModule from './index.js'

const { toEditorDto, toPublicDto, toProviderDto } = dto
const { buildOpcInventory } = inventory
const { openPackageStore } = storeModule
const dirs = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

async function makePptx(entries) {
  const zip = new JSZip()
  for (const [name, value] of Object.entries(entries)) zip.file(name, value)
  return zip.generateAsync({ type: 'nodebuffer' })
}

describe('OPC inventory and authority boundaries', () => {
  it('inventories unknown parts and preserves external relationship targets', async () => {
    const bytes = await makePptx({
      '[Content_Types].xml':
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/ppt/presentation.xml" ContentType="application/presentation"/>' +
        '</Types>',
      'ppt/presentation.xml': '<p:presentation/>',
      'ppt/_rels/presentation.xml.rels':
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="custom" Target="https://example.test/a" TargetMode="External"/>' +
        '<Relationship Id="rId2" Type="custom" Target="../custom/odd.bin"/>' +
        '</Relationships>',
      'ppt/custom/odd.bin': Buffer.from([1, 2, 3]),
    })
    const manifest = await buildOpcInventory(bytes)

    expect(manifest.parts.find((part) => part.path === 'ppt/custom/odd.bin')).toMatchObject({
      classification: 'unknown',
      size: 3,
    })
    expect(manifest.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetMode: 'External',
          target: 'https://example.test/a',
          external: true,
        }),
      ])
    )
    expect(manifest.securityFlags).toContain('external-relationship')
  })

  it('resolves a package-root relationship target without marking it dangling', async () => {
    const manifest = await buildOpcInventory(await makePptx({
      '[Content_Types].xml':
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/ppt/presentation.xml" ContentType="application/presentation"/>' +
        '</Types>',
      'ppt/presentation.xml': '<p:presentation/>',
      'ppt/slides/slide1.xml': '<p:sld/>',
      'ppt/charts/chart1.xml': '<c:chartSpace/>',
      'ppt/slides/_rels/slide1.xml.rels':
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="chart" Target="/ppt/charts/chart1.xml"/>' +
        '</Relationships>',
    }))

    expect(manifest.relationships).toContainEqual(expect.objectContaining({
      source: 'ppt/slides/slide1.xml',
      target: '/ppt/charts/chart1.xml',
      normalizedTarget: 'ppt/charts/chart1.xml',
      dangling: false,
    }))
  })

  it('allowlists editor/public/provider DTOs and strips authority fields', () => {
    const record = {
      id: 'rev-1',
      sha256: 'a'.repeat(64),
      byteLength: 42,
      generation: 3,
      uploadedAt: '2026-07-11T00:00:00.000Z',
      filePath: 'C:\\secret\\blob',
      capabilityHash: 'secret',
      fencingEpoch: 9,
      predecessorRoot: 'root-2',
    }
    expect(toEditorDto(record)).toEqual({
      id: 'rev-1',
      sha256: 'a'.repeat(64),
      byteLength: 42,
      generation: 3,
      uploadedAt: '2026-07-11T00:00:00.000Z',
    })
    expect(toPublicDto(record)).toEqual({ id: 'rev-1', byteLength: 42 })
    expect(toProviderDto(record)).toEqual({
      id: 'rev-1',
      sha256: 'a'.repeat(64),
      byteLength: 42,
    })
  })

  it('migrates legacy UUID originals while retaining exact bytes', async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'package-store-legacy-'))
    dirs.push(rootDir)
    const legacyDir = path.join(rootDir, 'pptx-originals')
    await fs.mkdir(legacyDir)
    const legacyId = '123e4567-e89b-12d3-a456-426614174000'
    const exact = Buffer.from([0, 80, 75, 3, 4, 255, 1])
    await fs.writeFile(path.join(legacyDir, `${legacyId}.pptx`), exact)

    const store = await openPackageStore({ rootDir })
    await store.acquireWriter()
    const migrated = await store.migrateLegacyOriginal(
      { id: legacyId, uploadedAt: '2026-07-10T00:00:00.000Z' },
      { ownerType: 'presentation', ownerId: 'deck-old' }
    )
    expect(await store.readOriginal(migrated.revision.id)).toEqual(exact)
    expect(await fs.readFile(path.join(legacyDir, `${legacyId}.pptx`))).toEqual(exact)
  })
})
