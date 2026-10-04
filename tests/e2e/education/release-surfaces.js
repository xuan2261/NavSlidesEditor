import { expect } from '@playwright/test'
import { pathToFileURL } from 'node:url'
import { apiCreateShareLink } from '../fixtures/test-fixtures.js'
import { launchPresentPopup } from './present-offline-helpers.js'

export async function downloadArtifact(page, testInfo, menu, filename) {
  await page.getByRole('button', { name: 'File menu', exact: true }).click()
  const pending = page.waitForEvent('download', { timeout: 120000 })
  await page.getByRole('menuitem', { name: menu, exact: true }).click()
  const download = await pending
  const file = testInfo.outputPath(filename)
  await download.saveAs(file)
  expect(await download.failure()).toBeNull()
  return file
}

export async function freshPortable(browser, file, { initScripts = [] } = {}) {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const httpAttempts = [],
    socketAttempts = [],
    errors = []
  await context.route(/^https?:\/\//i, (route) => {
    httpAttempts.push(route.request().url())
    return route.abort('blockedbyclient')
  })
  await context.addInitScript(() => {
    window.__releaseSockets = []
    const NativeSocket = window.WebSocket
    window.WebSocket = class extends NativeSocket {
      constructor(url, protocols) {
        window.__releaseSockets.push(String(url))
        super(url, protocols)
      }
    }
  })
  for (const script of initScripts) await context.addInitScript(script)
  const page = await context.newPage()
  page.on('websocket', (socket) => socketAttempts.push(socket.url()))
  page.on('pageerror', (error) => errors.push(error.message))
  try {
    await page.goto(pathToFileURL(file).href)
    await page.waitForFunction(() => window.Reveal?.isReady())
    return {
      page,
      context,
      file,
      async inspectNetwork() {
        for (const frame of page.frames()) {
          socketAttempts.push(...(await frame.evaluate(() => window.__releaseSockets || [])))
        }
        expect(socketAttempts).toEqual([])
        expect(httpAttempts).toEqual([])
        expect(errors).toEqual([])
        return { protocol: new URL(page.url()).protocol, httpAttempts, socketAttempts, errors }
      },
    }
  } catch (error) {
    await context.close()
    throw error
  }
}

export async function visitGeneratedSurfaces(
  { page, request, browser, id, testInfo, surfaces = ['present', 'share', 'file'] },
  visit
) {
  if (surfaces.includes('present')) {
    const { popup } = await launchPresentPopup(page)
    try {
      await popup.waitForFunction(() => window.Reveal?.isReady())
      await visit(popup, 'present', [])
    } finally {
      await popup.close()
    }
  }
  if (surfaces.includes('share')) {
    const share = await apiCreateShareLink(request, id)
    const sharePage = await page.context().newPage()
    try {
      await sharePage.goto(`/share/${share.token}`)
      await sharePage.waitForFunction(() => window.Reveal?.isReady())
      await visit(sharePage, 'share', [])
    } finally {
      await sharePage.close()
    }
  }
  if (surfaces.includes('file')) {
    const file = await downloadArtifact(page, testInfo, 'Export HTML', 'portable.html')
    const portable = await freshPortable(browser, file)
    try {
      const network = await portable.inspectNetwork()
      await visit(portable.page, 'file', [file], network)
      return await portable.inspectNetwork()
    } finally {
      await portable.context.close()
    }
  }
}

export async function selectGeneratedSlide(page, index) {
  await page.evaluate((index) => window.Reveal.slide(index), index)
  await expect(page.locator('.reveal .slides section.present').last()).toBeVisible()
}

export async function findFrame(page, selector) {
  let selected
  await expect
    .poll(async () => {
      for (const frame of page.frames()) {
        if (await frame.locator(selector).count()) {
          selected = frame
          return true
        }
      }
      return false
    })
    .toBe(true)
  return selected
}
