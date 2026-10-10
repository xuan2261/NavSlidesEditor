const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const { chromium } = require('playwright')
const out = __dirname
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex')
async function identity() {
  const files = {}
  async function visit(directory) {
    for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(name)
      else if (entry.isFile()) files[name.replaceAll(path.sep, '/')] = sha(await fs.readFile(name))
      else throw new Error(`Nonregular built docs input: ${name}`)
    }
  }
  await visit('website/.vitepress/dist')
  for (const name of ['website/develop/building-from-source.md', 'website/vi/develop/building-from-source.md', 'website/develop/architecture.md', 'website/vi/develop/architecture.md', 'website/guide/installation.md', 'website/guide/getting-started.md', 'website/vi/guide/getting-started.md', 'website/features/cloud-sync.md', 'website/vi/features/cloud-sync.md', 'README.md', 'README_vi.md', 'CLAUDE.md', 'docs/export-fidelity-and-limits.md', 'docs/system-architecture.md', 'docs/deployment-guide.md', 'package.json', 'package-lock.json', 'runtime-versions.json']) files[name] = sha(await fs.readFile(name))
  return { files, sha256: sha(JSON.stringify(files)) }
}
async function main() {
  const receipt = { kind: 'real-Chromium-built-bilingual-docs', status: 'started', node: process.version, pages: [], sourceBefore: await identity() }
  receipt.command = [process.execPath, ...process.argv.slice(1)]
  receipt.harnessSha256 = sha(await fs.readFile(__filename))
  const server = spawn(process.execPath, ['--experimental-require-module', 'node_modules/vitepress/bin/vitepress.js', 'preview', 'website', '--host', '127.0.0.1', '--port', '4173'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let browser, output = ''
  const closed = new Promise(resolve => server.once('close', (code, signal) => resolve({ code, signal })))
  try {
    const base = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Docs preview readiness deadline: ${output}`)), 15000)
      const observe = bytes => {
        output += bytes.toString()
        const advertised = output.match(/http:\/\/(?:localhost|127\.0\.0\.1):4173\/\S*/)?.[0]
        if (!advertised) return
        const url = new URL(advertised)
        assert(['localhost', '127.0.0.1'].includes(url.hostname) && url.port === '4173')
        clearTimeout(timer); resolve(url.href)
      }
      server.stdout.on('data', observe); server.stderr.on('data', observe)
      server.once('error', error => { clearTimeout(timer); reject(error) })
      server.once('close', code => { clearTimeout(timer); reject(new Error(`Docs preview exited ${code}: ${output}`)) })
    })
    browser = await chromium.launch({ headless: true })
    receipt.browser = browser.version()
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    for (const language of ['', 'vi/']) {
      const response = await page.goto(new URL(`${language}develop/building-from-source`, base).href)
      assert.equal(response.status(), 200)
      await page.locator('main h1').filter({ hasText: language ? 'Build từ mã nguồn' : 'Building from Source' }).waitFor()
      const body = await page.locator('main').innerText()
      for (const value of ['22.13.0', '22.22.0', '22.23.3', 'Debian Trixie Slim', 'npm run build']) assert(body.includes(value), `Missing ${value} in ${language || 'en'} rendered prerequisites`)
      const screenshot = path.join(out, `documentation-render-${language ? 'vi' : 'en'}-final05.png`)
      await page.screenshot({ path: screenshot, fullPage: true })
      const link = page.locator(`main a[href*="/${language}develop/architecture"]`).first()
      assert(await link.isVisible(), 'Architecture link is visible')
      const href = await link.getAttribute('href')
      await link.click(); await page.waitForURL(url => url.pathname.includes(`/${language}develop/architecture`))
      await page.locator('main h1').filter({ hasText: language ? 'Kiến trúc' : 'Architecture' }).waitFor()
      const architecture = await page.locator('main').innerText()
      for (const value of ['server', 'client', 'shared', 'website']) assert(architecture.includes(value), `Missing workspace ${value}`)
      receipt.pages.push({ language: language || 'en', status: response.status(), href, title: await page.locator('main h1').innerText(), screenshot })
    }
    for (const [route, values] of [
      ['guide/installation', ['revealjs-data', '/app/server/data', 'revealjs-uploads', '/app/server/uploads', 'not host']],
      ['guide/getting-started', ['one operator']],
      ['vi/guide/getting-started', ['một người vận hành']],
      ['features/cloud-sync', ['presentation bundles', 'not a mirror', 'does not expose arbitrary']],
      ['vi/features/cloud-sync', ['không phải phản chiếu', 'không cung cấp mọi thao tác']],
    ]) {
      const response = await page.goto(new URL(route, base).href)
      assert.equal(response.status(), 200)
      const body = await page.locator('main').innerText()
      for (const value of values) assert(body.includes(value), `Missing corrected claim ${value} in ${route}`)
      const screenshot = path.join(out, `documentation-${route.replaceAll('/', '-')}-final05.png`)
      await page.screenshot({ path: screenshot, fullPage: true })
      receipt.pages.push({ route, status: response.status(), screenshot })
    }
    assert.deepEqual(errors, []); receipt.pageErrors = errors
    receipt.sourceAfter = await identity(); assert.deepEqual(receipt.sourceAfter, receipt.sourceBefore)
    receipt.status = 'passed'
  } catch (error) { receipt.status = 'failed'; receipt.failure = error.message; process.exitCode = 1 }
  finally {
    if (browser) await browser.close()
    server.kill('SIGKILL'); receipt.serverExit = await closed
    receipt.completedAt = new Date().toISOString()
    await fs.writeFile(path.join(out, 'documentation-render-final05.json'), JSON.stringify(receipt, null, 2), { flag: 'wx' })
  }
  console.log(JSON.stringify({ status: receipt.status, pages: receipt.pages, failure: receipt.failure }))
}
main().catch(error => { console.error(error); process.exitCode = 1 })
