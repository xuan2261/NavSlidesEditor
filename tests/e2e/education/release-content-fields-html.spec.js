import { test } from '../fixtures/test-fixtures.js'
import {
  contentFixture,
  setupContent,
  sourceControl,
  reloadContent,
  fieldEvidence,
  withPresent,
  withPortable,
} from './release-content-fields.js'
import {
  finalFrameHtml,
  isolationHtml,
  inspectFinalFrame,
  inspectIsolation,
  openPrint,
} from './release-content-fields-html.js'
import { captureSandboxNetwork } from './release-sandbox-network.js'

const dependencies = { network: false, offlineCapable: true, resources: [], dynamicResources: [] }

test('HTML source script produces the genuine final frame in canvas Present print and offline sandbox [cap:element.html.editor]', async ({
  page,
  request,
  browser,
  testPresentation,
}, testInfo) => {
  test.setTimeout(120000)
  const element = contentFixture('html', {
    content: '<p>Original embed</p>',
    htmlDependencies: dependencies,
    width: 800,
    height: 420,
  })
  await setupContent(page, request, testPresentation.id, element)
  await sourceControl(page, 'html', finalFrameHtml)
  const { persisted } = await reloadContent(page, request, testPresentation.id, element.id, {
    content: finalFrameHtml,
  })
  const canvas = await inspectFinalFrame(page)
  const generated = await withPresent(page, inspectFinalFrame)
  const print = await openPrint(page)
  let printed, printScreenshot
  try {
    printed = await inspectFinalFrame(print)
    printScreenshot = testInfo.outputPath('html-final-frame-print.png')
    await print.screenshot({ path: printScreenshot, fullPage: true })
  } finally {
    await print.close()
  }
  const portable = await withPortable(
    page,
    browser,
    testInfo,
    'html-final-frame-offline.html',
    async (offline) => {
      const finalFrame = await inspectFinalFrame(offline)
      const screenshot = testInfo.outputPath('html-final-frame-offline.png')
      await offline.screenshot({ path: screenshot })
      return { finalFrame, screenshot }
    }
  )
  await fieldEvidence(
    testInfo,
    page,
    'html',
    ['content', 'script', 'forPrint', 'finalFrame'],
    { finalFrame: 'Frame 3', geometry: { width: 140, height: 80, x: 40 } },
    {
      persisted,
      canvas,
      generated,
      printed,
      portable: portable.observed.finalFrame,
      network: portable.network,
    },
    [printScreenshot, portable.file, portable.observed.screenshot]
  )
})

test('HTML authored sandbox prevents real parent storage DOM and network API escapes on generated and print paths [cap:element.html.editor]', async ({
  page,
  request,
  testPresentation,
}, testInfo) => {
  const element = contentFixture('html', {
    content: '<p>Original isolation</p>',
    htmlDependencies: dependencies,
    width: 850,
    height: 440,
  })
  const network = captureSandboxNetwork(page.context())
  try {
    await setupContent(page, request, testPresentation.id, element)
    await sourceControl(page, 'html', isolationHtml)
    const { persisted } = await reloadContent(page, request, testPresentation.id, element.id, {
      content: isolationHtml,
    })
    network.scope('canvas')
    const canvas = await inspectIsolation(page)
    const generated = await withPresent(page, async (present) => {
      network.scope('generated')
      return inspectIsolation(present)
    })
    const print = await openPrint(page)
    let printed, screenshot
    try {
      network.scope('print')
      printed = await inspectIsolation(print)
      screenshot = testInfo.outputPath('html-runtime-isolation-print.png')
      await print.screenshot({ path: screenshot, fullPage: true })
    } finally {
      await print.close()
    }
    const attempts = await network.verify({ canvas, generated, print: printed })
    await fieldEvidence(
      testInfo,
      page,
      'html',
      ['parentIsolation', 'networkIsolation'],
      { parentAccess: 'denied', network: 'denied' },
      { persisted, canvas, generated, printed, attempts },
      [screenshot]
    )
  } finally {
    network.dispose()
  }
})

