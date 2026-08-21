import { decodePng, encodePngRgba } from './png-rgba.js'
import { VIEWPORT, capturePresentSlides, captureRevealSlides, expectedRevealSlideCount, writePresentHtml } from './capture-present.js'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

function png(value) {
  const rgba = Buffer.alloc(4 * 4 * 4)
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = value[0]; rgba[i + 1] = value[1]; rgba[i + 2] = value[2]; rgba[i + 3] = 255
  }
  return encodePngRgba(4, 4, rgba)
}

function fakeRevealPage(plan, colors) {
  let current = -1
  const navigations = []
  const waits = []
  return {
    navigations,
    waits,
    async evaluate(_callback, argument) {
      if (argument === undefined) return plan
      navigations.push(argument)
      current = argument.ordinal
    },
    async waitForFunction(_callback, argument) {
      waits.push(argument)
      if (current !== argument.ordinal) throw new Error('current reveal slide was not selected')
    },
    async evaluateHandle() {
      return {
        asElement: () => ({ screenshot: ({ path: output }) => fs.writeFile(output, png(colors[current])) }),
        dispose: async () => {},
      }
    },
  }
}

describe('capture-present', () => {
  const dirs = []
  afterEach(async () => Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true }))))

  it('exposes deterministic viewport 960x540', () => {
    expect(VIEWPORT).toEqual({ width: 960, height: 540 })
  })

  it('does not launch a browser after its capture deadline expires', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(capturePresentSlides({ slides: [{}] }, {
      outDir: 'unused', assetBaseUrl: 'http://127.0.0.1:3002', signal: controller.signal,
    })).resolves.toEqual({ ok: false, files: [], error: 'capture-timeout' })
  })

  it('returns a structured result when a timed-out browser close does not settle', async () => {
    const controller = new AbortController()
    let beginWait
    const waitStarted = new Promise((resolve) => { beginWait = resolve })
    const page = {
      newPage: undefined,
      goto: async () => {},
      setContent: async () => {},
      waitForFunction: async () => { beginWait(); return new Promise(() => {}) },
      close: async () => new Promise(() => {}),
    }
    const browser = {
      newPage: async () => page,
      close: async () => {},
    }
    const capture = capturePresentSlides({ slides: [{ id: 'slide-1', elements: [] }] }, {
      outDir: 'unused', assetBaseUrl: 'http://127.0.0.1:3002', browser, signal: controller.signal, teardownTimeoutMs: 10,
    })
    await waitStarted
    controller.abort()

    await expect(capture).resolves.toEqual(expect.objectContaining({
      ok: false,
      error: 'capture-timeout',
      cleanupErrors: expect.arrayContaining(['capture-page-close-timeout']),
    }))
  })

  it('establishes an HTTP origin and stable Reveal surface before capture', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'present-origin-'))
    dirs.push(root)
    const calls = []
    const page = {
      async goto(url) { calls.push(['goto', url]) },
      async setContent() { calls.push(['setContent']) },
      async waitForFunction() { calls.push(['waitForFunction']) },
      async evaluate(_callback, argument) {
        if (argument === undefined) return [{ ordinal: 0, h: 0, v: 0 }]
        if (argument?.revealConfig) {
          calls.push(['configure', argument])
          return
        }
        calls.push(['slide', argument])
      },
      async evaluateHandle() {
        return {
          asElement: () => ({ screenshot: ({ path: output }) => fs.writeFile(output, png([0, 0, 0])) }),
          dispose: async () => {},
        }
      },
      async close() {},
    }
    const browser = { newPage: async () => page, close: async () => {} }

    const result = await capturePresentSlides({
      slides: [{ id: 'slide-1', elements: [] }],
    }, {
      outDir: root,
      assetBaseUrl: 'http://127.0.0.1:3202/assets',
      browser,
    })

    expect(result.ok).toBe(true)
    expect(calls.slice(0, 2)).toEqual([
      ['goto', 'http://127.0.0.1:3202/'],
      ['setContent'],
    ])
    expect(calls).toContainEqual(['configure', {
      revealConfig: expect.objectContaining({
        controls: false,
        progress: false,
        transition: 'none',
        backgroundTransition: 'none',
      }),
      viewport: VIEWPORT,
    }])
  })

  it('counts vertical source slides as distinct Reveal leaves', () => {
    expect(expectedRevealSlideCount({ slides: [{}, { children: [{}, {}] }, {}] })).toBe(5)
  })

  it('navigates each exact Reveal index and captures distinct active slides in order', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'present-capture-'))
    dirs.push(root)
    const plan = [
      { ordinal: 0, h: 0, v: 0 }, { ordinal: 1, h: 1, v: 0 }, { ordinal: 2, h: 2, v: 0 },
    ]
    const page = fakeRevealPage(plan, [[255, 0, 0], [0, 255, 0], [0, 0, 255]])

    const result = await captureRevealSlides(page, { deckDir: root, expectedSlideCount: 3 })

    expect(result.files.map((file) => path.basename(file))).toEqual(['slide-0.png', 'slide-1.png', 'slide-2.png'])
    expect(page.navigations).toEqual(plan)
    expect(page.waits).toEqual(plan)
    const pixels = await Promise.all(result.files.map(async (file) => (await fs.readFile(file))))
    expect(pixels.map((bytes) => [...decodePng(bytes).data.subarray(0, 3)])).toEqual([
      [255, 0, 0], [0, 255, 0], [0, 0, 255],
    ])
  })

  it('bounds Reveal handle disposal after a screenshot', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'present-capture-'))
    dirs.push(root)
    const page = {
      async evaluate(_callback, argument) {
        if (argument === undefined) return [{ ordinal: 0, h: 0, v: 0 }]
      },
      async waitForFunction() {},
      async evaluateHandle() {
        return {
          asElement: () => ({ screenshot: async () => {} }),
          dispose: async () => new Promise(() => {}),
        }
      },
    }

    await expect(captureRevealSlides(page, {
      deckDir: root, expectedSlideCount: 1, teardownTimeoutMs: 10,
    })).rejects.toMatchObject({
      cleanupErrors: ['capture-current-slide-dispose-timeout'],
    })
  })

  it('fails before screenshots when Reveal leaves do not match source slides', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'present-capture-'))
    dirs.push(root)
    const page = fakeRevealPage([{ ordinal: 0, h: 0, v: 0 }], [[255, 0, 0]])

    await expect(captureRevealSlides(page, { deckDir: root, expectedSlideCount: 2 }))
      .rejects.toThrow('reveal-slide-count-mismatch')
  })

  it('writePresentHtml emits reveal markup', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'present-html-'))
    dirs.push(dir)
    const file = path.join(dir, 'deck.html')
    await writePresentHtml({
      title: 'Oracle', theme: 'white',
      slides: [{ id: 's1', elements: [{ type: 'text', content: '<p>Hi</p>', x: 0, y: 0, width: 100, height: 40 }] }],
    }, file)
    const html = await fs.readFile(file, 'utf8')
    expect(html).toMatch(/reveal/i)
    expect(html).toMatch(/Hi/)
  })
})
