import { describe, expect, it } from 'vitest'
import { VIEWPORT, writePresentHtml } from './capture-present.js'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

describe('capture-present', () => {
  it('exposes deterministic viewport 960x540', () => {
    expect(VIEWPORT).toEqual({ width: 960, height: 540 })
  })

  it('writePresentHtml emits reveal markup', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'present-html-'))
    const file = path.join(dir, 'deck.html')
    try {
      await writePresentHtml(
        {
          title: 'Oracle',
          theme: 'white',
          slides: [{ id: 's1', elements: [{ type: 'text', content: '<p>Hi</p>', x: 0, y: 0, width: 100, height: 40 }] }],
        },
        file
      )
      const html = await fs.readFile(file, 'utf8')
      expect(html).toMatch(/reveal/i)
      expect(html).toMatch(/Hi/)
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
