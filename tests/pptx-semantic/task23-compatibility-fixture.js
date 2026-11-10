// Task23 test fixture: target initialization, diagnostic projection commit, and teardown.
import path from 'node:path'
import fs from 'fs-extra'
import request from 'supertest'
import { createRequire } from 'node:module'
import { expect } from 'vitest'
import { pictureFixture } from './semantic-picture-fixture.js'
import { roots, root, target, reset, editor, binary, sha } from '../../server/routes/portable-package-project-fixture.js'

const require = createRequire(import.meta.url)

export function createCompatibilityFixture({ schemaVersion = 1 } = {}) {
  const prior = { data: process.env.SLIDES_DATA_DIR, uploads: process.env.SLIDES_UPLOADS_DIR }
  const context = {
    current: null,
    original: null,
    initial: null,
  }

  context.read = async (id = context.initial.id) => {
    const response = await request(context.current.app).get(`/api/presentations/${id}`)
    expect(response.status, JSON.stringify(response.body)).toBe(200)
    return response.body
  }

  context.originalFor = async (id) => {
    const deck = await context.read(id)
    const response = await binary(request(context.current.app).get(`/api/presentations/${id}/pptx-original`)
      .set('If-Pptx-Generation', String(deck.aggregateGeneration)))
    expect(response.status).toBe(200)
    expect(response.headers['x-pptx-export-mode']).toBe('immutable-package-original')
    expect(response.headers['x-pptx-original-sha256']).toBe(sha(context.original))
    expect(response.body).toEqual(context.original)
  }

  context.save = async (deck, key) => {
    return editor(request(context.current.app).put(`/api/presentations/${deck.id}`))
      .set('Idempotency-Key', key).send(deck)
  }

  context.cropped = (deck) => {
    const leaf = deck.slides[0].elements[0]
    const { semanticInstance, semanticDefinition } = require('../../shared/src/pptx-semantic-records')
    const instance = semanticInstance(deck.pptxSemantic, leaf.pptxInstanceId)
    const picture = semanticDefinition(deck.pptxSemantic, instance.definitionId).content.pictureDocument
    const { applyPresentationProjectionOperation } = require('../../shared/src/pptx-projection-operation')
    return applyPresentationProjectionOperation(deck, {
      type: 'picture.edit', instanceId: leaf.pptxInstanceId,
      componentId: picture.componentId, command: { type: 'crop', edge: 'l', value: 750 },
    })
  }

  context.beforeEach = async () => {
    context.current = await target(await root())
    const fixture = await pictureFixture({ uploadsDir: context.current.storage.UPLOADS_DIR, geometryInheritance: schemaVersion !== 1 })
    context.original = await fixture.zip.generateAsync({ type: 'nodebuffer' })
    if (schemaVersion === 3) {
      const { compactSemanticGraph } = require('../../shared/src/pptx-semantic-source-graph')
      fixture.presentation.pptxSemantic = compactSemanticGraph(fixture.presentation.pptxSemantic)
    }
    const { stampImportedPresentationFields } = require('../../server/services/pptx-import/create-imported-presentation')
    const projection = stampImportedPresentationFields(fixture.presentation, {
      id: fixture.presentation.id, timestamp: '2026-01-01T00:00:00.000Z',
    })
    expect(projection.pptxSemantic.schemaVersion).toBe(schemaVersion)
    const mediaRecords = {}
    const { semanticDefinitions } = require('../../shared/src/pptx-semantic-records')
    for (const [, definition] of semanticDefinitions(projection.pptxSemantic)) {
      const media = definition.content.media
      if (!media) continue
      const filename = path.basename(media.src)
      const bytes = await fs.readFile(path.join(context.current.storage.UPLOADS_DIR, filename))
      expect(sha(bytes)).toBe(media.sha256)
      mediaRecords[media.sha256] = { filename, size: bytes.length, mimeType: 'image/png', sha256: media.sha256 }
    }
    await context.current.storage.withUploadHashes((hashes) => { hashes[projection.id] = mediaRecords })
    const { buildImportSourceMap } = require('../../server/services/pptx-import/source-map')
    const sourceMap = await buildImportSourceMap(projection, null, null)
    await context.current.runtime.withPackageStore((store) => store.commitImport(context.original, {
      jobId: 'semantic-compatibility', presentationId: projection.id, projection,
      compatibilityPresentation: projection, sourceMap,
    }))
    await context.current.runtime.drainPackageCompatibilityOutbox()
    context.initial = await context.read(projection.id)
  }

  context.afterEach = async () => {
    const failures = []
    try { await context.current?.runtime.shutdownPackageStore() } catch (error) { failures.push(error) }
    context.current = null
    for (const directory of roots.splice(0)) {
      try { await fs.remove(directory) } catch (error) { failures.push(error) }
    }
    for (const [name, value] of [['SLIDES_DATA_DIR', prior.data], ['SLIDES_UPLOADS_DIR', prior.uploads]]) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    reset()
    if (failures.length) throw new AggregateError(failures, 'Failed to clean up semantic compatibility fixture')
  }

  return context
}
