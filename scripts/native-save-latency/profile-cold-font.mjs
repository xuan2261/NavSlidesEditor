import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { chromium } from '@playwright/test'
import { ownedServer } from './helpers.mjs'
const coldReload = process.argv.includes('--cold-reload')
if (coldReload) await runColdReload()
else {
  const reports = 'plans/261009-0901-navslides-full-reliability-deep-tdd/reports'
  const priorFile = `${reports}/native-save-20261116-919fa477-9cea-41fa-8c01-67ab5a979f5a/result.json`
  const prior = JSON.parse(await fs.readFile(priorFile, 'utf8'))
  const output = `${reports}/workspace-width-${randomUUID()}`
  await fs.mkdir(output)
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-workspace-width-'))
  const receipt = {
    output,
    root,
    priorFile,
    source: prior.retainedDataRoot,
    diagnosticOnly: true,
    qualificationEligible: false,
    viewport: { width: 1440, height: 900 },
    profiler: false,
    cleanupErrors: [],
    events: [],
    status: 'running',
  }
  const save = () => fs.writeFile(`${output}/result.json`, JSON.stringify(receipt, null, 2))
  await save()
  console.log(output)
  let server, browser
  try {
    for (const dir of ['data', 'uploads'])
      await fs.cp(path.join(prior.retainedDataRoot, dir), path.join(root, dir), { recursive: true })
    server = ownedServer({
      data: path.join(root, 'data'),
      uploads: path.join(root, 'uploads'),
      output,
      receipt,
    })
    const baseURL = await server.ready
    receipt.baseURL = baseURL
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      baseURL,
      viewport: receipt.viewport,
      storageState: {
        cookies: [],
        origins: [
          { origin: baseURL, localStorage: [{ name: 'navSlidesTutorialSeen', value: 'true' }] },
        ],
      },
    })
    const page = await context.newPage()
    page.on('pageerror', (e) => receipt.events.push({ type: 'pageerror', error: e.stack }))
    await page.addInitScript(() => {
      const rows = (globalThis.__widthRows = [])
      const native = globalThis.ResizeObserver
      const ids = new WeakMap()
      let next = 0
      const id = (n) => {
        if (!n) return null
        if (!ids.has(n)) ids.set(n, ++next)
        return ids.get(n)
      }
      const rect = (r) =>
        r
          ? {
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
              top: r.top,
              right: r.right,
              bottom: r.bottom,
              left: r.left,
            }
          : null
      const metrics = (n) => {
        const c = getComputedStyle(n)
        return {
          id: id(n),
          tag: n.tagName,
          namespace: n.namespaceURI,
          domId: n.id,
          class: n.getAttribute('class'),
          tier: n.getAttribute('data-workspace-tier'),
          connected: n.isConnected,
          clientWidth: n.clientWidth,
          offsetWidth: n.offsetWidth,
          scrollWidth: n.scrollWidth,
          rect: rect(n.getBoundingClientRect()),
          style: Object.fromEntries(
            [
              'width',
              'height',
              'min-width',
              'max-width',
              'display',
              'position',
              'flex',
              'flex-direction',
              'align-items',
              'align-self',
              'transform',
              'transform-origin',
              'zoom',
              'box-sizing',
              'padding',
              'border',
              'overflow',
              'contain',
              'content-visibility',
              'writing-mode',
            ].map((k) => [k, c.getPropertyValue(k)])
          ),
        }
      }
      const chain = (n) => {
        const out = []
        for (; n; n = n.parentElement) out.push(metrics(n))
        return out
      }
      const snapshot = (reason, extra = {}) => {
        const node = document.querySelector('[data-workspace-tier]')
        rows.push({
          reason,
          now: performance.now(),
          timeOrigin: performance.timeOrigin,
          readyState: document.readyState,
          innerWidth,
          innerHeight,
          dpr: devicePixelRatio,
          visualViewport: visualViewport
            ? {
                width: visualViewport.width,
                height: visualViewport.height,
                scale: visualViewport.scale,
                offsetLeft: visualViewport.offsetLeft,
              }
            : null,
          fontStatus: document.fonts?.status,
          workspace: node ? chain(node) : [],
          roots: [document.documentElement, document.body, document.getElementById('root')]
            .filter(Boolean)
            .map(metrics),
          ...extra,
        })
      }
      globalThis.__widthSnapshot = snapshot
      globalThis.ResizeObserver = new Proxy(native, {
        construct(Target, args) {
          const callback = args[0]
          let observer
          observer = new Target((entries, ro) => {
            const node = document.querySelector('[data-workspace-tier]')
            snapshot('ResizeObserver-callback', {
              observerId: id(observer),
              entries: entries.map((e) => ({
                target: metrics(e.target),
                targetEqualsWorkspace: e.target === node,
                contentRect: rect(e.contentRect),
                contentBoxSize: Array.from(e.contentBoxSize || [], (s) => ({
                  inlineSize: s.inlineSize,
                  blockSize: s.blockSize,
                })),
                borderBoxSize: Array.from(e.borderBoxSize || [], (s) => ({
                  inlineSize: s.inlineSize,
                  blockSize: s.blockSize,
                })),
                devicePixelContentBoxSize: Array.from(e.devicePixelContentBoxSize || [], (s) => ({
                  inlineSize: s.inlineSize,
                  blockSize: s.blockSize,
                })),
              })),
            })
            return callback(entries, ro)
          })
          const observe = observer.observe
          observer.observe = function (target, options) {
            snapshot('ResizeObserver-observe', {
              observerId: id(observer),
              target: metrics(target),
              targetEqualsWorkspace: target === document.querySelector('[data-workspace-tier]'),
              stack: new Error().stack,
            })
            return observe.call(this, target, options)
          }
          return observer
        },
      })
      snapshot('init')
      let last = ''
      new MutationObserver(() => {
        const n = document.querySelector('[data-workspace-tier]')
        const key = n ? `${id(n)}:${n.dataset.workspaceTier}` : 'absent'
        if (key !== last) {
          last = key
          snapshot('workspace-mutation')
        }
      }).observe(document, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['data-workspace-tier', 'class', 'style'],
      })
      setInterval(() => snapshot('poll-500ms'), 500)
      document.addEventListener('DOMContentLoaded', () => {
        snapshot('DOMContentLoaded')
        document.fonts.ready.then(() => snapshot('fonts-ready'))
      })
      document.fonts.addEventListener('loadingdone', () => snapshot('fonts-loadingdone'))
      document.fonts.addEventListener('loadingerror', () => snapshot('fonts-loadingerror'))
    })
    await page.goto(`/editor/${prior.presentationId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 180000,
    })
    await page.getByTestId(`slide-element-${prior.target.id}`).waitFor({ timeout: 180000 })
    await page.evaluate(() => globalThis.__widthSnapshot('target-ready'))
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(10000)
    receipt.final = await page.evaluate(() => {
      globalThis.__widthSnapshot('final')
      const n = document.querySelector('[data-workspace-tier]')
      const nodes = []
      for (let p = n; p; p = p.parentElement) nodes.push(p)
      const rules = []
      const visit = (list, sheet) => {
        for (const r of list) {
          if (r.selectorText) {
            let matches = []
            try {
              matches = nodes
                .filter((n) => n.matches(r.selectorText))
                .map((n) => ({ tag: n.tagName, id: n.id, class: n.className }))
            } catch {}
            if (matches.length)
              rules.push({ sheet, selector: r.selectorText, css: r.style.cssText, matches })
          }
          if (r.cssRules) visit(r.cssRules, sheet)
        }
      }
      for (const s of document.styleSheets) {
        try {
          visit(s.cssRules, s.href)
        } catch (e) {
          rules.push({ sheet: s.href, error: String(e) })
        }
      }
      return {
        url: location.href,
        tier: n?.dataset.workspaceTier,
        launcher: !!document.querySelector('[aria-label="Open slide navigator"]'),
        slideButtons: document.querySelectorAll('[aria-label^="Select slide "]').length,
        resizeObserverSource: Function.prototype.toString.call(ResizeObserver),
        rules,
      }
    })
    await page.screenshot({ path: `${output}/viewport-1440x900.png` })
    receipt.status = 'captured'
  } catch (e) {
    receipt.status = 'failed'
    receipt.error = e.stack
    process.exitCode = 1
  } finally {
    if (browser) {
      try {
        for (const c of browser.contexts())
          for (const p of c.pages()) {
            receipt.measurements = await p.evaluate(() => globalThis.__widthRows || [])
          }
      } catch (e) {
        receipt.cleanupErrors.push(String(e))
      }
      await browser.close()
    }
    if (server) await server.stop()
    await save()
    console.log(
      JSON.stringify({
        output,
        status: receipt.status,
        error: receipt.error,
        tier: receipt.final?.tier,
        measurements: receipt.measurements?.length,
      })
    )
  }
}

async function runColdReload() {
  const reports = 'plans/261009-0901-navslides-full-reliability-deep-tdd/reports'
  const priorFile = `${reports}/native-save-20261116-919fa477-9cea-41fa-8c01-67ab5a979f5a/result.json`
  const prior = JSON.parse(await fs.readFile(priorFile, 'utf8'))
  const output = `${reports}/cold-reload-${randomUUID()}`
  await fs.mkdir(output)
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nav-cold-reload-'))
  const receipt = {
    output,
    root,
    priorFile,
    source: prior.retainedDataRoot,
    diagnosticOnly: true,
    qualificationEligible: false,
    viewport: { width: 1440, height: 900 },
    profiler: true,
    cleanupErrors: [],
    status: 'running',
    mode: '--cold-reload',
  }
  const save = () => fs.writeFile(`${output}/result.json`, JSON.stringify(receipt, null, 2))
  await save()
  console.log(output)
  let server,
    browser,
    cdp,
    profiling = false
  const network = [],
    scripts = new Map()
  try {
    for (const dir of ['data', 'uploads'])
      await fs.cp(path.join(prior.retainedDataRoot, dir), path.join(root, dir), { recursive: true })
    server = ownedServer({
      data: path.join(root, 'data'),
      uploads: path.join(root, 'uploads'),
      output,
      receipt,
    })
    const baseURL = await server.ready
    receipt.baseURL = baseURL
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext({
      viewport: receipt.viewport,
      storageState: {
        cookies: [],
        origins: [
          { origin: baseURL, localStorage: [{ name: 'navSlidesTutorialSeen', value: 'true' }] },
        ],
      },
    })
    const page = await context.newPage()
    cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
    await cdp.send('Page.enable')
    await cdp.send('Debugger.enable')
    await cdp.send('Profiler.enable')
    cdp.on('Debugger.scriptParsed', (s) => scripts.set(s.scriptId, s))
    for (const event of [
      'requestWillBeSent',
      'responseReceived',
      'loadingFinished',
      'loadingFailed',
      'requestServedFromCache',
    ])
      cdp.on(`Network.${event}`, (data) => network.push({ event, ...data }))
    // Establish the editor URL without running production JS; the only JS admission is the profiled reload.
    await cdp.send('Emulation.setScriptExecutionDisabled', { value: true })
    await page.goto(`${baseURL}/editor/${prior.presentationId}`, {
      waitUntil: 'load',
      timeout: 180000,
    })
    await cdp.send('Network.clearBrowserCache')
    await cdp.send('Emulation.setScriptExecutionDisabled', { value: false })
    network.length = 0
    scripts.clear()
    await page.addInitScript(
      ({ target }) => {
        globalThis.__coldReady = { events: [], target }
        const check = () => {
          const r = globalThis.__coldReady
          const mark = (name, yes) => {
            if (yes && !r.events.some((e) => e.name === name))
              r.events.push({ name, ms: performance.now() })
          }
          mark('workspace', document.querySelector('[data-workspace-tier]'))
          mark(
            'navigator',
            document.querySelector(
              '[aria-label="Open slide navigator"], [aria-label^="Select slide "]'
            )
          )
          mark(
            'canvas-target',
            document.querySelector(`[data-testid="slide-element-${CSS.escape(target)}"]`)
          )
        }
        new MutationObserver(check).observe(document, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['data-workspace-tier'],
        })
        document.addEventListener('DOMContentLoaded', () => {
          globalThis.__coldReady.events.push({ name: 'DOMContentLoaded', ms: performance.now() })
          check()
        })
      },
      { target: prior.target.id }
    )
    receipt.targetBefore = await cdp.send('Target.getTargetInfo')
    await cdp.send('Profiler.setSamplingInterval', { interval: 1000 })
    await cdp.send('Profiler.start')
    profiling = true
    receipt.reloadAt = Date.now()
    await cdp.send('Page.reload', { ignoreCache: true })
    await page.waitForFunction(
      () =>
        globalThis.__coldReady?.events.some((e) => e.name === 'canvas-target') &&
        globalThis.__coldReady.events.some((e) => e.name === 'navigator'),
      {},
      { timeout: 180000 }
    )
    receipt.ready = await page.evaluate(() => ({
      ...globalThis.__coldReady,
      observedMs: performance.now(),
      viewport: { width: innerWidth, height: innerHeight },
      tier: document.querySelector('[data-workspace-tier]')?.dataset.workspaceTier,
      slideButtons: document.querySelectorAll('[aria-label^="Select slide "]').length,
      resources: performance.getEntriesByType('resource').map((e) => e.toJSON()),
      navigation: performance.getEntriesByType('navigation').map((e) => e.toJSON()),
    }))
    receipt.targetAfter = await cdp.send('Target.getTargetInfo')
    const { profile } = await cdp.send('Profiler.stop')
    profiling = false
    await fs.writeFile(`${output}/cold.cpuprofile`, JSON.stringify(profile))
    await summarize(profile)
    receipt.status = 'captured'
  } catch (e) {
    receipt.status = 'failed'
    receipt.error = e.stack
    process.exitCode = 1
  } finally {
    if (profiling)
      try {
        const { profile } = await cdp.send('Profiler.stop')
        await fs.writeFile(`${output}/cold.cpuprofile`, JSON.stringify(profile))
        await summarize(profile)
      } catch (e) {
        receipt.cleanupErrors.push(String(e))
      }
    await fs.writeFile(`${output}/network.json`, JSON.stringify(network, null, 2))
    if (browser) await browser.close()
    if (server) await server.stop()
    await save()
    console.log(JSON.stringify(receipt))
  }
  async function summarize(profile) {
    const nodes = new Map(profile.nodes.map((n) => [n.id, { ...n, selfUs: 0, cumulativeUs: 0 }]))
    const parents = new Map()
    for (const n of nodes.values()) for (const child of n.children || []) parents.set(child, n.id)
    for (let i = 0; i < (profile.samples || []).length; i++) {
      const id = profile.samples[i],
        weight = profile.timeDeltas[i] || 0
      nodes.get(id).selfUs += weight
      for (let p = id; p; p = parents.get(p)) nodes.get(p).cumulativeUs += weight
    }
    const totalUs = profile.timeDeltas.reduce((a, b) => a + b, 0)
    const rows = [...nodes.values()].map((n) => ({
      id: n.id,
      ...n.callFrame,
      selfMs: n.selfUs / 1000,
      cumulativeMs: n.cumulativeUs / 1000,
      selfPercent: (100 * n.selfUs) / totalUs,
      cumulativePercent: (100 * n.cumulativeUs) / totalUs,
    }))
    const self = [...rows].sort((a, b) => b.selfMs - a.selfMs),
      cumulative = [...rows].sort((a, b) => b.cumulativeMs - a.cumulativeMs)
    await fs.writeFile(
      `${output}/weighted.json`,
      JSON.stringify({ totalMs: totalUs / 1000, self, cumulative }, null, 2)
    )
    const hotIds = new Set(
      [
        ...self.slice(0, 60),
        ...cumulative.filter((r) => r.url.startsWith('http')).slice(0, 60),
      ].map((r) => r.scriptId)
    )
    const sources = []
    for (const id of hotIds) {
      const meta = scripts.get(id)
      if (!meta) continue
      try {
        const { scriptSource } = await cdp.send('Debugger.getScriptSource', { scriptId: id })
        const file = `source-${id}.js`
        await fs.writeFile(`${output}/${file}`, scriptSource)
        sources.push({ id, url: meta.url, file })
      } catch {}
    }
    const excerpts = []
    for (const r of [
      ...self.slice(0, 40),
      ...cumulative.filter((r) => r.url.startsWith('http')).slice(0, 40),
    ]) {
      const s = sources.find((s) => s.id === r.scriptId)
      if (!s) continue
      const text = await fs.readFile(`${output}/${s.file}`, 'utf8')
      const line = text.split('\n')[r.lineNumber] || ''
      excerpts.push({
        ...r,
        file: s.file,
        excerpt: line.slice(Math.max(0, r.columnNumber - 250), r.columnNumber + 750),
      })
    }
    await fs.writeFile(
      `${output}/source-excerpts.json`,
      JSON.stringify({ sources, excerpts }, null, 2)
    )
    receipt.profile = {
      totalMs: totalUs / 1000,
      topSelf: self.slice(0, 15),
      topProductionCumulative: cumulative.filter((r) => r.url.startsWith('http')).slice(0, 15),
    }
  }
}
