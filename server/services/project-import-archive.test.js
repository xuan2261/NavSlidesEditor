import path from 'node:path'
import os from 'node:os'
import fs from 'fs-extra'
import JSZip from 'jszip'
import { afterEach, describe, expect, it } from 'vitest'
import archiveModule from './project-import-archive'
import crypto from 'node:crypto'
import nativeFixture from '../../shared/tests/fixtures/education-native-media.js'
import importedPresentation from './project-import-presentation'
import { buildArchiveMediaManifestEntries } from '../../client/src/utils/project-media-utils.js'
const { PROJECT_IMPORT_LIMITS, validateProjectArchive } = archiveModule

const tempPaths = []

async function archive(entries) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-import-'))
  tempPaths.push(root)
  const zip = new JSZip()
  for (const [name, value] of Object.entries(entries)) zip.file(name, value)
  const filePath = path.join(root, 'deck.navslides')
  await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }))
  return { filePath, stagingDir: path.join(root, 'staged') }
}

function presentation(extra = {}) {
  return JSON.stringify({
    title: 'Deck',
    slides: [{ id: 's1', elements: [] }],
    ...extra,
  })
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((entry) => fs.remove(entry)))
})

describe('project import archive validation', () => {
  it('admits real nested-only native ZIP bytes and preserves restored quiz, card, matching and layout mappings', async () => {
    const deck = nativeFixture.nativeMediaFixture()
    const names = [
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
    ]
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    )
    const bytes = new Map(
      names.map((name) => [nativeFixture.image(name).src, Buffer.concat([png, Buffer.from(name)])])
    )
    const media = buildArchiveMediaManifestEntries(deck).map((item) => ({
      ...item,
      byteLength: bytes.get(item.originalUrl).length,
      sha256: crypto.createHash('sha256').update(bytes.get(item.originalUrl)).digest('hex'),
      mimeType: 'image/png',
    }))
    const input = await archive({
      'manifest.json': JSON.stringify({ version: '1.1', media }),
      'presentation.json': JSON.stringify(deck),
      ...Object.fromEntries(media.map((item) => [item.archivePath, bytes.get(item.originalUrl)])),
    })
    const admitted = await validateProjectArchive(input.filePath, { stagingDir: input.stagingDir })
    expect(admitted.presentation).toEqual(deck)
    expect(admitted.media.map((item) => item.originalUrl).sort()).toEqual([...bytes.keys()].sort())
    for (const item of admitted.media) {
      expect(await fs.readFile(item.stagingPath)).toEqual(bytes.get(item.originalUrl))
      expect(item.sha256).toBe(
        crypto.createHash('sha256').update(bytes.get(item.originalUrl)).digest('hex')
      )
    }
    const restored = importedPresentation.buildImportedPresentation({
      presentation: admitted.presentation,
      placements: admitted.media.map((item) => ({
        ...item,
        filename: `restored-${path.basename(new URL(item.originalUrl).pathname)}`,
      })),
      intendedPresentationId: 'restored-deck',
      commitStartedAt: '2026-10-03T00:00:00.000Z',
      sessionId: 'native-import',
      payloadDigest: admitted.payloadDigest,
    })
    const slide = restored.slides[0]
    expect(slide.elements[0].quiz.questions[0].media.src).toBe('/uploads/restored-question.png')
    expect(slide.elements[0].quiz.questions[0].options[0].media.src).toBe(
      '/uploads/restored-option.png'
    )
    expect(slide.elements[0].quiz.questions[1].options.left[0].media.src).toBe(
      '/uploads/restored-left.png'
    )
    expect(slide.elements[0].quiz.questions[1].options.right[0].media.src).toBe(
      '/uploads/restored-right.png'
    )
    expect(slide.children[0].elements[0].memory.pairs[0].second.src).toBe(
      '/uploads/restored-memory-second.png'
    )
    expect(slide.children[0].elements[1].flashcards.cards[0].front.src).toBe(
      '/uploads/restored-front.png'
    )
    expect(slide.children[0].elements[1].flashcards.cards[0].back.src).toBe(
      '/uploads/restored-back.png'
    )
    expect(slide.layoutOverrides.elementPatches.matching.matching.pairs[0].promptMedia.src).toBe(
      '/uploads/restored-patch.png'
    )
    expect(restored.layoutMasters[0].fixedElements[0].matching.pairs[0].promptMedia.src).toBe(
      '/uploads/restored-prompt.png'
    )
    expect(restored.layoutMasters[0].fixedElements[0].matching.pairs[0].targetMedia.src).toBe(
      '/uploads/restored-target.png'
    )
    expect(restored.layoutMasters[0].placeholders[0].contentPolicy.elementDefaults.src).toBe(
      '/uploads/restored-placeholder.png'
    )
    expect(slide.elements[0].quiz.questions[0].answerKey).toEqual(
      deck.slides[0].elements[0].quiz.questions[0].answerKey
    )
  })

  it('rejects a manifest resource appearing only in an unknown native field before staging bytes', async () => {
    const deck = nativeFixture.nativeMediaFixture()
    deck.slides[0].elements[0].quiz.unknownMedia = nativeFixture.image('unknown')
    const input = await archive({
      'manifest.json': JSON.stringify({
        version: '1.1',
        media: [
          { archivePath: 'media/unknown.png', originalUrl: nativeFixture.image('unknown').src },
        ],
      }),
      'presentation.json': JSON.stringify(deck),
      'media/unknown.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    })
    await expect(
      validateProjectArchive(input.filePath, { stagingDir: input.stagingDir })
    ).rejects.toMatchObject({ code: 'PROJECT_MANIFEST_INVALID' })
    await expect(fs.pathExists(input.stagingDir)).resolves.toBe(false)
  })

  it('accepts the exact entry-count boundary and rejects boundary plus one', async () => {
    const base = {
      'manifest.json': JSON.stringify({ version: '1.1', media: [] }),
      'presentation.json': presentation(),
    }
    const accepted = await archive({ ...base, 'presentation.html': '<p>ok</p>' })
    await expect(
      validateProjectArchive(accepted.filePath, {
        stagingDir: accepted.stagingDir,
        limits: { ...PROJECT_IMPORT_LIMITS, maxEntries: 3 },
      })
    ).resolves.toMatchObject({ media: [] })

    const rejected = await archive({ ...base, 'presentation.html': 'x', 'media/a.png': 'x' })
    await expect(
      validateProjectArchive(rejected.filePath, {
        stagingDir: rejected.stagingDir,
        limits: { ...PROJECT_IMPORT_LIMITS, maxEntries: 3 },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_ARCHIVE_ENTRY_LIMIT', status: 413 })
  })

  it('rejects case-colliding paths before extraction', async () => {
    const input = await archive({
      'manifest.json': JSON.stringify({ version: '1.1', media: [] }),
      'presentation.json': presentation(),
      'media/a.png': 'a',
      'MEDIA/A.PNG': 'b',
    })
    await expect(
      validateProjectArchive(input.filePath, {
        stagingDir: input.stagingDir,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_ARCHIVE_STRUCTURE_INVALID' })
    await expect(fs.pathExists(input.stagingDir)).resolves.toBe(false)
  })

  it('rejects undeclared, missing, and executable media entries', async () => {
    const missing = await archive({
      'manifest.json': JSON.stringify({
        version: '1.1',
        media: [{ archivePath: 'media/missing.png', originalUrl: '/uploads/missing.png' }],
      }),
      'presentation.json': presentation({
        slides: [
          {
            id: 's1',
            elements: [
              {
                id: 'e1',
                type: 'image',
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                src: '/uploads/missing.png',
              },
            ],
          },
        ],
      }),
    })
    await expect(
      validateProjectArchive(missing.filePath, {
        stagingDir: missing.stagingDir,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_MEDIA_INVENTORY_MISMATCH' })

    const executable = await archive({
      'manifest.json': JSON.stringify({
        version: '1.1',
        media: [{ archivePath: 'media/run.exe', originalUrl: '/uploads/run.exe' }],
      }),
      'presentation.json': presentation(),
      'media/run.exe': 'MZ',
    })
    await expect(
      validateProjectArchive(executable.filePath, {
        stagingDir: executable.stagingDir,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_MEDIA_TYPE_REJECTED' })
  })

  it('requires acknowledgement for active author content without changing it', async () => {
    const html = '<script>window.demo = true</script>'
    const input = await archive({
      'manifest.json': JSON.stringify({ version: '1.1', media: [] }),
      'presentation.json': presentation({
        slides: [{ id: 's1', elements: [{ id: 'e1', type: 'html', content: html }] }],
      }),
    })
    await expect(
      validateProjectArchive(input.filePath, {
        stagingDir: input.stagingDir,
      })
    ).rejects.toMatchObject({
      code: 'ACTIVE_CONTENT_ACK_REQUIRED',
      activeContent: ['html-element'],
    })
    const result = await validateProjectArchive(input.filePath, {
      stagingDir: input.stagingDir,
      trustedAuthorActiveContentAcknowledged: true,
    })
    expect(result.presentation.slides[0].elements[0].content).toBe(html)
  })

  it('maps legacy v1.0 media by filename and reports compatibility warning', async () => {
    const input = await archive({
      'manifest.json': JSON.stringify({ version: '1.0' }),
      'presentation.json': presentation({
        slides: [
          {
            id: 's1',
            elements: [
              {
                id: 'e1',
                type: 'image',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                src: 'https://source.example/uploads/photo.png?version=legacy',
              },
            ],
          },
        ],
      }),
      'media/photo.png': 'legacy-image',
    })
    const result = await validateProjectArchive(input.filePath, {
      stagingDir: input.stagingDir,
    })
    expect(result.media[0].originalUrl).toBe(
      'https://source.example/uploads/photo.png?version=legacy'
    )
    expect(result.warnings).toEqual(['Imported legacy project archive version 1.0'])
  })
})
