// Standalone real-browser lifecycle diagnostic; never a matrix/native qualification.
// After an integrated `npm run build`: node tests/e2e/helpers/pptx-semantic-browser-smoke.cjs [desktop|mobile|all]
// Uses the existing genuine text journey and all its source/sibling/Original/history/Save assertions.
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { build } = require('esbuild')
const { chromium } = require('playwright')

const repo = path.resolve(__dirname, '../../..')
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const modes = {
  desktop: { viewport: { width: 1440, height: 1000 }, interaction: 'pointer', theme: 'light' },
  mobile: { viewport: { width: 390, height: 844 }, interaction: 'keyboard', theme: 'dark' },
}
const selection = process.argv[2] || 'all'
if (process.argv.length > 3 || !['desktop', 'mobile', 'all'].includes(selection))
  throw new Error('Usage: node tests/e2e/helpers/pptx-semantic-browser-smoke.cjs [desktop|mobile|all]')
if (path.resolve(process.cwd()) !== repo) throw new Error('Run this diagnostic from the repository root')

async function attestBuild() {
  const { verifyManifest } = await import(pathToFileURL(path.join(repo,
    'scripts/ci/verify-client-dist-manifest.mjs')).href)
  const manifestPath = path.join(repo, 'client-dist-manifest.json')
  const raw = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  const result = verifyManifest({
    baseDir: repo,
    manifest: manifestPath,
    root: path.join(repo, 'client/dist'),
    subject: raw.subject.sha,
    dirty: raw.subject.dirty,
    buildCommand: raw.build.command || 'npm run build',
  })
  return { inputHash: result.inputHash, artifactIdentity: result.artifactIdentity,
    verifiedAssets: result.files, currentSourceAttested: true }
}

