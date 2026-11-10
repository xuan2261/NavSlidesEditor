import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import worker from './parse-worker.js'
import fixtures from './nonnumeric-fixture.js'

const roots = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})
const text = (elements) => elements.map((element) => element.content || element.text || '').join('').replaceAll('&nbsp;', ' ')
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')

describe('valid arbitrary OOXML basenames in the real worker', () => {
  it.each([['slide'], ['layout'], ['master'], ['slide', 'layout', 'master'], ['mixed']].map((modes) => ({ modes })))(
    'preserves authored content and archive identities for $modes',
    async ({ modes }) => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nonnumeric-worker-'))
      roots.push(root)
      const data = await fixtures.createNonnumericFixture(root, modes)
      const parsed = await worker.parseFile(data.file, 'nonnumeric.pptx')
      expect(parsed).toMatchObject({ ok: true, parser: 'pptxtojson', packageVersion: '2.0.2' })
      for (const [index, label] of ['SECOND', 'FIRST'].entries()) {
        const slide = parsed.output.slides[index]
        expect(text(slide.elements)).toContain(label)
        expect(slide.note).toContain(`Notes ${label}`)
        expect(text(slide.layoutElements)).toContain(`LAYOUT ${label}`)
        expect(text(slide.layoutElements)).toContain('MASTER FOUNDATION')
      }
      expect(sha(await fs.readFile(data.file))).toBe(sha(data.bytes))
      expect(await fs.readFile(data.file)).toEqual(data.bytes)
    }
  )
})
