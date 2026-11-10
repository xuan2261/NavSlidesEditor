// Task23 archive admission checks use coherent package hashes so semantic validation,
// rather than an incidental projection/hash mismatch, owns the rejection.
import JSZip from 'jszip'
import request from 'supertest'
import { createRequire } from 'node:module'
import { expect } from 'vitest'
import { editor } from '../../server/routes/portable-package-project-fixture.js'
const require = createRequire(import.meta.url)

export async function assertRejectedSemanticArchive({ current, initial, read, originalFor, failure }) {
  const before = await read()
  const state = current.store.getState()
  const archive = new JSZip()
  const bundle = await current.store.exportPresentationPackage(initial.id)
  const result = bundle.manifest.mutationResults.find(value =>
    value.generation === bundle.manifest.head.generation && value.projection)
  expect(result).toBeTruthy()
  const instance = Object.values(result.projection.pptxSemantic.instances)[0]
  if (failure === 'future') result.projection.pptxSemantic.schemaVersion = 99
  if (failure === 'missing-definition') instance.definitionId = 'not-a-source-definition'
  if (failure === 'cyclic') instance.parentInstanceId = instance.id
  if (failure === 'authority') instance.overrides.adapterQualified = true
  const { hashRecord } = require('../../server/services/pptx-import/package-store/schemas')
  bundle.manifest.head.projectionRevisionId = hashRecord(result.projection)
  archive.file('manifest.json', JSON.stringify({ version: '2.0', media: [], externalLinks: [] }), { createFolders: false })
  archive.file('presentation.json', JSON.stringify(result.projection), { createFolders: false })
  archive.file('package/manifest.json', JSON.stringify(bundle.manifest), { createFolders: false })
  for (const blob of bundle.blobs)
    archive.file(`package/blobs/${blob.sha256}`, blob.bytes, { createFolders: false })
  const rejected = await editor(request(current.app).post('/api/project-imports/preflight'))
    .attach('file', await archive.generateAsync({ type: 'nodebuffer' }), 'invalid-semantic.navslides')
  expect(rejected.status, JSON.stringify(rejected.body)).toBe(400)
  expect(rejected.body).not.toHaveProperty('sessionId')
  expect(rejected.body).not.toHaveProperty('capability')
  expect(current.store.getState()).toEqual(state)
  expect((await current.storage.readPresentations()).map(value => value.id)).toEqual([initial.id])
  expect((await read()).pptxSemantic).toEqual(before.pptxSemantic)
  expect((await read()).aggregateGeneration).toBe(before.aggregateGeneration)
  await current.runtime.shutdownPackageStore()
  current.store = await current.runtime.initializePackageStore({ rootDir: current.storage.DATA_DIR })
  expect((await read()).pptxSemantic).toEqual(before.pptxSemantic)
  await originalFor(initial.id)
}
