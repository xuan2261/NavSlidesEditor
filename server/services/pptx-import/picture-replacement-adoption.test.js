// @vitest-environment node
import fs from 'fs-extra'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { pictureFixture, pixels } from '../../../tests/pptx-semantic/semantic-picture-fixture'
const require = createRequire(import.meta.url)
const { applyPresentationProjectionOperation } = require('../../../shared/src/pptx-projection-operation')
const { compactSemanticGraph } = require('../../../shared/src/pptx-semantic-source-graph')
const { semanticInstance } = require('../../../shared/src/pptx-semantic-records')
const originalEnv = { data: process.env.SLIDES_DATA_DIR, uploads: process.env.SLIDES_UPLOADS_DIR }
let root, storage, sessions, validation, updateSession
function resetServerModules() {
  const serverRoot = `${path.resolve(path.dirname(require.resolve('../storage')), '..')}${path.sep}`
  for (const key of Object.keys(require.cache)) if (key.startsWith(serverRoot)) delete require.cache[key]
}
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'picture-adoption-'))
  process.env.SLIDES_DATA_DIR = path.join(root, 'data')
  process.env.SLIDES_UPLOADS_DIR = path.join(root, 'uploads')
  resetServerModules()
  storage = require('../storage')
  storage.initDataFiles()
  await storage.withUploadHashes(() => {})
  sessions = { ...require('../project-import-media-session'), ...require('../project-import-media-session-recovery') }
  validation = require('./picture-replacement-validation')
  updateSession = require('../project-import-media-session-store').updateSession
})
afterEach(async () => {
  await require('./package-store-runtime').shutdownPackageStore()
  if (originalEnv.data === undefined) delete process.env.SLIDES_DATA_DIR
  else process.env.SLIDES_DATA_DIR = originalEnv.data
  if (originalEnv.uploads === undefined) delete process.env.SLIDES_UPLOADS_DIR
  else process.env.SLIDES_UPLOADS_DIR = originalEnv.uploads
  resetServerModules()
  await fs.remove(root)
})
function replace(presentation, replacement, index = 0) {
  const element = presentation.slides[0].elements[index]
  return applyPresentationProjectionOperation(presentation, { type: 'picture.edit',
    instanceId: element.pptxInstanceId, componentId: element.pptxPicture.componentId,
    command: { type: 'replace', replacement, expectedReplacement: null } })
}
function receipt(presentation, index = 0) {
  const element = presentation.slides[0].elements[index]
  const instance = semanticInstance(presentation.pptxSemantic, element.pptxInstanceId)
  const componentId = element.pptxPicture?.componentId || Object.keys(instance?.overrides?.components || {})[0]
  return instance?.overrides?.components?.[componentId]?.picture?.replacement
}
async function fixture({ mutate = value => value, mediaUrl = '/uploads/replacement.png', batch = false, schema = 2, reused = false } = {}) {
  const { presentation: source, zip } = await pictureFixture({ uploadsDir: storage.UPLOADS_DIR })
  const original = await zip.generateAsync({ type: 'nodebuffer' })
  const replacement = { kind: 'uploaded-picture', presentationId: source.id, filename: 'replacement.png',
    sha256: createHash('sha256').update(pixels).digest('hex'), width: 1, height: 1 }
  let presentation = replace(source, mutate({ ...replacement }))
  if (batch) presentation = replace(presentation, { ...replacement, filename: 'missing.png' }, 1)
  if (schema === 3) presentation.pptxSemantic = compactSemanticGraph(presentation.pptxSemantic)
  const stagingPath = path.join(root, 'replacement.png')
  await fs.writeFile(stagingPath, pixels)
  if (reused) {
    const ownership = require('../media-placement-ownership')
    await ownership.placeMedia({ ownerId: 'seed', bytes: pixels, originalName: 'replacement.png', sourceKey: 'seed' })
    await ownership.commitOwner('seed', 'prior')
  }
  const admitted = await sessions.createProjectImportSession({ archiveDigest: 'a'.repeat(64), payloadDigest: 'b'.repeat(64),
    presentation, media: mediaUrl === null ? [] : [{ archivePath: 'media/replacement.png', originalUrl: mediaUrl,
      filename: 'replacement.png', mimeType: 'image/png', stagingPath }], activeContent: [],
    trustedAuthorActiveContentAcknowledged: false })
  await sessions.stageProjectImportMedia(admitted)
  return { admitted, source, original, zip, replacement }
}
describe('project import picture receipt adoption boundary', () => {
  it.each([
    ['absent placement', { mediaUrl: null }],
    ['unrelated placement', { mediaUrl: '/uploads/unrelated.png' }],
    ['forged digest', { mutate: value => ({ ...value, sha256: 'f'.repeat(64) }) }],
    ['forged width', { mutate: value => ({ ...value, width: 2 }) }],
    ['forged height', { mutate: value => ({ ...value, height: 2 }) }],
    ['one unmatched receipt in a batch', { batch: true }],
  ])('rejects %s during real recovery before mutating any upload ownership', async (_label, options) => {
    const { admitted } = await fixture(options)
    const committing = await sessions.beginProjectImportCommit(admitted)
    const hashes = await fs.readFile(storage.UPLOAD_HASHES_FILE)
    const before = structuredClone(committing.presentation)
    await expect(sessions.recoverProjectImport(committing)).rejects.toMatchObject({ code: 'INVALID_PPTX_SEMANTIC_DOCUMENT' })
    expect(await fs.readFile(storage.UPLOAD_HASHES_FILE)).toEqual(hashes)
    expect(await storage.readPresentations()).toEqual([])
    const retained = await sessions.readProjectImportSession(admitted.sessionId)
    expect(retained.state).toBe('reconcile-required')
    expect(retained.presentation).toEqual(before)
  })
  it.each([[2, false], [3, false], [2, true], [3, true]])('publishes shared schema %i replacements (reused=%s), validates save, and preserves Original/source', async (schema, reused) => {
    const { admitted, source, original, zip, replacement } = await fixture({ schema, reused })
    await updateSession(admitted.sessionId, current => ({ record: { ...current,
      presentation: replace(current.presentation, replacement, 1) } }))
    const result = await sessions.publishProjectImport({ ...admitted, trustedAuthorActiveContentAcknowledged: false })
    const [stored] = await storage.readPresentations()
    const placed = (await sessions.readProjectImportSession(admitted.sessionId)).placements[0]
    expect(result.status).toBe('committed')
    expect(receipt(stored)).toEqual({ ...replacement, presentationId: result.presentationId, filename: placed.filename })
    expect(receipt(stored, 1)).toEqual(receipt(stored))
    await expect(validation.validatePictureReplacements(stored)).resolves.toBeUndefined()
    expect(stored.pptxSemantic.definitions).toEqual(schema === 3
      ? compactSemanticGraph(source.pptxSemantic).definitions : source.pptxSemantic.definitions)
    expect(await fs.readFile(path.join(storage.UPLOADS_DIR, path.basename(source.slides[0].elements[0].src)))).toEqual(pixels)
    expect(await zip.generateAsync({ type: 'nodebuffer' })).toEqual(original)
    expect(await sessions.publishProjectImport({ ...admitted, trustedAuthorActiveContentAcknowledged: false })).toEqual(result)
  })
  it('recovers a checkpoint already rebound to destination filenames without granting an unplaced upload', async () => {
    const { admitted } = await fixture()
    const committing = await sessions.beginProjectImportCommit(admitted)
    await validation.adoptProjectImportPictureReplacements(committing.presentation,
      committing.intendedPresentationId, committing.placements)
    const { buildImportedPresentation } = require('../project-import-presentation')
    const { updateSession } = require('../project-import-media-session-store')
    const rebound = buildImportedPresentation(committing)
    await updateSession(admitted.sessionId, current => ({ record: { ...current, presentation: rebound } }))
    const result = await sessions.recoverProjectImport(await sessions.readProjectImportSession(admitted.sessionId))
    expect(result.status).toBe('committed')
    const [stored] = await storage.readPresentations()
    expect(receipt(stored)).toEqual(receipt(rebound))
    await expect(validation.validatePictureReplacements(stored)).resolves.toBeUndefined()
  })
  it.each(['duplicate URL', 'unsafe filename', 'wrong path', 'wrong placement digest', 'ungranted rebound',
    'changed bytes', 'missing bytes', 'unowned placement', 'foreign origin'])(
    'rejects %s atomically at the adoption consumer', async problem => {
      const { admitted } = await fixture()
      const record = await sessions.beginProjectImportCommit(admitted)
      const placements = structuredClone(record.placements)
      if (problem === 'duplicate URL') placements.push({ ...placements[0], filename: 'other.png' })
      if (problem === 'unsafe filename') placements[0].filename = '../escape.png'
      if (problem === 'wrong path') placements[0].absolutePath = path.join(root, 'replacement.png')
      if (problem === 'wrong placement digest') placements[0].sha256 = 'e'.repeat(64)
      if (problem === 'changed bytes') await fs.writeFile(placements[0].absolutePath, Buffer.concat([pixels, Buffer.from('tampered')]))
      if (problem === 'missing bytes') await fs.remove(placements[0].absolutePath)
      if (problem === 'unowned placement') await storage.withUploadHashes(hashes => { hashes.global = {} })
      if (problem === 'foreign origin') placements[0].originalUrl = 'https://foreign.example/uploads/replacement.png'
      if (problem === 'ungranted rebound') {
        const { rewritePresentationMedia } = require('../project-import-presentation')
        record.presentation = rewritePresentationMedia(record.presentation,
          { '/uploads/replacement.png': `/uploads/${placements[0].filename}` }, record.intendedPresentationId)
      }
      const before = structuredClone(record.presentation)
      const hashes = await fs.readFile(storage.UPLOAD_HASHES_FILE)
      await expect(validation.adoptProjectImportPictureReplacements(record.presentation,
        record.intendedPresentationId, placements)).rejects.toMatchObject({ code: 'INVALID_PPTX_SEMANTIC_DOCUMENT' })
      expect(await fs.readFile(storage.UPLOAD_HASHES_FILE)).toEqual(hashes)
      expect(record.presentation).toEqual(before)
    })
})
