// @vitest-environment node
import http from 'node:http'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Blob as NodeBlob } from 'node:buffer'
import JSZip from 'jszip'
import { afterEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../shared/tests/fixtures/education-native-media.js'
import { exportProject } from './export-project.js'
import { rewriteProjectMediaUrls } from './project-media-utils.js'
import archive from '../../../server/services/project-import-archive.js'
import importer from '../../../server/services/project-import-presentation.js'
import references from '../../../shared/src/education/game-media-references.js'

// This suite exercises editable ZIP byte transport, not portable HTML closure.
vi.mock('./offlineExport', () => ({
  generateOfflineHTML: vi.fn(async () => '<!doctype html><title>Fixture attachment</title>'),
}))
import { generateOfflineHTML } from './offlineExport'

let server
let download
let installation
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6l8AAAAASUVORK5CYII=',
  'base64'
)
async function sourceInstallation() {
  const requests = []
  server = http.createServer((request, response) => {
    requests.push(request.url)
    if (request.url === '/uploads/missing.png') {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, { 'Content-Type': 'image/png' }).end(png)
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const origin = `http://127.0.0.1:${server.address().port}`
  vi.stubGlobal('window', { location: { origin } })
  vi.stubGlobal('Blob', NodeBlob)
  vi.stubGlobal('document', { createElement: () => ({ click() {} }) })
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    download = blob
    return 'blob:test'
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const deck = fixture.nativeMediaFixture()
  const map = Object.fromEntries(
    [
      'question',
      'option',
      'matching-question',
      'left',
      'right',
      'poll',
      'jeopardy',
      'patch',
      'target',
      'memory-first',
      'memory-second',
      'front',
      'back',
      'sorting',
      'prompt',
      'placeholder',
    ].map((name) => [fixture.image(name).src, `${origin}/uploads/${name}.png`])
  )
  return { deck: rewriteProjectMediaUrls(deck, map), requests }
}

afterEach(async () => {
  if (server)
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  if (installation) await fs.rm(installation, { recursive: true, force: true })
  installation = null
  server = null
  download = null
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('nested-only project archive bytes', () => {
  it('fetches actual source upload bytes once and stores every declared media file in ZIP', async () => {
    const { deck, requests } = await sourceInstallation()
    // Same media at another authored location must not duplicate requests or ZIP entries.
    deck.slides[0].children[0].elements[0].memory.pairs[1].first = {
      type: 'image',
      ...deck.slides[0].elements[0].quiz.questions[0].media,
    }
    await exportProject(deck)
    const zip = await JSZip.loadAsync(await download.arrayBuffer())
    const manifest = JSON.parse(await zip.file('manifest.json').async('text'))
    expect(manifest.media.map((entry) => new URL(entry.originalUrl).pathname).sort()).toEqual(
      requests.sort()
    )
    expect(new Set(requests).size).toBe(16)
    expect(manifest.hasLocalMedia).toBe(true)
    for (const entry of manifest.media)
      expect(Buffer.from(await zip.file(entry.archivePath).async('uint8array'))).toEqual(png)
    const restored = JSON.parse(await zip.file('presentation.json').async('text'))
    expect(restored.slides[0].elements[0].quiz.questions[0].media.src).toBe(
      deck.slides[0].elements[0].quiz.questions[0].media.src
    )
    // Admission must accept the exported native-only inventory, not just ordinary src fields.
    installation = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-native-roundtrip-'))
    const archivePath = path.join(installation, 'deck.navslides')
    await fs.writeFile(archivePath, Buffer.from(await download.arrayBuffer()))
    const admitted = await archive.validateProjectArchive(archivePath, {
      stagingDir: path.join(installation, 'staging'),
    })
    const placements = admitted.media.map((entry, i) => ({ ...entry, filename: `target-${i}.png` }))
    const target = importer.buildImportedPresentation({
      presentation: admitted.presentation,
      placements,
      intendedPresentationId: 'isolated-target',
      commitStartedAt: '2026-10-02T00:00:00.000Z',
      sessionId: 'native-roundtrip',
      payloadDigest: 'fixture',
    })
    const urls = new Map(
      placements.map((entry) => [entry.originalUrl, `/uploads/${entry.filename}`])
    )
    for (const ref of references.collectGameMediaReferences(deck)) {
      expect(ref.path.reduce((value, key) => value[key], target)).toBe(urls.get(ref.url))
    }
    for (const entry of admitted.media) expect(await fs.readFile(entry.stagingPath)).toEqual(png)
    expect(
      references.collectGameMediaReferences(target).some((ref) => /^https?:/.test(ref.url))
    ).toBe(false)
  })

  it('rejects unavailable nested bytes and reports the owning native path without downloading', async () => {
    const { deck } = await sourceInstallation()
    deck.slides[0].elements[0].quiz.questions[0].media.src = '/uploads/missing.png'
    await expect(exportProject(deck)).rejects.toMatchObject({
      code: 'PROJECT_MEDIA_ATTACHMENT_FAILED',
      failures: [
        expect.objectContaining({
          originalUrl: '/uploads/missing.png',
          references: [
            expect.objectContaining({
              path: ['slides', 0, 'elements', 0, 'quiz', 'questions', 0, 'media', 'src'],
            }),
          ],
        }),
      ],
    })
    expect(download).toBeFalsy()
  })

  it('reports failed portable HTML attachment instead of claiming complete archive success', async () => {
    const { deck } = await sourceInstallation()
    generateOfflineHTML.mockRejectedValueOnce(new Error('Required font unavailable'))
    await expect(exportProject(deck)).rejects.toMatchObject({
      code: 'PROJECT_HTML_ATTACHMENT_FAILED',
      message: expect.stringContaining('Required font unavailable'),
    })
    expect(download).toBeFalsy()
  })
})