async function main() {
  const buildReceipt = await attestBuild()
  const runs = path.join(repo, '.playwright/runs')
  await fs.mkdir(runs, { recursive: true })
  const root = await fs.mkdtemp(path.join(runs, 'semantic-browser-smoke-'))
  const artifacts = path.join(root, 'artifacts')
  await fs.mkdir(artifacts)
  const receipt = { startedAt: new Date().toISOString(), root, build: buildReceipt,
    scope: 'Genuine text browser lifecycle only; not full matrix or native visual qualification',
    nativeVisualQualified: false, cases: [], cleanupErrors: [] }
  const environment = { NODE_ENV: 'production', SLIDES_DATA_DIR: path.join(root, 'data'),
    SLIDES_UPLOADS_DIR: path.join(root, 'uploads'), NAVSLIDES_PPTX_FONT_ROOTS: '[]',
    PLAYWRIGHT_PPTX_FONT_MODE: 'unavailable' }
  const prior = Object.fromEntries(Object.keys({ ...environment,
    PLAYWRIGHT_API_BASE_URL: '', PLAYWRIGHT_TEST_BASE_URL: '' }).map(key => [key, process.env[key]]))
  let application, server, browser, failure
  try {
    Object.assign(process.env, environment)
    application = require(path.join(repo, 'server/index.js'))
    server = await application.startServer(0, { host: '127.0.0.1' })
    const origin = `http://127.0.0.1:${server.address().port}`
    process.env.PLAYWRIGHT_API_BASE_URL = `${origin}/api`
    process.env.PLAYWRIGHT_TEST_BASE_URL = origin
    receipt.origin = origin
    // Bundle only the test helper module format; this does not compile/rebuild the app.
    const helper = path.join(root, 'journey.cjs')
    await build({ absWorkingDir: repo, stdin: { resolveDir: repo, contents:
      "export { runJourney } from './tests/e2e/helpers/pptx-semantic-lifecycle-journey.js';" +
      "export { textJourney } from './tests/e2e/helpers/pptx-semantic-content-journeys.js';" },
    outfile: helper, bundle: true, packages: 'external', platform: 'node', format: 'cjs', logLevel: 'silent' })
    const { runJourney, textJourney } = require(helper)
    receipt.source = textJourney.source
    browser = await chromium.launch({ headless: true })
    receipt.browserVersion = browser.version()
    for (const mode of selection === 'all' ? Object.keys(modes) : [selection]) {
      const env = modes[mode]
      const directory = path.join(artifacts, mode)
      await fs.mkdir(directory)
      const observed = { mode, ...env, startedAt: new Date().toISOString(), attachments: [], network: [], errors: [] }
      receipt.cases.push(observed)
      const context = await browser.newContext({ baseURL: origin, viewport: env.viewport, acceptDownloads: true })
      let page, caseFailure
      try {
        await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
        page = await context.newPage()
        page.setDefaultTimeout(60000)
        page.on('pageerror', error => observed.errors.push(error.stack || error.message))
        page.on('response', response => {
          const request = response.request()
          const route = new URL(response.url()).pathname
          if (request.method() !== 'GET' && route.startsWith('/api/'))
            observed.network.push({ method: request.method(), path: route, status: response.status() })
        })
        const info = {
          outputPath: name => path.join(directory, name),
          async attach(name, { body, contentType }) {
            const extension = contentType === 'image/png' ? '.png' : '.json'
            const file = path.join(directory, name + extension)
            await fs.writeFile(file, body)
            observed.attachments.push({ name, file, contentType, sha256: sha256(body) })
          },
        }
        await runJourney({ page, request: context.request, info, journey: textJourney,
          interaction: env.interaction, theme: env.theme })
        assert.deepEqual(observed.errors, [], 'Browser must not report uncaught application errors')
        observed.status = 'passed'
      } catch (error) {
        caseFailure = error
        observed.status = 'failed'
        observed.failure = error.stack || error.message
        observed.url = page?.url()
        if (page) {
          for (const [name, capture] of [
            ['failure.png', () => page.screenshot({ path: path.join(directory, 'failure.png'), fullPage: true })],
            ['failure-accessibility.txt', async () => fs.writeFile(path.join(directory,
              'failure-accessibility.txt'), await page.locator('body').ariaSnapshot())],
          ]) {
            try { await capture() } catch (captureError) {
              receipt.cleanupErrors.push(`${mode} ${name}: ${captureError.stack || captureError.message}`)
            }
          }
        }
      } finally {
        observed.finishedAt = new Date().toISOString()
        try { await context.tracing.stop({ path: path.join(directory, 'trace.zip') }) }
        catch (error) { receipt.cleanupErrors.push(`Trace: ${error.stack || error.message}`) }
        try { await context.close() }
        catch (error) { receipt.cleanupErrors.push(`Context: ${error.stack || error.message}`) }
      }
      if (caseFailure) throw caseFailure
    }
    assert.deepEqual(await attestBuild(), buildReceipt, 'Integrated source/build must remain unchanged during smoke')
    receipt.status = 'passed'
  } catch (error) {
    failure = error
    receipt.status = 'failed'
    receipt.failure = error.stack || error.message
  } finally {
    for (const [name, cleanup] of [
      ['Browser', async () => { if (browser) await browser.close() }],
      ['Server', async () => { if (application) await application.stopServer(server) }],
    ]) {
      try { await cleanup() } catch (error) { receipt.cleanupErrors.push(`${name}: ${error.stack || error.message}`) }
    }
    for (const [name, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    if (receipt.cleanupErrors.length) receipt.status = 'failed'
    receipt.finishedAt = new Date().toISOString()
    const output = path.join(artifacts, 'runtime-receipt.json')
    await fs.writeFile(output, JSON.stringify(receipt, null, 2) + '\n')
    console.log(`Browser lifecycle receipt: ${output}`)
    console.log(JSON.stringify(receipt))
    await fs.rm(path.join(root, 'journey.cjs'), { force: true })
  }
  if (failure) throw failure
  if (receipt.cleanupErrors.length) throw new AggregateError(receipt.cleanupErrors, 'Browser lifecycle cleanup failed')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
