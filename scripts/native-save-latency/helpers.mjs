import fs from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { spawn } from 'node:child_process'
import { openSync, closeSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Only this ChildProcess handle may be terminated; never enumerate/kill other PIDs.
export function ownedServer({ data, uploads, output, receipt }) {
  const stdout = path.join(output, 'server.stdout.log'), stderr = path.join(output, 'server.stderr.log')
  const out = openSync(stdout, 'wx'), err = openSync(stderr, 'wx')
  let child
  try {
    child = spawn(process.execPath, [fileURLToPath(new URL('./server-child.mjs', import.meta.url))], {
      cwd: process.cwd(), windowsHide: true,
      env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '0',
        DATA_DIR: data, SLIDES_DATA_DIR: data, SLIDES_UPLOADS_DIR: uploads, NATIVE_SAVE_REPORT_DIR: output },
      stdio: ['ignore', out, err, 'ipc'],
    })
  } finally { closeSync(out); closeSync(err) }
  const topology = receipt.topology = { observerPid: process.pid, serverPid: child.pid,
    executable: process.execPath, server: 'owned separate production process',
    browser: 'separate Chromium process', writer: 'server child only', stdout, stderr,
    readiness: '/health/ready', shutdownAcknowledged: false }
  let readyResolve, readyReject, exited = false
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject })
  const exit = new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      exited = true; topology.exit = { code, signal }
      readyReject(new Error(`Owned server exited: ${code}/${signal}`)); resolve()
    })
    child.once('error', (error) => { readyReject(error); resolve(); exited = true })
  })
  child.on('message', (message) => {
    if (message?.type === 'ready') {
      if (message.pid !== child.pid || !Number.isInteger(message.port) || message.port < 1 || message.port > 65535) {
        readyReject(new Error('Invalid owned server readiness IPC')); return
      }
      topology.port = message.port
      readyResolve(`http://127.0.0.1:${message.port}`)
    } else if (message?.type === 'stopped') topology.shutdownAcknowledged = message.pid === child.pid
    else if (message?.type === 'startup-error') readyReject(new Error(message.error))
    else if (message?.type === 'shutdown-error') receipt.cleanupErrors.push(`server: ${message.error}`)
  })
  const startupTimer = setTimeout(() => readyReject(new Error('Owned server startup timed out')), 120000)
  ready.then(() => clearTimeout(startupTimer), () => clearTimeout(startupTimer))
  return { ready, async profileStart() {
    if (process.env.NATIVE_SAVE_CPU_PROFILE !== '1') return
    receipt.diagnosticOnly = true
    receipt.qualificationEligible = false
    await new Promise((resolve, reject) => {
      const id = 'native-save-start'
      const timer = setTimeout(() => { child.off('message', onMessage); reject(new Error('CPU diagnostic IPC timed out')) }, 30000)
      function onMessage(message) {
        if (message?.type !== 'save-profile-result' || message.id !== id) return
        clearTimeout(timer); child.off('message', onMessage)
        if (message.error) reject(new Error(message.error)); else resolve()
      }
      child.on('message', onMessage)
      child.send({ type: 'save-profile-start', id })
    })
  }, async stop() {
    if (!exited && child.connected) {
      await new Promise((resolve) => child.send({ type: 'stop' }, (error) => {
        if (error) receipt.cleanupErrors.push(`server stop IPC: ${error.message}`)
        resolve()
      }))
    }
    let timer
    const stopped = await Promise.race([exit.then(() => true), new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), 15000)
    })])
    clearTimeout(timer)
    if (!stopped) {
      receipt.cleanupErrors.push('server: graceful shutdown timed out; owned PID kill fallback')
      topology.killFallback = true
      child.kill('SIGKILL')
      await exit
    }
    if (!topology.shutdownAcknowledged || topology.exit?.code !== 0) {
      receipt.cleanupErrors.push('server: missing graceful shutdown acknowledgement or nonzero exit')
    }
  } }
}

export const clock = () => ({ at: Date.now(), mono: performance.now() })
export function check(value, message) {
  if (!value) throw new Error(message)
}
export const contentOf = (deck, target) => deck.slides?.find((s) => s.id === target.slideId)
  ?.elements?.find((e) => e.id === target.id)?.content ?? ''

