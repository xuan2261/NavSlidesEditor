import fs from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import {
  apiCreatePresentation,
  apiDeletePresentation,
  apiUpdatePresentation,
} from '../fixtures/test-fixtures.js'
import { EditorPage } from '../pages/editor-page.js'
import { gameCases, gameFixture, deckWith } from './release-game-fixtures.js'
import { completeGame } from './release-game-interactions.js'
import { launchPresentPopup } from './present-offline-helpers.js'
import { launchDesktop, closeDesktop } from './release-desktop-launch.js'
import { desktopPolicyElement, probeDesktopPolicy } from './release-desktop-policy.js'
import { observe } from './release-observations.js'

import configuration from './desktop-runtime-config.cjs'
const { desktopLane } = configuration
test.describe.configure({ mode: 'default' })
for (const { type, kind } of gameCases()) {
  test(`real native ${type}${kind ? ` ${kind}` : ''} interaction reset and inline eval undeclared-network CSP`, async ({}, testInfo) => {
    const lane = desktopLane(testInfo.project)
    test.setTimeout(180000)
    const desktop = await launchDesktop(lane, testInfo)
    const apiBase = new URL('/api', desktop.page.url()).href
    const context = desktop.page.context(),
      diagnostics = []
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
    context.on('console', (message) =>
      diagnostics.push({ event: 'console', type: message.type(), text: message.text() })
    )
    context.on('weberror', (error) =>
      diagnostics.push({ event: 'pageerror', text: error.error().message })
    )
    context.on('requestfailed', (request) =>
      diagnostics.push({ event: 'requestfailed', url: request.url(), failure: request.failure() })
    )
    context.on('response', (response) =>
      diagnostics.push({
        event: 'response',
        url: response.url(),
        status: response.status(),
        csp: response.headers()['content-security-policy'],
      })
    )
    let deck, popup
    try {
      const fixture = gameFixture(type, kind)
      deck = await apiCreatePresentation(desktop.request, `Actual ${lane} ${type}`, apiBase)
      const payload = deckWith([fixture])
      payload.slides.push({
        id: 'desktop-policy',
        background: { type: 'color', color: '#ffffff' },
        elements: [desktopPolicyElement],
      })
      await apiUpdatePresentation(desktop.request, deck.id, payload, apiBase)
      const page = desktop.page
      await page.addInitScript(() => {
        window.__E2E__ = true
        localStorage.setItem('navSlidesTutorialSeen', 'true')
      })
      await page.goto(new URL(`/editor/${deck.id}`, page.url()).href)
      await new EditorPage(page).waitForReady()
      ;({ popup } = await launchPresentPopup(page))
      const root = popup.locator(`[data-ns-game][data-ns-element-id="${fixture.id}"]`)
      const game = await completeGame(root, type, fixture[type])
      const gameScreenshot = testInfo.outputPath('actual-desktop-game-reset.png')
      await popup.screenshot({ path: gameScreenshot })
      const policy = await probeDesktopPolicy(popup, desktop.application)
      expect(policy).toMatchObject({
        inline: true,
        evalBlocked: true,
        functionBlocked: true,
        fetchBlocked: true,
        socketBlocked: true,
        reachedNetwork: [],
      })
      const runtimeArtifact = testInfo.outputPath('actual-desktop-runtime.json')
      await fs.writeFile(
        runtimeArtifact,
        JSON.stringify(
          {
            runtime: desktop.runtime,
            artifactHashes: desktop.identity.artifactHashes,
            artifactPaths: desktop.identity.artifactPaths,
            embeddedSources: desktop.embeddedSources,
            fixtureData: desktop.userData,
          },
          null,
          2
        )
      )
      await observe(
        testInfo,
        popup,
        { element: 'game', gameType: type, questionKind: kind, surface: 'desktop', lane },
        'native-local-csp',
        {
          realElectronRuntime: true,
          packaged: lane === 'windows-packaged',
          isolatedUserData: desktop.userData,
          meaningfulGameCompletionAndReset: true,
          inlineJsCssAllowed: true,
          evalAndUndeclaredNetworkDenied: true,
        },
        {
          runtime: desktop.runtime,
          artifactHashes: desktop.identity.artifactHashes,
          embeddedSources: desktop.embeddedSources,
          game,
          policy,
        },
        [runtimeArtifact, gameScreenshot],
        {
          browser: 'chromium',
          browserVersion: desktop.runtime.chromiumVersion,
          executablePath: desktop.runtime.executablePath,
        }
      )
    } finally {
      try {
        await popup?.close()
        if (deck) await apiDeletePresentation(desktop.request, deck.id, apiBase)
      } finally {
        try {
          const trace = testInfo.outputPath('actual-electron-renderer-trace.zip')
          await context.tracing.stop({ path: trace })
          await testInfo.attach('Actual Electron renderer trace', {
            path: trace,
            contentType: 'application/zip',
          })
          await testInfo.attach('Actual Electron renderer diagnostics', {
            body: JSON.stringify(diagnostics, null, 2),
            contentType: 'application/json',
          })
        } finally {
          await closeDesktop(desktop)
        }
      }
    }
  })
}
