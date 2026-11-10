import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { buildFeatureFixture } from './feature-fixtures.js'
import { buildGeometryFixture } from './geometry-fixtures.js'
import { pictureFixture } from './semantic-picture-fixture.js'
import { createSemanticMediaTimingFixture } from './semantic-media-timing-fixture.js'

export const require = createRequire(import.meta.url)
export const { applyPresentationProjectionOperation: apply } = require('../../shared/src/pptx-projection-operation')
export const { normalizeSemanticPresentation } = require('../../shared/src/pptx-semantic-presentation')
const { canonicalEditableSnapshot } = require('../../server/services/pptx-import/canonical-snapshot')
const { projectSemanticImport } = require('../../server/services/pptx-import/semantic-projector')
const { familyRootId, familyOperationType, materializeFamilyDocument } = require('../../shared/src/pptx-family-operations')
export const copy = value => JSON.parse(JSON.stringify(value))
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const reopen = value => normalizeSemanticPresentation(copy(canonicalEditableSnapshot(value)))
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
async function packageHashes(zip) {
  return Promise.all(Object.values(zip.files).filter(entry => !entry.dir).sort((a, b) => a.name.localeCompare(b.name))
    .map(async entry => [entry.name, digest(await entry.async('nodebuffer'))]))
}

// Core import/command/disk-JSON proofs only. No HTTP, browser, native rendering,
// upload authorization, or manifest/native fixture binding is inferred here.
export function proofSuite(provenance) {
  let seed, zip, hashes, directory
  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'semantic-operation-proof-'))
    if (provenance === 'semantic-picture-fixture.js') {
      const result = await pictureFixture({ uploadsDir: directory })
      zip = result.zip
      seed = reopen(result.presentation)
    } else {
      let slideIds
      if (provenance === 'semantic-media-timing-fixture.js') {
        zip = await createSemanticMediaTimingFixture()
        slideIds = ['source-slide']
      } else {
        const fixture = await (provenance === 'geometry-fixtures.js' ? buildGeometryFixture() : buildFeatureFixture())
        zip = await JSZip.loadAsync(fixture.buffer)
        slideIds = ['slide1', 'slide2']
      }
      const caller = { id: 'operation-proof', slides: slideIds.map(id => ({ id, elements: [] })) }
      const before = copy(caller)
      hashes = await packageHashes(zip)
      const result = await projectSemanticImport({ zip, uploadsDir: directory, geometryInheritance: true, presentation: caller })
      expect(caller).toEqual(before)
      expect(await packageHashes(zip)).toEqual(hashes)
      seed = reopen(result.presentation)
    }
    hashes = await packageHashes(zip)
    seed = freeze(seed)
  }, 60000)
  afterAll(async () => {
    if (directory) await rm(directory, { recursive: true, force: true })
  })
  return function proof(id, select, edit, assertResult, invalid) {
    const context = (presentation = seed) => {
      const instances = Object.values(presentation.pptxSemantic.instances)
      const instance = instances.find(item => select(presentation.pptxSemantic.definitions[item.definitionId], item))
      expect(instance, `${id} source target from ${provenance}`).toBeDefined()
      const definition = presentation.pptxSemantic.definitions[instance.definitionId]
      const slide = presentation.slides.find(item => item.id === instance.slideId)
      const element = slide.elements.find(item => item.pptxInstanceId === instance.id)
      expect(definition.source.preconditionHash).toMatch(/^[a-f0-9]{64}$/)
      return { presentation, instance, definition, slide, element, provenance, directory }
    }
    it(`${id}:edit-save-reload`, async () => {
      const c = context(), before = JSON.stringify(seed)
      const edited = await edit(c)
      const changed = edited.presentation ?? edited
      const affected = new Set(edited.affected ?? [c.instance.id])
      expect(changed).not.toEqual(seed)
      const filename = path.join(directory, `${id}.json`)
      await writeFile(filename, JSON.stringify(canonicalEditableSnapshot(changed)))
      const restored = normalizeSemanticPresentation(JSON.parse(await readFile(filename, 'utf8')))
      await assertResult(restored, c)
      expect(restored.pptxSemantic.definitions).toEqual(seed.pptxSemantic.definitions)
      expect(restored.pptxSemantic.styles).toEqual(seed.pptxSemantic.styles)
      expect(restored.pptxSemantic.fonts).toEqual(seed.pptxSemantic.fonts)
      for (const [key, instance] of Object.entries(seed.pptxSemantic.instances)) {
        if (!affected.has(key)) expect(restored.pptxSemantic.instances[key], `sibling ${key}`).toEqual(instance)
      }
      for (const slide of seed.slides) for (const element of slide.elements) {
        if (!affected.has(element.pptxInstanceId)) {
          expect(restored.slides.find(item => item.id === slide.id).elements.find(item => item.id === element.id), `sibling element ${element.id}`).toEqual(element)
        }
      }
      expect(JSON.stringify(seed)).toBe(before)
      expect(await packageHashes(zip)).toEqual(hashes)
    })
    it(`${id}:reject-invalid`, async () => {
      const c = context(copy(seed)), before = JSON.stringify(c.presentation)
      const sourceBefore = JSON.stringify(seed)
      expect(() => invalid(c)).toThrow()
      expect(JSON.stringify(c.presentation)).toBe(before)
      expect(JSON.stringify(seed)).toBe(sourceBefore)
      expect(reopen(c.presentation)).toEqual(seed)
      expect(await packageHashes(zip)).toEqual(hashes)
    })
  }
}
export const native = id => definition => definition.source?.nativeId === id && definition.source.partUri === 'ppt/slides/slide1.xml'
export const kind = value => definition => definition.kind === value
export function family(c, command, presentation = c.presentation) {
  return apply(presentation, { type: familyOperationType(c.definition), instanceId: c.instance.id,
    componentId: familyRootId(c.definition), command })
}
export function effective(presentation, c) {
  return materializeFamilyDocument(c.definition, presentation.pptxSemantic.instances[c.instance.id])
}
export function walk(node) { return [node, ...node.children.flatMap(walk)] }