// No asynchronous response-body callback can rewrite the time an event was observed.
export function collectHttp(context, receipt, append) {
  const requests = new Map()
  let sequence = 0
  const record = (event) => { receipt.events.push(event); append(event) }
  context.on('request', (request) => {
    const time = clock()
    let payload
    try { payload = request.postDataJSON() } catch { /* Non-JSON request. */ }
    const row = { id: ++sequence, url: request.url(), method: request.method(), ...time,
      markerPayload: request.method() === 'PUT' && request.url() === receipt.presentationUrl &&
        contentOf(payload ?? {}, receipt.target ?? {}).includes(receipt.marker) }
    requests.set(request, row)
    record({ type: 'request', ...row })
  })
  context.on('response', (response) => {
    const time = clock(), row = requests.get(response.request())
    if (row) { row.status = response.status(); record({ type: 'response', requestId: row.id, ...time, status: row.status }) }
  })
  context.on('requestfinished', (request) => {
    const time = clock(), row = requests.get(request)
    if (!row) return
    record({ type: 'finished', requestId: row.id, ...time })
    if (row.markerPayload && row.status === 200 && time.mono >= (receipt.typingStart?.mono ?? Infinity)) {
      receipt.markerSaves.push({ requestId: row.id, requestAt: row.at, finished: time, status: row.status })
    }
    requests.delete(request)
  })
  context.on('requestfailed', (request) => {
    const row = requests.get(request)
    record({ type: 'requestfailed', requestId: row?.id, url: request.url(), ...clock(), error: request.failure() })
    requests.delete(request)
  })
}

export async function selectNavigatorSlide(page, index, phase = () => {}, guard = () => {}) {
  const opener = page.getByRole('button', { name: 'Open slide navigator', exact: true })
  const button = page.getByRole('button', { name: `Select slide ${index + 1}`, exact: true })
  phase('navigator:either-visible')
  await button.or(opener).first().waitFor({ state: 'visible' }); guard()
  phase('navigator:opener-visible')
  const openerVisible = await opener.isVisible(); guard()
  if (openerVisible) {
    phase('navigator:opener-click')
    await opener.click(); guard()
    phase('navigator:opener-click-returned')
  }
  phase('navigator:slide-click')
  await button.click({ position: { x: 20, y: 45 } }); guard()
  phase('navigator:slide-click-returned')
  return button
}

export async function exposedTarget(page, deck) {
  const index = deck.slides.findIndex((s) => s.elements.some((e) => e.type === 'text' && !e.hidden && !e.locked))
  check(index >= 0, 'No editable text slide')
  const slide = deck.slides[index]
  await selectNavigatorSlide(page, index)
  const closer = page.getByRole('button', { name: 'Close workspace overlay', exact: true })
  if (await closer.isVisible()) {
    const box = await closer.boundingBox()
    await closer.click({ position: { x: box.width - 5, y: box.height / 2 } })
  }
  const target = await page.evaluate((elements) => {
    for (const element of elements) {
      const node = document.querySelector(`[data-testid="slide-element-${CSS.escape(element.id)}"]`)
      if (!node) continue
      const box = node.getBoundingClientRect()
      for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.75]]) {
        const x = box.left + box.width * fx, y = box.top + box.height * fy
        if (x > 0 && y > 0 && x < innerWidth && y < innerHeight && node.contains(document.elementFromPoint(x, y))) {
          return { id: element.id, hitpoint: { x, y } }
        }
      }
    }
    throw new Error('No exposed editable text hitpoint')
  }, slide.elements.filter((e) => e.type === 'text' && !e.hidden && !e.locked))
  return { ...target, slideId: slide.id, index }
}

// Timer is only a wakeup: monotonic checks after awaited browser work prevent late PASS.
export async function withinDeadline(receipt, action) {
  let timer
  const guard = () => {
    const elapsed = performance.now() - receipt.typingStart.mono
    if (elapsed > receipt.deadlineMs || receipt.deadlineFailed) {
      receipt.deadlineFailed = true
      throw new Error(`30000ms native-input observation deadline FAILED (${elapsed.toFixed(1)}ms); lastPhase=${JSON.stringify(receipt.lastPhase ?? null)}`)
    }
  }
  try {
    await Promise.race([
      action(guard),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          receipt.deadlineFailed = true
          reject(new Error(`30000ms native-input observation deadline FAILED; lastPhase=${JSON.stringify(receipt.lastPhase ?? null)}`))
        }, receipt.deadlineMs)
      }),
    ])
    guard()
    receipt.verifiedAt = clock()
  } finally { clearTimeout(timer) }
}

// Raw byte writer: callers are responsible for validating any encoded JSON first.
export async function writeExclusiveBytes(filename, bytes) {
  await fs.writeFile(filename, bytes, { flag: 'wx' })
}

export async function writeExclusive(filename, value, { indentation = 2 } = {}) {
  await fs.writeFile(filename, JSON.stringify(value, null, indentation), { flag: 'wx' })
}
