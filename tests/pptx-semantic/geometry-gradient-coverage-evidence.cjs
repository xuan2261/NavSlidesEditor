const { test } = require('@playwright/test')
const { createHash } = require('node:crypto')
const { Buffer } = require('node:buffer')
const console = require('node:console')

async function recordGradientCoverage(page, definition, html, capture, timings) {
  const measurement = {
    ...timings,
    definitionBytes: Buffer.byteLength(definition),
    definitionSha256: createHash('sha256').update(definition).digest('hex'),
    htmlSha256: createHash('sha256').update(html).digest('hex'),
    pngSha256: createHash('sha256').update(capture).digest('hex'),
    browser: page.context().browser().version(),
    dpr: await page.evaluate(() => globalThis.devicePixelRatio),
    patternId: await page.locator('pattern').getAttribute('id'),
  }
  await test.info().attach('native-frame', { body: capture, contentType: 'image/png' })
  await test.info().attach('gradient-measurement', {
    body: JSON.stringify(measurement, null, 2),
    contentType: 'application/json',
  })
  console.log(JSON.stringify(measurement))
  return measurement
}

module.exports = { recordGradientCoverage }
