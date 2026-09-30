import path from 'node:path'
import os from 'node:os'
import fs from 'fs-extra'
import JSZip from 'jszip'
import { afterEach, describe, expect, it } from 'vitest'
import archiveModule from './project-import-archive'
const {
  PROJECT_IMPORT_LIMITS,
  validateProjectArchive,
} = archiveModule

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
  it('accepts the exact entry-count boundary and rejects boundary plus one', async () => {
    const base = {
      'manifest.json': JSON.stringify({ version: '1.1', media: [] }),
      'presentation.json': presentation(),
    }
    const accepted = await archive({ ...base, 'presentation.html': '<p>ok</p>' })
    await expect(validateProjectArchive(accepted.filePath, {
      stagingDir: accepted.stagingDir,
      limits: { ...PROJECT_IMPORT_LIMITS, maxEntries: 3 },
    })).resolves.toMatchObject({ media: [] })

    const rejected = await archive({ ...base, 'presentation.html': 'x', 'media/a.png': 'x' })
    await expect(validateProjectArchive(rejected.filePath, {
      stagingDir: rejected.stagingDir,
      limits: { ...PROJECT_IMPORT_LIMITS, maxEntries: 3 },
    })).rejects.toMatchObject({ code: 'PROJECT_ARCHIVE_ENTRY_LIMIT', status: 413 })
  })

  it('rejects case-colliding paths before extraction', async () => {
    const input = await archive({
      'manifest.json': JSON.stringify({ version: '1.1', media: [] }),
      'presentation.json': presentation(),
      'media/a.png': 'a',
      'MEDIA/A.PNG': 'b',
    })
    await expect(validateProjectArchive(input.filePath, {
      stagingDir: input.stagingDir,
    })).rejects.toMatchObject({ code: 'PROJECT_ARCHIVE_STRUCTURE_INVALID' })
    await expect(fs.pathExists(input.stagingDir)).resolves.toBe(false)
  })

  it('rejects undeclared, missing, and executable media entries', async () => {
    const missing = await archive({
      'manifest.json': JSON.stringify({
        version: '1.1',
        media: [{ archivePath: 'media/missing.png', originalUrl: '/uploads/missing.png' }],
      }),
      'presentation.json': presentation({
        slides: [{
          id: 's1',
          elements: [{
            id: 'e1', type: 'image', x: 0, y: 0, width: 10, height: 10,
            src: '/uploads/missing.png',
          }],
        }],
      }),
    })
    await expect(validateProjectArchive(missing.filePath, {
      stagingDir: missing.stagingDir,
    })).rejects.toMatchObject({ code: 'PROJECT_MEDIA_INVENTORY_MISMATCH' })

    const executable = await archive({
      'manifest.json': JSON.stringify({
        version: '1.1',
        media: [{ archivePath: 'media/run.exe', originalUrl: '/uploads/run.exe' }],
      }),
      'presentation.json': presentation(),
      'media/run.exe': 'MZ',
    })
    await expect(validateProjectArchive(executable.filePath, {
      stagingDir: executable.stagingDir,
    })).rejects.toMatchObject({ code: 'PROJECT_MEDIA_TYPE_REJECTED' })
  })

  it('requires acknowledgement for active author content without changing it', async () => {
    const html = '<script>window.demo = true</script>'
    const input = await archive({
      'manifest.json': JSON.stringify({ version: '1.1', media: [] }),
      'presentation.json': presentation({
        slides: [{ id: 's1', elements: [{ id: 'e1', type: 'html', content: html }] }],
      }),
    })
    await expect(validateProjectArchive(input.filePath, {
      stagingDir: input.stagingDir,
    })).rejects.toMatchObject({
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
        slides: [{
          id: 's1',
          elements: [{
            id: 'e1',
            type: 'image',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            src: '/uploads/photo.png',
          }],
        }],
      }),
      'media/photo.png': 'legacy-image',
    })
    const result = await validateProjectArchive(input.filePath, {
      stagingDir: input.stagingDir,
    })
    expect(result.media[0].originalUrl).toBe('/uploads/photo.png')
    expect(result.warnings).toEqual(['Imported legacy project archive version 1.0'])
  })
})
