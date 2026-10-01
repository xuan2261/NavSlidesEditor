import path from 'node:path'
import os from 'node:os'
import fs from 'fs-extra'
import JSZip from 'jszip'
import { afterEach, describe, expect, it } from 'vitest'
import archiveModule from './project-import-archive'
import jsonModule from './project-import-archive-json'

const { validateProjectArchive } = archiveModule
const { validateProjectJson } = jsonModule
const tempPaths = []

async function admitProject(format, presentation) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-import-content-'))
  tempPaths.push(root)
  const filePath = path.join(root, format === 'zip' ? 'deck.navslides' : 'deck.navslides.json')
  const manifest = { version: '1.1', media: [] }
  if (format === 'zip') {
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify(manifest))
    zip.file('presentation.json', JSON.stringify(presentation))
    await fs.writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }))
    return validateProjectArchive(filePath, { stagingDir: path.join(root, 'staged') })
  }
  await fs.writeJson(filePath, { ...manifest, presentation })
  return validateProjectJson(filePath)
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((entry) => fs.remove(entry)))
})

const malformedElements = [
  ['table', { data: {} }, 'data'],
  ['table', { data: [['valid'], {}] }, 'data'],
  ['markdown', { content: {} }, 'content'],
  ['code', { language: 17 }, 'language'],
]

for (const format of ['zip', 'json']) {
  describe(`${format} project preflight renderer field validation`, () => {
    for (const location of ['parent', 'child']) {
      it.each(malformedElements)(`rejects malformed %s on ${location} before admission`, async (type, fields, field) => {
        const slide = { id: 's1', elements: [{ id: 'e1', type, ...fields }] }
        const slides = location === 'child' ? [{ id: 'parent', elements: [], children: [slide] }] : [slide]
        const prefix = location === 'child' ? 'slides[0].children[0]' : 'slides[0]'
        await expect(admitProject(format, { title: 'Deck', slides })).rejects.toMatchObject({
          code: 'PROJECT_PRESENTATION_INVALID',
          status: 400,
          message: expect.stringContaining(`${prefix}.elements[0].${field}`),
        })
      })
    }

    it('preserves valid content and admits optional empty fields', async () => {
      const elements = [
        { id: 't1', type: 'table', data: [['Name', 'Value'], ['Count', 17]] },
        { id: 'm1', type: 'markdown', content: '```js\nconst t = **literal**\n```' },
        { id: 'c1', type: 'code', language: 'unknown-language' },
        { id: 't2', type: 'table', data: null },
        { id: 'm2', type: 'markdown', content: '' },
        { id: 'c2', type: 'code', language: '' },
      ]
      const presentation = {
        title: 'Deck',
        slides: [{ id: 'parent', elements: [], children: [{ id: 'child', elements }] }],
      }
      const result = await admitProject(format, presentation)
      expect(result.presentation).toEqual(presentation)
    })
  })
}
