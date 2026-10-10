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
const attacks = {
  'location assignment': "location.href='https://proof-invalid.example/location'",
  'location assign': "location.assign('https://proof-invalid.example/assign')",
  'self-target anchor':
    "const a=document.createElement('a');a.href='https://proof-invalid.example/anchor';a.target='_self';document.body.append(a);a.click()",
  'meta refresh':
    "const m=document.createElement('meta');m.httpEquiv='refresh';m.content='0;url=https://proof-invalid.example/refresh';document.head.append(m)",
  'nested frame':
    "const f=document.createElement('iframe');f.src='https://proof-invalid.example/nested';document.body.append(f)",
}

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

for (const [name, attack] of Object.entries(attacks)) {
  test(`local opaque wrapper blocks ${name} before a network request`, async ({ page }) => {
    const requests = []
    await page.route('https://proof-invalid.example/**', (route) => {
      requests.push(route.request().url())
      return route.abort()
    })
    const source = `<button id="count">Count 0</button><button id="attack">Attempt navigation</button><script>
      let count=0;document.getElementById('count').onclick=()=>{
        try { parent.document.body.setAttribute('data-compromised','yes') } catch {}
        document.getElementById('count').textContent='Count '+(++count);
      };
      document.getElementById('attack').onclick=()=>{${attack}};
    </script>`
    const document = buildSandboxFrameDocument(source, local)
    await page.setContent('<main id="sentinel">Unchanged</main>')
    await page.evaluate((content) => {
      const frame = document.createElement('iframe')
      frame.setAttribute('sandbox', 'allow-scripts')
      frame.srcdoc = content
      document.body.append(frame)
    }, document)
    const counter = page
      .frameLocator('iframe')
      .frameLocator('iframe')
      .getByRole('button', { name: 'Count 0' })
    await counter.click()
    await expect(
      page.frameLocator('iframe').frameLocator('iframe').getByRole('button', { name: 'Count 1' })
    ).toBeVisible()
    const outer = page.frameLocator('iframe')
    const inner = outer.frameLocator('iframe')
    for (const frame of [outer, inner]) {
      await frame.locator('body').evaluate(() => {
        window.navigationViolations = []
        document.addEventListener('securitypolicyviolation', (event) => {
          window.navigationViolations.push({
            directive: event.effectiveDirective,
            blocked: event.blockedURI,
          })
        })
      })
    }
    await page
      .frameLocator('iframe')
      .frameLocator('iframe')
      .getByRole('button', { name: 'Attempt navigation' })
      .click()
    // Observe the browser's denial, not merely an unchanged request list.
    await expect
      .poll(async () => {
        const violations = await Promise.all(
          [outer, inner].map((frame) =>
            frame.locator('body').evaluate(() => window.navigationViolations)
          )
        )
        return violations
          .flat()
          .some(
            (event) =>
              event.directive === 'frame-src' &&
              event.blocked.startsWith('https://proof-invalid.example')
          )
      })
      .toBe(true)
    expect(requests).toEqual([])
    await expect(page.locator('body')).not.toHaveAttribute('data-compromised')
    await expect(page.getByText('Unchanged')).toBeVisible()
  })
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
