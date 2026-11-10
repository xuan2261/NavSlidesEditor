const { test, expect } = require('@playwright/test')
const {
  buildSandboxFrameDocument,
} = require('../../../shared/src/education/html-sandbox-policy.js')
const fs = require('node:fs')
const path = require('node:path')
const {
  createPluginMessageRuntime,
} = require('../../../shared/src/education/plugin-message-contract.js')
const local = { network: false, offlineCapable: true, resources: [], dynamicResources: [] }
async function armPatchBarrier(receiver, value) {
  await receiver.evaluate((_node, value) => {
    window.patchProcessed = new Promise((resolve) => {
      const received = (event) => {
        if (event.data?.type !== 'update-data' || event.data.patch?.value !== value) return
        window.removeEventListener('message', received)
        // A queued port task runs after every listener for the rejected message.
        const channel = new MessageChannel()
        channel.port1.onmessage = () => {
          channel.port1.close()
          channel.port2.close()
          resolve()
        }
        channel.port2.postMessage(null)
      }
      window.addEventListener('message', received)
    })
  }, value)
}
test('actual wrapped counter peers update independently and reject sibling/stale/tokenless patches', async ({
  page,
}) => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../../plugins/animated-counter/dist/sandbox.html'),
    'utf8'
  )
  const document = buildSandboxFrameDocument(source, local, { plugin: true })
  await page.setContent('<main>Counter isolation</main>')
  await page.addScriptTag({
    content: `window.PluginContract=(${createPluginMessageRuntime.toString()})();`,
  })
  await page.evaluate((content) => {
    window.receipts = {}
    window.bridges = {}
    for (const id of ['A', 'B']) {
      const frame = document.createElement('iframe')
      frame.dataset.counter = id
      frame.setAttribute('sandbox', 'allow-scripts')
      const data = { value: id === 'A' ? 42 : 10, suffix: '%' }
      const size = { width: 360, height: 180 }
      const bridge = window.PluginContract.createPluginHostBridge({
        frame,
        pluginData: data,
        size,
        onDataUpdate(patch) {
          Object.assign(data, patch)
          bridge.update(data, size)
        },
      })
      window.bridges[id] = bridge
      window.addEventListener('message', (event) => {
        if (event.source === frame.contentWindow && event.data?.type === 'ready')
          window.receipts[id] = event.data
      })
      frame.addEventListener('load', () => bridge.load())
      frame.srcdoc = content
      document.body.append(frame)
    }
  }, document)
  const a = page.frameLocator('iframe[data-counter="A"]').frameLocator('iframe')
  const b = page.frameLocator('iframe[data-counter="B"]').frameLocator('iframe')
  await expect(a.locator('#value')).toHaveText('42%')
  await expect(b.locator('#value')).toHaveText('10%')
  await a.locator('body').evaluate(() => window.navslides.updateData({ value: 51 }))
  await expect(a.locator('#value')).toHaveText('51%')
  const stolen = await page.evaluate(() => window.receipts.B)
  const host = page.locator('body')
  const relay = page.frameLocator('iframe[data-counter="B"]').locator('body')
  await armPatchBarrier(host, 999)
  await armPatchBarrier(relay, 999)
  await a
    .locator('body')
    .evaluate(
      (tokens) =>
        window.top.postMessage({ ...tokens, type: 'update-data', patch: { value: 999 } }, '*'),
      stolen
    )
  await b
    .locator('body')
    .evaluate(() =>
      window.parent.postMessage(
        { source: 'navslides-plugin', type: 'update-data', patch: { value: 999 } },
        '*'
      )
    )
  await host.evaluate(() => window.patchProcessed)
  await relay.evaluate(() => window.patchProcessed)
  // Flush the real relay/render path without overwriting the protected value.
  await b.locator('body').evaluate(() => window.navslides.updateData({ suffix: '% processed' }))
  await expect(b.locator('#value')).toHaveText('10% processed')
  await b.locator('body').evaluate(() => window.navslides.updateData({ suffix: '%' }))
  await expect(a.locator('#value')).toHaveText('51%')
  await expect(b.locator('#value')).toHaveText('10%')
  await page.evaluate(() => {
    const frame = document.querySelector('iframe[data-counter="B"]')
    frame.srcdoc = frame.srcdoc
  })
  await expect
    .poll(() =>
      page.evaluate((old) => window.receipts.B?.documentToken !== old.documentToken, stolen)
    )
    .toBe(true)
  await armPatchBarrier(host, 998)
  await relay.evaluate(
    (_node, tokens) =>
      window.parent.postMessage({ ...tokens, type: 'update-data', patch: { value: 998 } }, '*'),
    stolen
  )
  await host.evaluate(() => window.patchProcessed)
  await b.locator('body').evaluate(() => window.navslides.updateData({ suffix: '% processed' }))
  await expect(b.locator('#value')).toHaveText('10% processed')
  await b.locator('body').evaluate(() => window.navslides.updateData({ suffix: '%' }))
  await expect(b.locator('#value')).toHaveText('10%')
  await b.locator('body').evaluate(() => window.navslides.updateData({ value: 11 }))
  await expect(b.locator('#value')).toHaveText('11%')
  await page.evaluate(() => Object.values(window.bridges).forEach((bridge) => bridge.destroy()))
})
